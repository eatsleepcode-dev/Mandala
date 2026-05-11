---
sprint: 1
title: "GAP-02 queue isolation + GAP-01 workspace identity (start)"
gaps: [GAP-02, GAP-01]
effort: S + M
status: complete
completed_date: 2026-05-02
score_before: 325
score_after_estimate: 338
score_actual: 338
adr_required: [ADR-045]
branch: claude/review-recent-commits-Auyjc
carryover:
  - "GAP-01 nb_conn_rest.py WI support → Sprint 2 (planned)"
  - "scripts/11-provision-workspace-identity.py smoke test → Sprint 2 prerequisite (blocked: live workspace)"
tds_raised: [TD-039, TD-040, TD-041, TD-042, TD-043, TD-044, TD-045, TD-046, TD-047]
tds_closed: []
---

# Sprint 1 — Queue isolation + Workspace Identity

## Goals

| Gap | Deliverable | Done when |
|-----|-------------|-----------|
| GAP-02 | `workspace_guid` flows through `build_dag` → `run_pipeline` → ADO pipeline | Existing `test_nb_orchestrator.py` green + 2 new tests green |
| GAP-01 | `use_workspace_identity` flag in `ConnectionConfig`; `nb_conn_jdbc` honours it | 3 new tests in `test_nb_conn_jdbc.py` green |
| GAP-01 | `scripts/11-provision-workspace-identity.py` — full Fabric REST API lifecycle | Script runs against live workspace in smoke env |
| ADR-045 | Decision record: Workspace Identity vs Service Principal | File committed |

---

## Prerequisite check (automated)

Add to `scripts/11-provision-workspace-identity.py` (built in this sprint) — run once before Sprint 1 dev:

```python
import requests, os

FABRIC_API = "https://api.fabric.microsoft.com/v1"

def get_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def get_workspace_identity(workspace_id: str, token: str) -> dict | None:
    """Return the workspace identity object, or None if not provisioned."""
    r = requests.get(f"{FABRIC_API}/workspaces/{workspace_id}", headers=get_headers(token))
    r.raise_for_status()
    return r.json().get("workspaceIdentity")
```

---

## GAP-02 — Parallel Dev/Prod queue isolation

### TDD Cycle 1 — `build_dag` injects `WorkspaceGuid` into every activity

**Write test first** — `tests/test_nb_orchestrator.py`, class `TestBuildDagWorkspaceGuid`:

```python
class TestBuildDagWorkspaceGuid(unittest.TestCase):

    def _step(self, name="nb_conn_jdbc"):
        return {
            "NotebookName": name, "DependsOn": None,
            "TimeoutPerCellSeconds": 90, "RetryCount": 0,
            "RetryIntervalSeconds": 10, "Parameters": None,
        }

    def test_workspace_guid_injected_into_activity_arguments(self):
        steps = [self._step("nb_conn_jdbc"), self._step("nb_bronze_to_silver")]
        dag = nb_orchestrator.build_dag(
            steps, pipeline_id=10, control_lh="db_control",
            workspace_guid="ws-abc-123",
        )
        for activity in dag["activities"]:
            self.assertEqual(activity["arguments"]["WorkspaceGuid"], "ws-abc-123")

    def test_workspace_guid_empty_string_when_omitted(self):
        steps = [self._step()]
        dag = nb_orchestrator.build_dag(steps, pipeline_id=10, control_lh="db_control")
        self.assertEqual(dag["activities"][0]["arguments"]["WorkspaceGuid"], "")
```

Run → **RED** (`build_dag` has no `workspace_guid` parameter).

**Implement** — `src/notebooks/nb_orchestrator.py`, `build_dag` signature:

```python
def build_dag(steps: list, pipeline_id: int, control_lh: str,
              landing_lh: str = "", spark=None,
              workspace_guid: str = "") -> dict:   # <-- add this param
    ...
    # In the params dict assembled for each activity, add:
    base_params = {
        "PipelineID":       str(pipeline_id),
        "ControlLakehouse": control_lh,
        "LandingLakehouse": landing_lh,
        "WorkspaceGuid":    workspace_guid,     # <-- inject here
    }
```

Run → **GREEN**.

---

### TDD Cycle 2 — `run_pipeline` reads `WorkspaceGuid` from `EnvironmentConfig` and forwards it

**Write test** — `tests/test_nb_orchestrator.py`, class `TestRunPipelineWorkspaceGuid`:

```python
class TestRunPipelineWorkspaceGuid(unittest.TestCase):

    def _make_spark_with_env(self, workspace_guid="ws-env-guid"):
        spark = MagicMock()
        # EnvVariables row contains WorkspaceGuid
        env_row = MagicMock()
        env_row.__iter__ = MagicMock(return_value=iter([
            ("WorkspaceGuid", workspace_guid),
            ("MaxRetries", "0"),
        ]))
        step_row = {
            "NotebookName": "nb_conn_jdbc", "DependsOn": None,
            "TimeoutPerCellSeconds": 90, "RetryCount": 0,
            "RetryIntervalSeconds": 10, "Parameters": None,
            "ExecutionOrder": 1,
        }
        spark.sql.return_value.collect.side_effect = [
            [env_row],    # EnvVariables
            [step_row],   # RunbookSteps
        ]
        return spark

    @patch("nb_orchestrator.log_execution_start", return_value=1)
    @patch("nb_orchestrator.log_execution_end")
    @patch("nb_orchestrator.build_dag")
    def test_workspace_guid_from_env_passed_to_build_dag(
        self, mock_build_dag, mock_end, mock_start
    ):
        mock_build_dag.return_value = {"activities": []}
        spark = self._make_spark_with_env("ws-from-env")
        orch = MagicMock()
        nb_orchestrator.run_pipeline(spark, orch, "db_control", pipeline_id=10)
        _, kwargs = mock_build_dag.call_args
        self.assertEqual(kwargs.get("workspace_guid") or mock_build_dag.call_args[0][4], "ws-from-env")
```

Run → **RED**.

**Implement** — `src/notebooks/nb_orchestrator.py`, `run_pipeline`:

```python
def run_pipeline(spark, orch, control_lh: str, pipeline_id: int) -> dict:
    env = get_config(spark, control_lh, "EnvVariables") or {}
    workspace_guid = env.get("WorkspaceGuid", "")
    ...
    # Pass workspace_guid to build_dag (if using DAG path) or inject into
    # each step's params dict in the sequential path:
    for step in steps_sorted:
        params = {
            "PipelineID":       str(pipeline_id),
            "ControlLakehouse": control_lh,
            "WorkspaceGuid":    workspace_guid,
        }
```

Run → **GREEN**.

---

### TDD Cycle 3 — `EnvironmentConfig` seed contains `WorkspaceGuid` row

**Write test** — `tests/test_nb_orchestrator.py`:

```python
def test_seed_dev_contains_workspace_guid_parameter(self):
    import json, os
    seed_path = os.path.join(os.path.dirname(__file__), "../config/seed-dev.json")
    with open(seed_path) as f:
        seed = json.load(f)
    env_rows = seed["Data"]["EnvironmentConfig"]
    names = [r["ParameterName"] for r in env_rows]
    self.assertIn("WorkspaceGuid", names)
```

Run → **RED** (seed file lacks the row).

**Implement** — `config/seed-dev.json`, add to `EnvironmentConfig` array:

```json
{
    "EnvName": "dev",
    "ParameterName": "WorkspaceGuid",
    "ParameterValue": "$(WorkspaceGuid)",
    "Description": "Fabric workspace GUID — injected by ADO pipeline variable $(WORKSPACE_GUID)"
}
```

Run → **GREEN**.

**Config** — `azure-pipelines.yml`, in each Bootstrap stage's `env:` block:

```yaml
- stage: Bootstrap_Dev
  variables:
    WORKSPACE_GUID: $(DEV_WORKSPACE_GUID)   # pipeline variable in ADO library
  ...
  - script: |
      # pass WORKSPACE_GUID as seed override when reseeding EnvironmentConfig
```

---

## GAP-01 — Workspace Identity auth

### Fabric REST API lifecycle — `scripts/11-provision-workspace-identity.py`

Full CRUD implementation to ship in this sprint:

```python
#!/usr/bin/env python3
"""
scripts/11-provision-workspace-identity.py

Provision, inspect, and deprovision Workspace Identity for a Fabric workspace
via the Fabric REST API.

Usage:
    python scripts/11-provision-workspace-identity.py provision --workspace-id <id> --token <bearer>
    python scripts/11-provision-workspace-identity.py status    --workspace-id <id> --token <bearer>
    python scripts/11-provision-workspace-identity.py deprovision --workspace-id <id> --token <bearer>
"""
import argparse
import json
import sys
import time
import requests

FABRIC_API = "https://api.fabric.microsoft.com/v1"
POLL_INTERVAL_S = 3
POLL_TIMEOUT_S = 120


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── READ ──────────────────────────────────────────────────────────────────────

def get_workspace(workspace_id: str, token: str) -> dict:
    """GET /v1/workspaces/{workspaceId} — returns full workspace object."""
    r = requests.get(f"{FABRIC_API}/workspaces/{workspace_id}", headers=_headers(token))
    r.raise_for_status()
    return r.json()


def get_identity_status(workspace_id: str, token: str) -> dict | None:
    """Return the workspaceIdentity sub-object, or None if not provisioned."""
    ws = get_workspace(workspace_id, token)
    return ws.get("workspaceIdentity")


# ── CREATE ────────────────────────────────────────────────────────────────────

def provision_identity(workspace_id: str, token: str) -> dict:
    """
    POST /v1/workspaces/{workspaceId}/provisionIdentity

    Long-running operation — polls until state is Active or timeout.
    Returns the final workspaceIdentity object.
    """
    r = requests.post(
        f"{FABRIC_API}/workspaces/{workspace_id}/provisionIdentity",
        headers=_headers(token),
    )
    if r.status_code == 202:
        # Async operation — poll Location header
        operation_url = r.headers.get("Location") or r.headers.get("location")
        return _poll_operation(operation_url, token)
    r.raise_for_status()
    return r.json()


def _poll_operation(operation_url: str, token: str) -> dict:
    deadline = time.time() + POLL_TIMEOUT_S
    while time.time() < deadline:
        r = requests.get(operation_url, headers=_headers(token))
        r.raise_for_status()
        body = r.json()
        state = body.get("status", "").lower()
        if state in ("succeeded", "completed"):
            return body.get("createdItemId") or body
        if state == "failed":
            raise RuntimeError(f"Workspace Identity provisioning failed: {body}")
        time.sleep(POLL_INTERVAL_S)
    raise TimeoutError(f"Workspace Identity provisioning timed out after {POLL_TIMEOUT_S}s")


# ── DELETE ────────────────────────────────────────────────────────────────────

def deprovision_identity(workspace_id: str, token: str) -> None:
    """
    POST /v1/workspaces/{workspaceId}/deprovisionIdentity

    Removes the workspace-managed identity. Irreversible without re-provisioning.
    """
    r = requests.post(
        f"{FABRIC_API}/workspaces/{workspace_id}/deprovisionIdentity",
        headers=_headers(token),
    )
    if r.status_code not in (200, 202, 204):
        r.raise_for_status()
    print(f"[OK] Workspace Identity deprovisioned for {workspace_id}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Fabric Workspace Identity lifecycle")
    p.add_argument("action", choices=["provision", "status", "deprovision"])
    p.add_argument("--workspace-id", required=True)
    p.add_argument("--token", required=True, help="Entra bearer token for Fabric API")
    args = p.parse_args()

    if args.action == "status":
        identity = get_identity_status(args.workspace_id, args.token)
        if identity:
            print(json.dumps(identity, indent=2))
        else:
            print("No Workspace Identity provisioned.")
            sys.exit(1)

    elif args.action == "provision":
        result = provision_identity(args.workspace_id, args.token)
        print(json.dumps(result, indent=2))

    elif args.action == "deprovision":
        deprovision_identity(args.workspace_id, args.token)


if __name__ == "__main__":
    main()
```

### TDD Cycle 4 — `nb_conn_jdbc` uses Workspace Identity token when flag set

**Write tests** — `tests/test_nb_conn_jdbc.py`, class `TestWorkspaceIdentityAuth`:

```python
class TestWorkspaceIdentityAuth(unittest.TestCase):

    def _conn_config_wi(self):
        """ConnectionConfig row with use_workspace_identity=True."""
        return {
            "SourceID": 1,
            "SourceName": "ERP_SQL",
            "ServerName": "erp.database.windows.net",
            "DatabaseName": "erp",
            "UseWorkspaceIdentity": True,
            "KeyVaultSecretName": None,
        }

    def _conn_config_sp(self):
        return {
            "SourceID": 1,
            "SourceName": "ERP_SQL",
            "ServerName": "erp.database.windows.net",
            "DatabaseName": "erp",
            "UseWorkspaceIdentity": False,
            "KeyVaultSecretName": "erp-jdbc-password",
        }

    def test_workspace_identity_token_acquired_when_flag_true(self):
        nbu = MagicMock()
        nbu.credentials.getToken.return_value = "fake-wi-token"
        conn = nb_conn_jdbc.build_jdbc_connection(
            conn_config=self._conn_config_wi(),
            kv_url="https://kv.vault.azure.net/",
            notebookutils=nbu,
        )
        nbu.credentials.getToken.assert_called_once_with(
            "https://database.windows.net/.default"
        )
        self.assertIn("accessToken", conn)

    def test_key_vault_used_when_workspace_identity_false(self):
        nbu = MagicMock()
        nbu.secrets.get.return_value = "sp-password"
        conn = nb_conn_jdbc.build_jdbc_connection(
            conn_config=self._conn_config_sp(),
            kv_url="https://kv.vault.azure.net/",
            notebookutils=nbu,
        )
        nbu.secrets.get.assert_called_once()
        nbu.credentials.getToken.assert_not_called()

    def test_workspace_identity_missing_notebookutils_raises(self):
        with self.assertRaises(RuntimeError):
            nb_conn_jdbc.build_jdbc_connection(
                conn_config=self._conn_config_wi(),
                kv_url="https://kv.vault.azure.net/",
                notebookutils=None,   # Fabric runtime not available
            )
```

Run → **RED**.

**Implement** — `src/notebooks/nb_conn_jdbc.py`, new helper:

```python
def build_jdbc_connection(conn_config: dict, kv_url: str, notebookutils=None) -> dict:
    """
    Resolve JDBC connection credentials.

    Returns a dict with either:
      {"password": "<sp-password>"}           # Service Principal path
      {"accessToken": "<wi-bearer-token>"}    # Workspace Identity path
    """
    if conn_config.get("UseWorkspaceIdentity"):
        if notebookutils is None:
            raise RuntimeError(
                "UseWorkspaceIdentity=True requires Fabric runtime (notebookutils). "
                "Set UseWorkspaceIdentity=False for local/offline runs."
            )
        token = notebookutils.credentials.getToken(
            "https://database.windows.net/.default"
        )
        return {"accessToken": token}
    else:
        secret_name = conn_config["KeyVaultSecretName"]
        password = notebookutils.secrets.get(kv_url, secret_name)
        return {"password": password}
```

Update `run_jdbc_ingestion` to call `build_jdbc_connection` instead of calling `get_secret` directly.

Run → **GREEN**.

---

### TDD Cycle 5 — `UseWorkspaceIdentity` column exists in `ConnectionConfig` seed

```python
def test_connection_config_seed_has_use_workspace_identity_column(self):
    import json, os
    seed_path = os.path.join(os.path.dirname(__file__), "../config/seed-dev.json")
    with open(seed_path) as f:
        seed = json.load(f)
    conn_rows = seed["Data"].get("ConnectionConfig", [])
    if conn_rows:
        self.assertIn("UseWorkspaceIdentity", conn_rows[0])
```

**Implement** — add `"UseWorkspaceIdentity": false` to every `ConnectionConfig` row in `config/seed-dev.json` and `config/seed-smoke.json`.

---

## ADR-045 stub

Create `docs/adr/ADR-045-workspace-identity-vs-service-principal.md`:

```markdown
# ADR-045: Workspace Identity vs Service Principal for Fabric Authentication

**Date:** May 2026
**Status:** Accepted
**Confidence:** High
**See also:** [ADR-044](ADR-044-nb-utils-scc-shareable-cloud-connection-api.md) — SCC API

## Decision

Adopt Workspace Identity (`UseWorkspaceIdentity: true` in `ConnectionConfig`) as the
preferred authentication path for notebooks connecting to Azure SQL and OneLake.
Service Principal + Key Vault remains the fallback for:
- Cross-tenant connections where Workspace Identity has no permissions
- Local/offline pytest runs (no Fabric runtime)
- Connections provisioned before Workspace Identity was enabled

## Consequence

`nb_conn_jdbc` and `nb_conn_rest` honour the `UseWorkspaceIdentity` flag.
New onboarding scripts call `scripts/11-provision-workspace-identity.py provision`
rather than `scripts/02-*` SP registration steps.
```

---

## Definition of Done

- [ ] `pytest tests/test_nb_orchestrator.py -k "WorkspaceGuid"` — all green
- [ ] `pytest tests/test_nb_conn_jdbc.py -k "WorkspaceIdentity"` — all green
- [ ] `pytest tests/test_nb_orchestrator.py --cov=src/notebooks/nb_orchestrator --cov-report=term-missing` — full suite green, coverage ≥ 80%
- [ ] `pytest tests/test_nb_conn_jdbc.py --cov=src/notebooks/nb_conn_jdbc --cov-report=term-missing` — full suite green, coverage ≥ 80%
- [ ] `gitleaks detect --verbose` — clean
- [ ] `bandit -r src/ -ll -f text` — no Medium/High findings
- [ ] `ruff check src/ tests/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `mypy src/notebooks/nb_orchestrator.py src/notebooks/nb_conn_jdbc.py --ignore-missing-imports --no-strict-optional` — zero error: lines
- [ ] `python scripts/11-provision-workspace-identity.py status --workspace-id $SMOKE_WS_ID --token $TOKEN` — returns identity object in smoke env
- [ ] `config/seed-dev.json` contains `WorkspaceGuid` in `EnvironmentConfig` and `UseWorkspaceIdentity` in `ConnectionConfig`
- [ ] ADR-045 committed
- [ ] `azure-pipelines.yml` passes `WORKSPACE_GUID` variable in Bootstrap stages
