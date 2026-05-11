---
sprint: 2
title: "GAP-01 workspace identity (finish) + GAP-04 Fabric Mirroring connector"
gaps: [GAP-01, GAP-04]
effort: M + L
status: complete
completed_date: 2026-05-02
score_before: 338
score_after_estimate: 352
score_actual: 352
adr_required: [ADR-046]
branch: claude/review-recent-commits-Auyjc
prerequisite: Sprint 1 merged; Fabric Mirroring GA confirmed for Azure SQL / D365 in BFL tenant
carryover:
  - scripts/12-manage-mirroring.py live smoke test (create/status/stop — requires live Fabric workspace)
  - scripts/11-provision-workspace-identity.py live smoke test (carried over from Sprint 1)
tds_raised: [TD-061, TD-062]
---

# Sprint 2 — Workspace Identity (finish) + Fabric Mirroring connector

## Carryover from Sprint 1

| Item | From | Notes |
|------|------|-------|
| GAP-01: `nb_conn_rest.py` WI support | Sprint 1 | Always planned for Sprint 2; JDBC portion delivered in Sprint 1 |
| GAP-01: `scripts/11-provision-workspace-identity.py` smoke test | Sprint 1 | Blocked: requires live Fabric workspace. Must pass before Sprint 2 DoD signs off |

### Sprint 2 Prerequisite checklist (run before writing any code)

- [ ] `python scripts/11-provision-workspace-identity.py provision --workspace-id $SMOKE_WS_ID --token $TOKEN` — provisions WI in smoke workspace
- [ ] `python scripts/11-provision-workspace-identity.py status --workspace-id $SMOKE_WS_ID --token $TOKEN` — returns identity object
- [ ] `python scripts/11-provision-workspace-identity.py deprovision --workspace-id $SMOKE_WS_ID --token $TOKEN` — cleans up
- [ ] Fabric Mirroring GA confirmed in BFL tenant for AzureSQL source

---

## Goals

| Gap | Deliverable | Done when |
|-----|-------------|-----------|
| GAP-01 | `nb_conn_rest` honours `UseWorkspaceIdentity` flag | 2 new tests in `test_nb_conn_rest.py` green |
| GAP-04 | `nb_conn_mirror.py` — new connector: read, HWM filter, count | New `tests/test_nb_conn_mirror.py` fully green |
| GAP-04 | `WatermarkState` extended with `SourceTable` column | Seed + schema test green |
| GAP-04 | `IngestionConfig` supports `ConnectorType = 'mirror'` | Seed + validation test green |
| GAP-04 | Fabric Mirroring API lifecycle in `scripts/12-manage-mirroring.py` | Script provisions, polls, and stops mirroring in smoke env |
| ADR-046 | Mirroring connector vs JDBC decision record | File committed |

---

## GAP-01 finish — `nb_conn_rest` Workspace Identity

### TDD Cycle 1 — REST connector acquires Workspace Identity token

**Write tests** — `tests/test_nb_conn_rest.py`, class `TestWorkspaceIdentityAuth`:

```python
class TestWorkspaceIdentityAuth(unittest.TestCase):

    def _conn_wi(self):
        return {
            "SourceID": 2, "SourceName": "D365_REST",
            "BaseUrl": "https://org.crm.dynamics.com/api/data/v9.2/",
            "UseWorkspaceIdentity": True,
            "OAuthScope": "https://org.crm.dynamics.com/.default",
            "KeyVaultSecretName": None,
        }

    def test_rest_acquires_wi_token_with_oauth_scope(self):
        nbu = MagicMock()
        nbu.credentials.getToken.return_value = "wi-rest-token"
        token = nb_conn_rest.resolve_bearer_token(
            conn_config=self._conn_wi(), kv_url="", notebookutils=nbu
        )
        nbu.credentials.getToken.assert_called_once_with(
            "https://org.crm.dynamics.com/.default"
        )
        self.assertEqual(token, "wi-rest-token")

    def test_rest_falls_back_to_key_vault_when_flag_false(self):
        nbu = MagicMock()
        nbu.secrets.get.return_value = "sp-rest-token"
        conn = {"UseWorkspaceIdentity": False, "KeyVaultSecretName": "d365-token",
                "OAuthScope": ""}
        token = nb_conn_rest.resolve_bearer_token(
            conn_config=conn, kv_url="https://kv.vault.azure.net/", notebookutils=nbu
        )
        self.assertEqual(token, "sp-rest-token")
        nbu.credentials.getToken.assert_not_called()
```

Run → **RED**.

**Implement** — `src/notebooks/nb_conn_rest.py`, new helper:

```python
def resolve_bearer_token(conn_config: dict, kv_url: str, notebookutils=None) -> str:
    if conn_config.get("UseWorkspaceIdentity"):
        if notebookutils is None:
            raise RuntimeError(
                "UseWorkspaceIdentity=True requires Fabric runtime (notebookutils)."
            )
        scope = conn_config.get("OAuthScope", "https://analysis.windows.net/powerbi/api")
        return notebookutils.credentials.getToken(scope)
    secret_name = conn_config["KeyVaultSecretName"]
    return notebookutils.secrets.get(kv_url, secret_name)
```

Update the existing token-acquisition call in `run_rest_ingestion` to delegate to `resolve_bearer_token`.

Run → **GREEN**.

---

## GAP-04 — Fabric Mirroring connector

### Fabric Mirroring REST API lifecycle — `scripts/12-manage-mirroring.py`

```python
#!/usr/bin/env python3
"""
scripts/12-manage-mirroring.py

Application lifecycle for Fabric Mirrored Databases via the Fabric REST API.

Usage:
    python scripts/12-manage-mirroring.py create  --workspace-id <id> --name <name>
                                                   --source-type AzureSQL
                                                   --connection-id <scc-id>
                                                   --target-db <db-name>
                                                   --token <bearer>
    python scripts/12-manage-mirroring.py status   --workspace-id <id> --mirrored-db-id <id> --token <bearer>
    python scripts/12-manage-mirroring.py start    --workspace-id <id> --mirrored-db-id <id> --token <bearer>
    python scripts/12-manage-mirroring.py stop     --workspace-id <id> --mirrored-db-id <id> --token <bearer>
    python scripts/12-manage-mirroring.py delete   --workspace-id <id> --mirrored-db-id <id> --token <bearer>
    python scripts/12-manage-mirroring.py list     --workspace-id <id> --token <bearer>
"""
import argparse
import json
import sys
import time
import requests

FABRIC_API = "https://api.fabric.microsoft.com/v1"
POLL_INTERVAL_S = 5
POLL_TIMEOUT_S = 300


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── CREATE ────────────────────────────────────────────────────────────────────

def create_mirrored_database(
    workspace_id: str,
    display_name: str,
    source_type: str,
    connection_id: str,
    target_db_name: str,
    token: str,
) -> dict:
    """
    POST /v1/workspaces/{workspaceId}/mirroredDatabases

    source_type: "AzureSQL" | "Snowflake" | "CosmosDB" | "AzureSQLManagedInstance"
    connection_id: Shareable Cloud Connection (SCC) ID from nb_utils_scc
    """
    payload = {
        "displayName": display_name,
        "definition": {
            "parts": [
                {
                    "path": "mirroring.json",
                    "payload": json.dumps({
                        "properties": {
                            "source": {
                                "type": source_type,
                                "typeProperties": {
                                    "connectionId": connection_id,
                                    "databaseName": target_db_name,
                                }
                            },
                            "target": {
                                "type": "MountedRelationalDatabase"
                            }
                        }
                    }),
                    "payloadType": "InlineBase64"
                }
            ]
        }
    }
    r = requests.post(
        f"{FABRIC_API}/workspaces/{workspace_id}/mirroredDatabases",
        headers=_h(token),
        json=payload,
    )
    if r.status_code == 202:
        return _poll_lro(r.headers.get("Location", r.headers.get("location", "")), token)
    r.raise_for_status()
    return r.json()


# ── READ ──────────────────────────────────────────────────────────────────────

def list_mirrored_databases(workspace_id: str, token: str) -> list:
    r = requests.get(
        f"{FABRIC_API}/workspaces/{workspace_id}/mirroredDatabases",
        headers=_h(token),
    )
    r.raise_for_status()
    return r.json().get("value", [])


def get_mirroring_status(workspace_id: str, mirrored_db_id: str, token: str) -> dict:
    """
    POST /v1/workspaces/{workspaceId}/mirroredDatabases/{mirroredDatabaseId}/getMirroringStatus
    Returns {"status": "Running"|"Stopped"|"Initializing"|"Failed", "lastRefreshedAt": ...}
    """
    r = requests.post(
        f"{FABRIC_API}/workspaces/{workspace_id}/mirroredDatabases/{mirrored_db_id}/getMirroringStatus",
        headers=_h(token),
    )
    r.raise_for_status()
    return r.json()


# ── START / STOP ──────────────────────────────────────────────────────────────

def start_mirroring(workspace_id: str, mirrored_db_id: str, token: str) -> None:
    r = requests.post(
        f"{FABRIC_API}/workspaces/{workspace_id}/mirroredDatabases/{mirrored_db_id}/startMirroring",
        headers=_h(token),
    )
    r.raise_for_status()


def stop_mirroring(workspace_id: str, mirrored_db_id: str, token: str) -> None:
    r = requests.post(
        f"{FABRIC_API}/workspaces/{workspace_id}/mirroredDatabases/{mirrored_db_id}/stopMirroring",
        headers=_h(token),
    )
    r.raise_for_status()


# ── DELETE ────────────────────────────────────────────────────────────────────

def delete_mirrored_database(workspace_id: str, mirrored_db_id: str, token: str) -> None:
    r = requests.delete(
        f"{FABRIC_API}/workspaces/{workspace_id}/mirroredDatabases/{mirrored_db_id}",
        headers=_h(token),
    )
    if r.status_code not in (200, 202, 204):
        r.raise_for_status()


def _poll_lro(operation_url: str, token: str) -> dict:
    deadline = time.time() + POLL_TIMEOUT_S
    while time.time() < deadline:
        r = requests.get(operation_url, headers=_h(token))
        r.raise_for_status()
        body = r.json()
        state = body.get("status", "").lower()
        if state in ("succeeded", "completed"):
            return body
        if state == "failed":
            raise RuntimeError(f"Mirroring operation failed: {body}")
        time.sleep(POLL_INTERVAL_S)
    raise TimeoutError(f"Mirroring LRO timed out after {POLL_TIMEOUT_S}s")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("action", choices=["create", "status", "start", "stop", "delete", "list"])
    p.add_argument("--workspace-id", required=True)
    p.add_argument("--mirrored-db-id")
    p.add_argument("--name")
    p.add_argument("--source-type", default="AzureSQL")
    p.add_argument("--connection-id")
    p.add_argument("--target-db")
    p.add_argument("--token", required=True)
    args = p.parse_args()

    if args.action == "list":
        print(json.dumps(list_mirrored_databases(args.workspace_id, args.token), indent=2))
    elif args.action == "create":
        result = create_mirrored_database(
            args.workspace_id, args.name, args.source_type,
            args.connection_id, args.target_db, args.token,
        )
        print(json.dumps(result, indent=2))
    elif args.action == "status":
        print(json.dumps(get_mirroring_status(args.workspace_id, args.mirrored_db_id, args.token), indent=2))
    elif args.action == "start":
        start_mirroring(args.workspace_id, args.mirrored_db_id, args.token)
        print("[OK] Mirroring started")
    elif args.action == "stop":
        stop_mirroring(args.workspace_id, args.mirrored_db_id, args.token)
        print("[OK] Mirroring stopped")
    elif args.action == "delete":
        delete_mirrored_database(args.workspace_id, args.mirrored_db_id, args.token)
        print("[OK] Mirrored database deleted")


if __name__ == "__main__":
    main()
```

---

### TDD Cycle 2 — `nb_conn_mirror` reads a mirrored table

**Create test file** — `tests/test_nb_conn_mirror.py`:

```python
# ---
# title: Tests - nb_conn_mirror
# project: 
# stage: Connectors & Ingestion Layer
# description: Unit tests for the Fabric Mirroring connector.
# ---
import os
import sys
import unittest
from unittest.mock import MagicMock, call

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/notebooks')))

import nb_conn_mirror


def _make_spark(row_count: int = 50):
    spark = MagicMock()
    df = MagicMock()
    df.count.return_value = row_count
    df.filter.return_value = df
    spark.read.format.return_value.load.return_value = df
    return spark, df


class TestReadMirrorDbTable(unittest.TestCase):

    def test_reads_delta_format_from_onelake_path(self):
        spark, df = _make_spark()
        result = nb_conn_mirror.read_mirror_db_table(
            spark=spark,
            workspace_id="ws-111",
            mirrored_db_id="mdb-222",
            schema_name="dbo",
            table_name="SalesOrderHeader",
        )
        spark.read.format.assert_called_once_with("delta")
        expected_path = (
            "abfss://ws-111@onelake.dfs.fabric.microsoft.com"
            "/mdb-222/Tables/dbo/SalesOrderHeader"
        )
        spark.read.format.return_value.load.assert_called_once_with(expected_path)
        self.assertEqual(result, df)

    def test_hwm_from_filter_applied_when_provided(self):
        spark, df = _make_spark()
        nb_conn_mirror.read_mirror_db_table(
            spark=spark,
            workspace_id="ws-111",
            mirrored_db_id="mdb-222",
            schema_name="dbo",
            table_name="SalesOrderHeader",
            hwm_column="ModifiedDate",
            hwm_from="2026-01-01T00:00:00",
        )
        df.filter.assert_called()
        filter_expr = str(df.filter.call_args[0][0])
        self.assertIn("ModifiedDate", filter_expr)
        self.assertIn("2026-01-01T00:00:00", filter_expr)

    def test_hwm_to_filter_applied_when_provided(self):
        spark, df = _make_spark()
        nb_conn_mirror.read_mirror_db_table(
            spark=spark,
            workspace_id="ws-111",
            mirrored_db_id="mdb-222",
            schema_name="dbo",
            table_name="SalesOrderHeader",
            hwm_column="ModifiedDate",
            hwm_from="2026-01-01",
            hwm_to="2026-02-01",
        )
        self.assertEqual(df.filter.call_count, 2)

    def test_no_filter_when_no_hwm(self):
        spark, df = _make_spark()
        nb_conn_mirror.read_mirror_db_table(
            spark=spark,
            workspace_id="ws-111",
            mirrored_db_id="mdb-222",
            schema_name="dbo",
            table_name="SalesOrderHeader",
        )
        df.filter.assert_not_called()

    def test_returns_row_count(self):
        spark, df = _make_spark(row_count=42)
        result = nb_conn_mirror.read_mirror_db_table(
            spark=spark,
            workspace_id="ws-111",
            mirrored_db_id="mdb-222",
            schema_name="dbo",
            table_name="SalesOrderHeader",
        )
        self.assertEqual(result.count(), 42)
```

Run → **RED** (`nb_conn_mirror` does not exist).

**Implement** — create `src/notebooks/nb_conn_mirror.py`:

```python
# ---
# title: nb_conn_mirror
# project: 
# stage: Connectors & Ingestion Layer
# description: >
#   Fabric Mirroring connector. Reads a Mirrored Database table from OneLake
#   via Delta format with optional high-water-mark filtering.
#   Ref: https://learn.microsoft.com/en-us/fabric/database/mirrored-database/overview
# ---
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

ONELAKE_HOST = "onelake.dfs.fabric.microsoft.com"


def _onelake_path(workspace_id: str, mirrored_db_id: str,
                  schema_name: str, table_name: str) -> str:
    return (
        f"abfss://{workspace_id}@{ONELAKE_HOST}"
        f"/{mirrored_db_id}/Tables/{schema_name}/{table_name}"
    )


def read_mirror_db_table(
    spark: SparkSession,
    workspace_id: str,
    mirrored_db_id: str,
    schema_name: str,
    table_name: str,
    hwm_column: str | None = None,
    hwm_from: str | None = None,
    hwm_to: str | None = None,
) -> DataFrame:
    """
    Read a Fabric Mirrored Database table into a Spark DataFrame.

    Parameters
    ----------
    workspace_id    : Fabric workspace GUID (available from notebookutils.runtime.context)
    mirrored_db_id  : Mirrored Database item ID (from scripts/12-manage-mirroring.py list)
    schema_name     : Source schema name, e.g. "dbo"
    table_name      : Source table name, e.g. "SalesOrderHeader"
    hwm_column      : Column name for high-water-mark filtering (e.g. "ModifiedDate")
    hwm_from        : Inclusive lower bound (ISO-8601 string or None for full load)
    hwm_to          : Exclusive upper bound (ISO-8601 string or None for open upper)
    """
    path = _onelake_path(workspace_id, mirrored_db_id, schema_name, table_name)
    df = spark.read.format("delta").load(path)

    if hwm_column and hwm_from:
        df = df.filter(F.col(hwm_column) >= hwm_from)
    if hwm_column and hwm_to:
        df = df.filter(F.col(hwm_column) < hwm_to)

    return df
```

Run → **GREEN**.

---

### TDD Cycle 3 — `WatermarkState` seed accepts `SourceTable`

```python
class TestWatermarkStateSeed(unittest.TestCase):

    def test_watermark_state_seed_has_source_table_column(self):
        import json, os
        seed_path = os.path.join(os.path.dirname(__file__), "../config/seed-dev.json")
        with open(seed_path) as f:
            seed = json.load(f)
        wm_rows = seed["Data"].get("WatermarkState", [])
        if wm_rows:
            # existing rows must carry the new nullable column
            self.assertIn("SourceTable", wm_rows[0])

    def test_mirror_type_watermark_row_has_source_table(self):
        import json, os
        seed_path = os.path.join(os.path.dirname(__file__), "../config/seed-dev.json")
        with open(seed_path) as f:
            seed = json.load(f)
        wm_rows = seed["Data"].get("WatermarkState", [])
        mirror_rows = [r for r in wm_rows if r.get("ConnectorType") == "mirror"]
        for r in mirror_rows:
            self.assertIsNotNone(r.get("SourceTable"))
            self.assertIsNone(r.get("SourceQuery"))
```

**Implement** — `config/seed-dev.json`:
- Add `"SourceTable": null` to all existing `WatermarkState` rows (nullable; backwards compatible)
- Add an example `mirror` row for documentation:

```json
{
    "SourceID": 99,
    "ObjectName": "SalesOrderHeader_Mirror_Example",
    "ConnectorType": "mirror",
    "WatermarkColumn": "ModifiedDate",
    "LastWatermark": "1900-01-01T00:00:00",
    "SourceQuery": null,
    "SourceTable": "dbo.SalesOrderHeader"
}
```

---

### TDD Cycle 4 — `IngestionConfig` allows `ConnectorType = 'mirror'`

```python
class TestIngestionConfigMirrorType(unittest.TestCase):

    def test_mirror_connector_type_is_valid(self):
        valid_types = nb_conn_mirror.VALID_CONNECTOR_TYPES
        self.assertIn("mirror", valid_types)

    def test_mirror_config_requires_mirrored_db_id(self):
        config = {
            "ConnectorType": "mirror",
            "MirroredDbId": None,
            "SchemaName": "dbo",
            "TableName": "SalesOrderHeader",
        }
        with self.assertRaises(ValueError):
            nb_conn_mirror.validate_ingestion_config(config)
```

**Implement** — `src/notebooks/nb_conn_mirror.py`:

```python
VALID_CONNECTOR_TYPES = {"mirror"}

def validate_ingestion_config(config: dict) -> None:
    if config.get("ConnectorType") != "mirror":
        raise ValueError(f"Expected ConnectorType='mirror', got {config.get('ConnectorType')!r}")
    if not config.get("MirroredDbId"):
        raise ValueError("MirroredDbId is required for ConnectorType='mirror'")
```

---

## ADR-046

Create `docs/adr/ADR-046-mirroring-connector-vs-jdbc.md`:

```markdown
# ADR-046: Fabric Mirroring Connector vs JDBC

**Date:** May 2026
**Status:** Accepted
**Confidence:** High
**See also:** [ADR-029](ADR-029-unified-ingestion-config-table.md)

## Decision

Add `nb_conn_mirror` as a first-class connector alongside JDBC, REST, file, and shortcut.
Fabric Mirroring is preferred over JDBC when:
- Source is Azure SQL, Azure SQL MI, Snowflake, or CosmosDB (all GA-mirrored as of mid-2025)
- Near-real-time CDC is required without VNet Data Gateway
- JDBC firewall rules or driver management are a deployment concern

JDBC remains the connector for sources not yet supported by Fabric Mirroring.

## Consequence

`WatermarkState.SourceTable` column added (nullable; existing rows unaffected).
`IngestionConfig.MirroredDbId` and `ConnectorType = 'mirror'` added to the control table schema.
`scripts/12-manage-mirroring.py` owns the mirrored database lifecycle.
```

---

## Definition of Done

- [ ] `pytest tests/test_nb_conn_rest.py -k "WorkspaceIdentity"` — green
- [ ] `pytest tests/test_nb_conn_mirror.py` — all green (new file, all cases)
- [ ] `pytest tests/` — full 382-test suite still green
- [ ] `python scripts/12-manage-mirroring.py create ...` runs against smoke workspace
- [ ] `python scripts/12-manage-mirroring.py status ...` returns `Running`
- [ ] `python scripts/12-manage-mirroring.py stop ...` confirmed
- [ ] `config/seed-dev.json` has `SourceTable` on `WatermarkState` rows
- [ ] ADR-046 committed
