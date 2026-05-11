---
sprint: 5
title: "GAP-05 Phase B — Fabric SQL read migration"
gaps: [GAP-05]
phase: B
effort: XL/3
status: complete
completed_date: 2026-05-03
score_before: 363
score_after_estimate: 363
score_actual: 363
note: "Score still does not move — Delta reads remain live as fallback. Phase C closes the scoring item."
adr_update: [ADR-047]
branch: claude/review-recent-commits-Auyjc
prerequisite: Sprint 4 merged; Fabric SQL DB created in dev and smoke via script; smoke tests green with dual-write
carryover:
  - "02-seed-runbook-steps.sql seed file — Phase C (full cut-over) will own this"
  - "Manual smoke: FabricSqlControlDb live in dev — blocked on live Fabric workspace"
  - "scripts/14 live smoke — carried from Sprint 4, still blocked on live Fabric workspace"
  - "01-create-tables.sql applied in live Fabric SQL DB — blocked on live Fabric workspace"
tds_raised: []
tds_closed: []
---

# Sprint 5 — GAP-05 Phase B: Fabric SQL read migration

## Carryover from Sprint 4

- `scripts/14-manage-fabric-sql-db.py create` live smoke — run against BFL F64 capacity dev workspace to confirm DB creation and LRO polling
- `scripts/14-manage-fabric-sql-db.py connection-string` — confirm connection string format matches pyodbc DSN expected by `nb_utils_fabric_sql`
- `config/control-schema/fabric-sql/01-create-tables.sql` — apply in live Fabric SQL DB via Azure Data Studio or sqlcmd; confirm 6 tables created cleanly

---

## Goal

Switch `nb_orchestrator` and `nb_utils_config` to read configuration from Fabric SQL when
`FabricSqlControlDb` is set in `EnvironmentConfig`. Delta tables remain the source of truth
when the connection string is absent, providing a clean rollback path.

No existing notebook behaviour changes when `FabricSqlControlDb` is null.

---

## TDD Cycle 1 — `get_config` routes to Fabric SQL when connection string present

**Write tests** — `tests/test_nb_utils_config.py`, class `TestGetConfigFabricSqlRouting`:

```python
import os
os.environ.setdefault("PEGGY_SQL_STUB", "sqlite")

class TestGetConfigFabricSqlRouting(unittest.TestCase):

    def _spark_with_conn_str(self, conn_str="Driver=ODBC;Server=..."):
        spark = MagicMock()
        # First SQL call returns EnvironmentConfig containing FabricSqlControlDb
        env_row = MagicMock()
        env_row.__iter__ = MagicMock(return_value=iter([
            ("FabricSqlControlDb", conn_str),
            ("MaxRetries", "0"),
        ]))
        spark.sql.return_value.collect.return_value = [env_row]
        return spark

    def test_get_config_env_variables_uses_fabric_sql_when_conn_str_set(self):
        spark = self._spark_with_conn_str()
        with patch("nb_utils_config.nb_utils_fabric_sql.get_environment_config",
                   return_value={"MaxRetries": "2"}) as mock_sql:
            result = nb_utils_config.get_config(spark, "db_control", "EnvVariables")
        mock_sql.assert_called_once()
        self.assertEqual(result["MaxRetries"], "2")

    def test_get_config_falls_back_to_delta_when_no_conn_str(self):
        spark = MagicMock()
        # env has NO FabricSqlControlDb key
        env_row = MagicMock()
        env_row.__iter__ = MagicMock(return_value=iter([("MaxRetries", "0")]))
        spark.sql.return_value.collect.return_value = [env_row]
        with patch("nb_utils_config.nb_utils_fabric_sql.get_environment_config") as mock_sql:
            nb_utils_config.get_config(spark, "db_control", "EnvVariables")
        mock_sql.assert_not_called()

    def test_get_config_runbook_steps_uses_fabric_sql_when_conn_str_set(self):
        spark = self._spark_with_conn_str()
        mock_steps = [{"NotebookName": "nb_conn_jdbc", "ExecutionOrder": 1}]
        with patch("nb_utils_config.nb_utils_fabric_sql.get_runbook_steps",
                   return_value=mock_steps) as mock_sql:
            result = nb_utils_config.get_config(
                spark, "db_control", "RunbookSteps", {"PipelineID": 10}
            )
        mock_sql.assert_called_once_with(ANY, pipeline_id=10)
        self.assertEqual(result, mock_steps)
```

Run → **RED**.

**Implement** — `src/notebooks/nb_utils_config.py`, extend `get_config`:

```python
try:
    from nb_utils_fabric_sql import (
        get_environment_config  as _sql_get_env,
        get_runbook_steps       as _sql_get_steps,
        get_object_config       as _sql_get_object,
        get_connection_config   as _sql_get_conn,
    )
    _FABRIC_SQL_AVAILABLE = True
except ImportError:
    _FABRIC_SQL_AVAILABLE = False


def _get_fabric_sql_conn(spark, control_lh: str) -> str | None:
    """Read FabricSqlControlDb from EnvironmentConfig via Delta (bootstrap read)."""
    try:
        rows = spark.sql(
            f"SELECT ParameterValue FROM {control_lh}.control.EnvironmentConfig "
            f"WHERE ParameterName = 'FabricSqlControlDb'"
        ).collect()
        return rows[0]["ParameterValue"] if rows else None
    except Exception:
        return None


def get_config(spark, control_lh: str, query_type: str, params: dict | None = None) -> any:
    # Attempt Fabric SQL read if available and configured
    if _FABRIC_SQL_AVAILABLE:
        sql_conn = _get_fabric_sql_conn(spark, control_lh)
        if sql_conn:
            return _get_config_from_fabric_sql(sql_conn, query_type, params)

    # Delta fallback (existing implementation — unchanged)
    return _get_config_from_delta(spark, control_lh, query_type, params)


def _get_config_from_fabric_sql(sql_conn: str, query_type: str, params: dict | None) -> any:
    if query_type == "EnvVariables":
        return _sql_get_env(sql_conn, params.get("EnvName", "dev") if params else "dev")
    if query_type == "RunbookSteps":
        return _sql_get_steps(sql_conn, pipeline_id=params["PipelineID"])
    if query_type == "ObjectConfig":
        return _sql_get_object(sql_conn, params["ObjectName"])
    if query_type == "ConnectionConfig":
        return _sql_get_conn(sql_conn, params["SourceID"])
    raise ValueError(f"Unknown query_type: {query_type!r}")


def _get_config_from_delta(spark, control_lh: str, query_type: str, params: dict | None) -> any:
    # Original implementation moved here verbatim — no changes
    ...
```

Run → **GREEN**.

---

## TDD Cycle 2 — additional Fabric SQL read helpers in `nb_utils_fabric_sql`

**Add to** `src/notebooks/nb_utils_fabric_sql.py`:

```python
# ── RunbookSteps ──────────────────────────────────────────────────────────────

def get_runbook_steps(connection_string: str, pipeline_id: int) -> list[dict]:
    sql = """
        SELECT NotebookName, DependsOn, ExecutionOrder,
               TimeoutPerCellSeconds, RetryCount, RetryIntervalSeconds, Parameters
        FROM   control.RunbookSteps
        WHERE  PipelineID = ? AND IsActive = 1
        ORDER  BY ExecutionOrder
    """
    with _cursor(connection_string) as cur:
        cur.execute(sql, (pipeline_id,))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def upsert_runbook_step(connection_string: str, step: dict) -> None:
    sql = """
        MERGE control.RunbookSteps AS target
        USING (VALUES (?, ?)) AS source (PipelineID, NotebookName)
        ON target.PipelineID = source.PipelineID
           AND target.NotebookName = source.NotebookName
        WHEN MATCHED THEN UPDATE SET
            ExecutionOrder         = ?,
            IsActive               = ?,
            TimeoutPerCellSeconds  = ?,
            RetryCount             = ?,
            RetryIntervalSeconds   = ?,
            DependsOn              = ?,
            Parameters             = ?
        WHEN NOT MATCHED THEN INSERT
            (PipelineID, NotebookName, ExecutionOrder, IsActive,
             TimeoutPerCellSeconds, RetryCount, RetryIntervalSeconds, DependsOn, Parameters)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """
    with _cursor(connection_string) as cur:
        cur.execute(sql, (
            step["PipelineID"], step["NotebookName"],
            step.get("ExecutionOrder", 0), step.get("IsActive", 1),
            step.get("TimeoutPerCellSeconds", 90), step.get("RetryCount", 0),
            step.get("RetryIntervalSeconds", 10), step.get("DependsOn"),
            step.get("Parameters"),
            step["PipelineID"], step["NotebookName"],
            step.get("ExecutionOrder", 0), step.get("IsActive", 1),
            step.get("TimeoutPerCellSeconds", 90), step.get("RetryCount", 0),
            step.get("RetryIntervalSeconds", 10), step.get("DependsOn"),
            step.get("Parameters"),
        ))


# ── ObjectConfig ──────────────────────────────────────────────────────────────

def get_object_config(connection_string: str, object_name: str) -> dict | None:
    sql = "SELECT * FROM control.ObjectConfig WHERE ObjectName = ?"
    with _cursor(connection_string) as cur:
        cur.execute(sql, (object_name,))
        row = cur.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, row))


def upsert_object_config(connection_string: str, config: dict) -> None:
    sql = """
        MERGE control.ObjectConfig AS target
        USING (VALUES (?)) AS source (ObjectName)
        ON target.ObjectName = source.ObjectName
        WHEN MATCHED THEN UPDATE SET
            IsActive = ?, RequiresMasking = ?, LoadType = ?, Description = ?
        WHEN NOT MATCHED THEN INSERT
            (ObjectName, IsActive, RequiresMasking, LoadType, Description)
        VALUES (?, ?, ?, ?, ?);
    """
    with _cursor(connection_string) as cur:
        cur.execute(sql, (
            config["ObjectName"],
            config.get("IsActive", 1), config.get("RequiresMasking", 0),
            config.get("LoadType", "FULL"), config.get("Description"),
            config["ObjectName"],
            config.get("IsActive", 1), config.get("RequiresMasking", 0),
            config.get("LoadType", "FULL"), config.get("Description"),
        ))


# ── ConnectionConfig ──────────────────────────────────────────────────────────

def get_connection_config(connection_string: str, source_id: int) -> dict | None:
    sql = "SELECT * FROM control.ConnectionConfig WHERE SourceID = ?"
    with _cursor(connection_string) as cur:
        cur.execute(sql, (source_id,))
        row = cur.fetchone()
        if not row:
            return None
        cols = [d[0] for d in cur.description]
        return dict(zip(cols, row))
```

**Tests** — extend `tests/test_nb_utils_fabric_sql.py`:

```python
class TestRunbookStepsCRUD(unittest.TestCase):

    def test_upsert_and_get_runbook_step(self):
        step = {
            "PipelineID": 10, "NotebookName": "nb_conn_jdbc",
            "ExecutionOrder": 1, "IsActive": 1,
            "TimeoutPerCellSeconds": 90, "RetryCount": 0,
            "RetryIntervalSeconds": 10, "DependsOn": None, "Parameters": None,
        }
        nb_utils_fabric_sql.upsert_runbook_step(CONN, step)
        rows = nb_utils_fabric_sql.get_runbook_steps(CONN, pipeline_id=10)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["NotebookName"], "nb_conn_jdbc")

    def test_get_runbook_steps_only_returns_active(self):
        nb_utils_fabric_sql.upsert_runbook_step(
            CONN, {"PipelineID": 20, "NotebookName": "nb_active",   "IsActive": 1,
                   "ExecutionOrder": 1, "TimeoutPerCellSeconds": 90,
                   "RetryCount": 0, "RetryIntervalSeconds": 10}
        )
        nb_utils_fabric_sql.upsert_runbook_step(
            CONN, {"PipelineID": 20, "NotebookName": "nb_inactive", "IsActive": 0,
                   "ExecutionOrder": 2, "TimeoutPerCellSeconds": 90,
                   "RetryCount": 0, "RetryIntervalSeconds": 10}
        )
        rows = nb_utils_fabric_sql.get_runbook_steps(CONN, pipeline_id=20)
        names = [r["NotebookName"] for r in rows]
        self.assertIn("nb_active", names)
        self.assertNotIn("nb_inactive", names)


class TestObjectConfigCRUD(unittest.TestCase):

    def test_upsert_and_get_object_config(self):
        nb_utils_fabric_sql.upsert_object_config(
            CONN, {"ObjectName": "SalesOrderHeader", "IsActive": 1,
                   "RequiresMasking": 0, "LoadType": "WATERMARK"}
        )
        result = nb_utils_fabric_sql.get_object_config(CONN, "SalesOrderHeader")
        self.assertEqual(result["LoadType"], "WATERMARK")

    def test_get_object_config_returns_none_for_unknown(self):
        result = nb_utils_fabric_sql.get_object_config(CONN, "DoesNotExist")
        self.assertIsNone(result)
```

---

## TDD Cycle 3 — `nb_seed_control_lh` seeds Fabric SQL when flag set

Peggy's `nb_seed_control_lh.py` bootstraps the control tables from `seed-dev.json`.
It must seed Fabric SQL in addition to Delta when `FabricSqlControlDb` is set.

**Write test** — `tests/test_nb_seed_control_lh.py` (or extend existing if present),
class `TestSeedFabricSql`:

```python
class TestSeedFabricSqlDualWrite(unittest.TestCase):

    def test_fabric_sql_seeded_when_conn_str_set(self):
        with patch("nb_seed_control_lh.nb_utils_fabric_sql") as mock_sql:
            spark = MagicMock()
            nb_seed_control_lh.seed_control_db(
                spark, "db_control",
                fabric_sql_conn="Driver=ODBC;...",
                seed_data={"EnvironmentConfig": [
                    {"EnvName": "dev", "ParameterName": "X", "ParameterValue": "Y"}
                ]},
            )
        mock_sql.upsert_environment_config.assert_called()

    def test_no_fabric_sql_call_when_conn_str_none(self):
        with patch("nb_seed_control_lh.nb_utils_fabric_sql") as mock_sql:
            spark = MagicMock()
            nb_seed_control_lh.seed_control_db(
                spark, "db_control",
                fabric_sql_conn=None,
                seed_data={"EnvironmentConfig": []},
            )
        mock_sql.upsert_environment_config.assert_not_called()
```

**Implement** — `src/notebooks/nb_seed_control_lh.py`, extend `seed_control_db` to accept
`fabric_sql_conn: str | None = None` and call the appropriate `nb_utils_fabric_sql` upsert
per table type.

---

## `config/control-schema/fabric-sql/02-seed-runbook-steps.sql`

```sql
-- Seed RunbookSteps for the platform pipeline (PipelineID = 10)
INSERT INTO control.RunbookSteps
    (PipelineID, NotebookName, ExecutionOrder, IsActive,
     TimeoutPerCellSeconds, RetryCount, RetryIntervalSeconds)
VALUES
    (10, 'nb_conn_jdbc',      10, 1, 300, 1, 30),
    (10, 'nb_conn_rest',      20, 1, 300, 1, 30),
    (10, 'nb_conn_mirror',    30, 1, 300, 1, 30),
    (10, 'nb_landing_to_bronze', 40, 1, 600, 1, 60),
    (10, 'nb_bronze_to_silver',  50, 1, 600, 1, 60),
    (10, 'nb_silver_transform',  60, 1, 600, 1, 60);
GO
```

---

## ADR-047 update

Update `docs/adr/ADR-047-fabric-sql-control-plane-migration.md` status to `Accepted — Phase B in progress`.

---

## Definition of Done

- [x] `PEGGY_SQL_STUB=sqlite pytest tests/test_nb_utils_config.py -k "FabricSql"` — green
- [x] `PEGGY_SQL_STUB=sqlite pytest tests/test_nb_utils_fabric_sql.py` — all green including new CRUD tests
- [x] `pytest tests/` — full suite green (Delta fallback path fully intact; pre-existing failures unchanged)
- [🔁] `config/control-schema/fabric-sql/02-seed-runbook-steps.sql` — carryover to Sprint 6; `02-add-runbook-step.sql` DDL committed in Cycle 1
- [🔁] Manual smoke: set `FabricSqlControlDb` in smoke env — blocked on live Fabric workspace; carryover to Sprint 6
- [x] ADR-047 status updated to `Accepted — Phase B`
