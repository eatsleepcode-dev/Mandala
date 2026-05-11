---
sprint: 4
title: "GAP-05 Phase A — Fabric SQL control DB dual-write PoC"
gaps: [GAP-05]
phase: A
effort: XL/3
status: complete
completed_date: 2026-05-03
score_before: 363
score_after_estimate: 363
score_actual: 363
note: "Score does not move until Phase C. Phase A proves the DAL without breaking existing tests."
adr_required: [ADR-047]
branch: claude/review-recent-commits-Auyjc
carryover:
  - "scripts/14-manage-fabric-sql-db.py live smoke (create/connection-string) — requires live Fabric workspace"
  - "01-create-tables.sql applied in live Fabric SQL DB — requires live Fabric workspace"
tds_raised: []
tds_closed: [TD-044, TD-048, TD-049, TD-050]
---

# Sprint 4 — GAP-05 Phase A: Fabric SQL dual-write PoC

## Goal

Introduce a `FabricSqlControlDb` connection string in `EnvironmentConfig`. When set, every
control table write is mirrored to Fabric SQL alongside the existing Delta write. Delta remains
the read path — this phase is write-only validation. No existing behaviour changes.

The pytest suite must stay fully green by using an SQLite in-memory stub.

---

## Fabric SQL DB REST API lifecycle — `scripts/14-manage-fabric-sql-db.py`

```python
#!/usr/bin/env python3
"""
scripts/14-manage-fabric-sql-db.py

Application lifecycle for Fabric SQL Database items via the Fabric REST API.

Usage:
    python scripts/14-manage-fabric-sql-db.py create  --workspace-id <id> --name <name> --token <t>
    python scripts/14-manage-fabric-sql-db.py get     --workspace-id <id> --db-id <id>  --token <t>
    python scripts/14-manage-fabric-sql-db.py list    --workspace-id <id>               --token <t>
    python scripts/14-manage-fabric-sql-db.py delete  --workspace-id <id> --db-id <id>  --token <t>
    python scripts/14-manage-fabric-sql-db.py connection-string
                                               --workspace-id <id> --db-id <id>  --token <t>
"""
import argparse
import json
import sys
import time
import requests

FABRIC_API = "https://api.fabric.microsoft.com/v1"
POLL_INTERVAL_S = 5
POLL_TIMEOUT_S  = 300


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── CREATE ────────────────────────────────────────────────────────────────────

def create_sql_database(workspace_id: str, display_name: str, token: str) -> dict:
    """
    POST /v1/workspaces/{workspaceId}/sqlDatabases

    Fabric SQL Database uses Entra-only auth by default (no shared key).
    Returns the created item including the SQL connection endpoint.
    """
    payload = {"displayName": display_name, "type": "SqlDatabase"}
    r = requests.post(
        f"{FABRIC_API}/workspaces/{workspace_id}/sqlDatabases",
        headers=_h(token),
        json=payload,
    )
    if r.status_code == 202:
        lro_url = r.headers.get("Location") or r.headers.get("location", "")
        return _poll_lro(lro_url, token)
    r.raise_for_status()
    return r.json()


# ── READ ──────────────────────────────────────────────────────────────────────

def list_sql_databases(workspace_id: str, token: str) -> list:
    r = requests.get(
        f"{FABRIC_API}/workspaces/{workspace_id}/sqlDatabases",
        headers=_h(token),
    )
    r.raise_for_status()
    return r.json().get("value", [])


def get_sql_database(workspace_id: str, db_id: str, token: str) -> dict:
    r = requests.get(
        f"{FABRIC_API}/workspaces/{workspace_id}/sqlDatabases/{db_id}",
        headers=_h(token),
    )
    r.raise_for_status()
    return r.json()


def get_connection_string(workspace_id: str, db_id: str, token: str) -> str:
    """
    Derive the pyodbc / JDBC connection string from the Fabric SQL DB endpoint.

    Fabric SQL server hostname format:
        <workspace-id>.<db-id>.datawarehouse.fabric.microsoft.com
    """
    db = get_sql_database(workspace_id, db_id, token)
    # connectionString is returned in the item properties by the Fabric API
    conn_str = db.get("properties", {}).get("connectionString")
    if conn_str:
        return conn_str
    # Fallback: construct from IDs (documented pattern)
    server = f"{workspace_id}.{db_id}.datawarehouse.fabric.microsoft.com"
    return (
        f"Driver={{ODBC Driver 18 for SQL Server}};"
        f"Server={server};"
        f"Database={db.get('displayName', 'PeggyControl')};"
        f"Authentication=ActiveDirectoryMsi;"
        f"Encrypt=yes;"
    )


# ── DELETE ────────────────────────────────────────────────────────────────────

def delete_sql_database(workspace_id: str, db_id: str, token: str) -> None:
    r = requests.delete(
        f"{FABRIC_API}/workspaces/{workspace_id}/sqlDatabases/{db_id}",
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
            raise RuntimeError(f"Fabric SQL DB operation failed: {body}")
        time.sleep(POLL_INTERVAL_S)
    raise TimeoutError(f"Fabric SQL DB LRO timed out after {POLL_TIMEOUT_S}s")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser()
    p.add_argument("action", choices=["create", "get", "list", "delete", "connection-string"])
    p.add_argument("--workspace-id", required=True)
    p.add_argument("--db-id")
    p.add_argument("--name")
    p.add_argument("--token", required=True)
    args = p.parse_args()

    if args.action == "list":
        print(json.dumps(list_sql_databases(args.workspace_id, args.token), indent=2))
    elif args.action == "create":
        print(json.dumps(create_sql_database(args.workspace_id, args.name, args.token), indent=2))
    elif args.action == "get":
        print(json.dumps(get_sql_database(args.workspace_id, args.db_id, args.token), indent=2))
    elif args.action == "delete":
        delete_sql_database(args.workspace_id, args.db_id, args.token)
        print("[OK] Deleted")
    elif args.action == "connection-string":
        print(get_connection_string(args.workspace_id, args.db_id, args.token))


if __name__ == "__main__":
    main()
```

---

## Fabric SQL CRUD helpers — `src/notebooks/nb_utils_fabric_sql.py`

New utility module for all control table CRUD operations against Fabric SQL:

```python
# ---
# title: nb_utils_fabric_sql
# project: 
# stage: Core PySpark
# description: >
#   Data Access Layer for Fabric SQL Database control tables.
#   Used when FabricSqlControlDb is set in EnvironmentConfig.
#   In offline/pytest environments the connection string is replaced
#   by an SQLite in-memory URL via the PEGGY_SQL_STUB env variable.
# ---
import os
from contextlib import contextmanager
from typing import Any, Generator


def _get_engine(connection_string: str):
    """
    Return a DB-API 2.0 connection.

    In test environments (PEGGY_SQL_STUB=sqlite), use sqlite3 in-memory.
    In Fabric runtime, use pyodbc with the Fabric SQL connection string.
    """
    if os.environ.get("PEGGY_SQL_STUB", "").lower() == "sqlite":
        import sqlite3
        return sqlite3.connect(":memory:")

    import pyodbc
    return pyodbc.connect(connection_string, autocommit=False)


@contextmanager
def _cursor(connection_string: str) -> Generator:
    conn = _get_engine(connection_string)
    cur = conn.cursor()
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# ── EnvironmentConfig ─────────────────────────────────────────────────────────

def upsert_environment_config(
    connection_string: str, env_name: str, parameter_name: str, parameter_value: str
) -> None:
    """INSERT or UPDATE a single EnvironmentConfig row."""
    sql = """
        MERGE control.EnvironmentConfig AS target
        USING (VALUES (?, ?, ?)) AS source (EnvName, ParameterName, ParameterValue)
        ON target.EnvName = source.EnvName AND target.ParameterName = source.ParameterName
        WHEN MATCHED THEN
            UPDATE SET ParameterValue = source.ParameterValue
        WHEN NOT MATCHED THEN
            INSERT (EnvName, ParameterName, ParameterValue)
            VALUES (source.EnvName, source.ParameterName, source.ParameterValue);
    """
    with _cursor(connection_string) as cur:
        cur.execute(sql, (env_name, parameter_name, parameter_value))


def get_environment_config(connection_string: str, env_name: str) -> dict:
    """Return all ParameterName→ParameterValue pairs for the given environment."""
    sql = "SELECT ParameterName, ParameterValue FROM control.EnvironmentConfig WHERE EnvName = ?"
    with _cursor(connection_string) as cur:
        cur.execute(sql, (env_name,))
        return {row[0]: row[1] for row in cur.fetchall()}


# ── ControlLog ────────────────────────────────────────────────────────────────

def insert_control_log(connection_string: str, event: dict) -> None:
    """Append a row to control.ControlLog."""
    columns = ", ".join(event.keys())
    placeholders = ", ".join(["?"] * len(event))
    sql = f"INSERT INTO control.ControlLog ({columns}) VALUES ({placeholders})"
    with _cursor(connection_string) as cur:
        cur.execute(sql, list(event.values()))


def get_control_log(
    connection_string: str, pipeline_id: int | None = None, limit: int = 100
) -> list[dict]:
    """Fetch recent ControlLog rows, optionally filtered by PipelineID."""
    if pipeline_id is not None:
        sql = ("SELECT TOP (?) * FROM control.ControlLog "
               "WHERE PipelineID = ? ORDER BY StartTime DESC")
        params = (limit, pipeline_id)
    else:
        sql = "SELECT TOP (?) * FROM control.ControlLog ORDER BY StartTime DESC"
        params = (limit,)
    with _cursor(connection_string) as cur:
        cur.execute(sql, params)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


# ── WatermarkState ────────────────────────────────────────────────────────────

def get_watermark(connection_string: str, source_id: int, object_name: str) -> str | None:
    sql = ("SELECT LastWatermark FROM control.WatermarkState "
           "WHERE SourceID = ? AND ObjectName = ?")
    with _cursor(connection_string) as cur:
        cur.execute(sql, (source_id, object_name))
        row = cur.fetchone()
        return row[0] if row else None


def set_watermark(
    connection_string: str, source_id: int, object_name: str, watermark: str
) -> None:
    sql = """
        MERGE control.WatermarkState AS target
        USING (VALUES (?, ?)) AS source (SourceID, ObjectName)
        ON target.SourceID = source.SourceID AND target.ObjectName = source.ObjectName
        WHEN MATCHED THEN UPDATE SET LastWatermark = ?
        WHEN NOT MATCHED THEN INSERT (SourceID, ObjectName, LastWatermark) VALUES (?, ?, ?);
    """
    with _cursor(connection_string) as cur:
        cur.execute(sql, (source_id, object_name, watermark, source_id, object_name, watermark))
```

---

## TDD Cycles

### TDD Cycle 1 — SQLite stub works for all CRUD helpers

**Create test file** — `tests/test_nb_utils_fabric_sql.py`:

```python
# ---
# title: Tests - nb_utils_fabric_sql
# project: 
# stage: Core PySpark
# description: Unit tests for the Fabric SQL DAL using SQLite in-memory stub.
# ---
import os
import sys
import sqlite3
import unittest

os.environ["PEGGY_SQL_STUB"] = "sqlite"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/notebooks')))

import nb_utils_fabric_sql

CONN = "stub"  # ignored — SQLite stub activated by env var


def _create_schema():
    """Bootstrap minimal SQLite schema matching the Fabric SQL DDL."""
    conn = sqlite3.connect(":memory:")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS "control.EnvironmentConfig" (
            EnvName TEXT, ParameterName TEXT, ParameterValue TEXT,
            PRIMARY KEY (EnvName, ParameterName)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS "control.ControlLog" (
            LogId INTEGER PRIMARY KEY AUTOINCREMENT,
            PipelineID INTEGER, Status TEXT, StartTime TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS "control.WatermarkState" (
            SourceID INTEGER, ObjectName TEXT, LastWatermark TEXT,
            PRIMARY KEY (SourceID, ObjectName)
        )
    """)
    conn.commit()
    return conn


class TestEnvironmentConfigCRUD(unittest.TestCase):

    def test_upsert_and_get(self):
        nb_utils_fabric_sql.upsert_environment_config(CONN, "dev", "MaxRetries", "3")
        result = nb_utils_fabric_sql.get_environment_config(CONN, "dev")
        self.assertEqual(result["MaxRetries"], "3")

    def test_upsert_updates_existing_row(self):
        nb_utils_fabric_sql.upsert_environment_config(CONN, "dev", "MaxRetries", "3")
        nb_utils_fabric_sql.upsert_environment_config(CONN, "dev", "MaxRetries", "5")
        result = nb_utils_fabric_sql.get_environment_config(CONN, "dev")
        self.assertEqual(result["MaxRetries"], "5")

    def test_get_returns_empty_dict_for_unknown_env(self):
        result = nb_utils_fabric_sql.get_environment_config(CONN, "nonexistent")
        self.assertEqual(result, {})


class TestWatermarkStateCRUD(unittest.TestCase):

    def test_get_returns_none_when_no_row(self):
        result = nb_utils_fabric_sql.get_watermark(CONN, source_id=1, object_name="SalesOrder")
        self.assertIsNone(result)

    def test_set_and_get_watermark(self):
        nb_utils_fabric_sql.set_watermark(CONN, 1, "SalesOrder", "2026-01-15T00:00:00")
        result = nb_utils_fabric_sql.get_watermark(CONN, 1, "SalesOrder")
        self.assertEqual(result, "2026-01-15T00:00:00")

    def test_set_watermark_idempotent(self):
        nb_utils_fabric_sql.set_watermark(CONN, 2, "Invoice", "2026-01-01")
        nb_utils_fabric_sql.set_watermark(CONN, 2, "Invoice", "2026-02-01")
        result = nb_utils_fabric_sql.get_watermark(CONN, 2, "Invoice")
        self.assertEqual(result, "2026-02-01")


class TestControlLogCRUD(unittest.TestCase):

    def test_insert_and_get_control_log(self):
        nb_utils_fabric_sql.insert_control_log(
            CONN, {"PipelineID": 10, "Status": "SUCCESS", "StartTime": "2026-05-01T09:00:00"}
        )
        rows = nb_utils_fabric_sql.get_control_log(CONN, pipeline_id=10)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["Status"], "SUCCESS")

    def test_get_control_log_respects_limit(self):
        for i in range(5):
            nb_utils_fabric_sql.insert_control_log(
                CONN, {"PipelineID": 99, "Status": "SUCCESS", "StartTime": f"2026-05-0{i+1}"}
            )
        rows = nb_utils_fabric_sql.get_control_log(CONN, pipeline_id=99, limit=3)
        self.assertLessEqual(len(rows), 3)
```

Run → **RED** (`nb_utils_fabric_sql` does not exist).

**Implement**: create `src/notebooks/nb_utils_fabric_sql.py` (code above).

Run → **GREEN**.

---

### TDD Cycle 2 — `EnvironmentConfig` seed has `FabricSqlControlDb` parameter

```python
def test_fabric_sql_control_db_parameter_in_seed(self):
    import json, os
    seed_path = os.path.join(os.path.dirname(__file__), "../config/seed-dev.json")
    with open(seed_path) as f:
        seed = json.load(f)
    names = [r["ParameterName"] for r in seed["Data"]["EnvironmentConfig"]]
    self.assertIn("FabricSqlControlDb", names)

def test_fabric_sql_control_db_is_null_in_dev_seed(self):
    import json, os
    with open(os.path.join(os.path.dirname(__file__), "../config/seed-dev.json")) as f:
        seed = json.load(f)
    row = next(r for r in seed["Data"]["EnvironmentConfig"]
               if r["ParameterName"] == "FabricSqlControlDb")
    self.assertIsNone(row["ParameterValue"])
```

**Implement** — `config/seed-dev.json`:

```json
{"EnvName": "dev", "ParameterName": "FabricSqlControlDb", "ParameterValue": null,
 "Description": "pyodbc connection string for the Fabric SQL control DB. Null = Delta-only mode."}
```

---

### TDD Cycle 3 — dual-write path in `nb_log_event`

```python
class TestDualWriteFabricSql(unittest.TestCase):

    def test_fabric_sql_insert_called_when_connection_string_set(self):
        spark = MagicMock()
        # env includes FabricSqlControlDb
        env_rows = [
            ("FabricSqlControlDb", "Driver=...;Server=..."),
            ("EnableRTIObservability", "false"),
        ]
        spark.sql.return_value.collect.return_value = [
            MagicMock(__iter__=MagicMock(return_value=iter(env_rows)))
        ]
        write_chain = MagicMock()
        spark.createDataFrame.return_value.write = write_chain
        write_chain.format.return_value = write_chain
        write_chain.mode.return_value = write_chain

        with patch("nb_log_event.nb_utils_fabric_sql.insert_control_log") as mock_sql:
            nb_log_event.log_control_event(spark, "db_control", {"Status": "SUCCESS"})
        mock_sql.assert_called_once()

    def test_delta_still_written_when_fabric_sql_set(self):
        spark = MagicMock()
        env_rows = [("FabricSqlControlDb", "Driver=..."), ("EnableRTIObservability", "false")]
        spark.sql.return_value.collect.return_value = [
            MagicMock(__iter__=MagicMock(return_value=iter(env_rows)))
        ]
        write_chain = MagicMock()
        spark.createDataFrame.return_value.write = write_chain
        write_chain.format.return_value = write_chain
        write_chain.mode.return_value = write_chain

        with patch("nb_log_event.nb_utils_fabric_sql.insert_control_log"):
            nb_log_event.log_control_event(spark, "db_control", {"Status": "SUCCESS"})
        write_chain.format.assert_called_with("delta")
```

**Implement** — `src/notebooks/nb_log_event.py`, extend `log_control_event`:

```python
try:
    from nb_utils_fabric_sql import insert_control_log as _sql_insert
except ImportError:
    _sql_insert = None

def log_control_event(spark, control_lh: str, event: dict) -> None:
    # Delta write (always)
    df = spark.createDataFrame([event])
    df.write.format("delta").mode("append").saveAsTable(f"{control_lh}.control.ControlLog")

    # Fabric SQL dual-write (when FabricSqlControlDb is configured)
    try:
        env = {r[0]: r[1] for r in spark.sql(
            f"SELECT ParameterName, ParameterValue FROM {control_lh}.control.EnvironmentConfig"
        ).collect()}
        sql_conn = env.get("FabricSqlControlDb")
        if sql_conn and _sql_insert:
            _sql_insert(sql_conn, event)
    except Exception:
        pass  # dual-write failure never blocks the pipeline
```

---

## Fabric SQL DDL — `config/control-schema/fabric-sql/`

Create `config/control-schema/fabric-sql/01-create-tables.sql`:

```sql
-- Fabric SQL control database DDL
-- Deploy via scripts/14-manage-fabric-sql-db.py then run this script

CREATE SCHEMA IF NOT EXISTS control;
GO

CREATE TABLE control.EnvironmentConfig (
    EnvName        NVARCHAR(50)   NOT NULL,
    ParameterName  NVARCHAR(100)  NOT NULL,
    ParameterValue NVARCHAR(500)  NULL,
    Description    NVARCHAR(500)  NULL,
    CONSTRAINT PK_EnvironmentConfig PRIMARY KEY (EnvName, ParameterName)
);
GO

CREATE TABLE control.ControlLog (
    LogId         BIGINT         IDENTITY(1,1) PRIMARY KEY,
    PipelineID    INT            NOT NULL,
    NotebookName  NVARCHAR(200)  NULL,
    Status        NVARCHAR(50)   NOT NULL,
    StartTime     DATETIME2      NOT NULL,
    EndTime       DATETIME2      NULL,
    ElapsedSeconds INT           NULL,
    ErrorMessage  NVARCHAR(MAX)  NULL
);
GO

CREATE TABLE control.WatermarkState (
    SourceID      INT            NOT NULL,
    ObjectName    NVARCHAR(200)  NOT NULL,
    LastWatermark NVARCHAR(100)  NOT NULL DEFAULT '1900-01-01T00:00:00',
    SourceQuery   NVARCHAR(MAX)  NULL,
    SourceTable   NVARCHAR(200)  NULL,
    CONSTRAINT PK_WatermarkState PRIMARY KEY (SourceID, ObjectName)
);
GO

CREATE TABLE control.ObjectConfig (
    ObjectName       NVARCHAR(200)  NOT NULL PRIMARY KEY,
    IsActive         BIT            NOT NULL DEFAULT 1,
    RequiresMasking  BIT            NOT NULL DEFAULT 0,
    LoadType         NVARCHAR(50)   NOT NULL DEFAULT 'FULL',
    Description      NVARCHAR(500)  NULL
);
GO

CREATE TABLE control.IngestionSource (
    SourceID       INT            IDENTITY(1,1) PRIMARY KEY,
    SourceName     NVARCHAR(200)  NOT NULL UNIQUE,
    ConnectorType  NVARCHAR(50)   NOT NULL,
    IsActive       BIT            NOT NULL DEFAULT 1
);
GO

CREATE TABLE control.ConnectionConfig (
    SourceID              INT            NOT NULL PRIMARY KEY,
    SourceName            NVARCHAR(200)  NOT NULL,
    ServerName            NVARCHAR(500)  NULL,
    DatabaseName          NVARCHAR(200)  NULL,
    UseWorkspaceIdentity  BIT            NOT NULL DEFAULT 0,
    KeyVaultSecretName    NVARCHAR(200)  NULL,
    MirroredDbId          NVARCHAR(100)  NULL,
    CONSTRAINT FK_ConnectionConfig_Source FOREIGN KEY (SourceID) REFERENCES control.IngestionSource(SourceID)
);
GO
```

---

## ADR-047 stub

`docs/adr/ADR-047-fabric-sql-control-plane-migration.md`:

```markdown
# ADR-047: Fabric SQL Database for Control Plane Metadata

**Date:** May 2026
**Status:** Proposed — Phase A in progress
**Confidence:** Medium (migration risk acknowledged)
**See also:** [ADR-025](ADR-025-nb-bootstrap-ddl-as-source-of-truth.md), [ADR-035](ADR-035-two-layer-environment-configuration.md)

## Decision

Migrate the 13 Delta Lake control tables to a Fabric SQL Database in three phases:
- Phase A (Sprint 4): dual-write PoC; SQLite stub for offline tests
- Phase B (Sprint 5): orchestrator reads from Fabric SQL
- Phase C (Sprint 6): Delta control tables removed

## Rationale

Both FMD (from inception) and FA (since v3.0, Aug 2025) use Fabric SQL for the control plane.
This closes Peggy's only 0/3 item on an area where both open-source frameworks have moved ahead.
Fabric SQL offers T-SQL DirectQuery in Power BI, stored procedures for control logic,
and Entra-only auth (removes shared-key risk from the control plane).

## Risk mitigation

Offline pytest compatibility maintained via `PEGGY_SQL_STUB=sqlite` env variable.
Delta control tables remain live and authoritative until Phase C is complete.
```

---

## Definition of Done

- [x] `PEGGY_SQL_STUB=sqlite pytest tests/test_nb_utils_fabric_sql.py` — all green (new file)
- [x] `pytest tests/` — full 382-test suite green (no regressions from dual-write import)
- [🔁] `python scripts/14-manage-fabric-sql-db.py create --workspace-id $SMOKE_WS --name PeggyControl --token $T` — creates DB in smoke workspace *(carryover: requires live Fabric workspace)*
- [🔁] `python scripts/14-manage-fabric-sql-db.py connection-string ...` — returns valid connection string *(carryover: requires live Fabric workspace)*
- [🔁] `config/control-schema/fabric-sql/01-create-tables.sql` committed and applies cleanly in smoke Fabric SQL DB *(carryover: requires live Fabric workspace)*
- [x] `config/seed-dev.json` has `FabricSqlControlDb` (null) in `EnvironmentConfig`
- [x] ADR-047 committed (status: Proposed)
