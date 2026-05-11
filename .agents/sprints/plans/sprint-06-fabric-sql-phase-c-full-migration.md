---
sprint: 6
title: "GAP-05 Phase C — Fabric SQL full migration; Delta control tables retired"
gaps: [GAP-05]
phase: C
effort: XL/3
status: complete
completed_date: 2026-05-03
score_before: 363
score_after_estimate: 381
score_actual: 381
carryover: [TD-064 — live Fabric commissioning (SQL files applied, nb_env_setup, Power BI, Delta drop)]
tds_raised: [TD-064]
tds_closed: []
note: "+18 pts from closing the 0/3 Fabric SQL control DB item (P3 weight=6, max=18)."
adr_update: [ADR-047]
branch: claude/review-recent-commits-Auyjc
prerequisite: Sprint 5 merged; smoke env running on Fabric SQL reads for 1+ sprint with zero incidents
---

# Sprint 6 — GAP-05 Phase C: Full Fabric SQL migration

## Goal

Remove `FabricSqlControlDb` feature flag. `nb_utils_fabric_sql` becomes the unconditional
read/write path. Delta control tables are dropped. `PEGGY_SQL_STUB=sqlite` is the standard
offline test mode. Score closes to 3/3 on "Fabric SQL control DB".

---

## Migration safety checklist (before writing any code)

- [ ] Phase B has been running in smoke for at least 5 full pipeline runs with zero Fabric SQL read errors
- [ ] `config/control-schema/fabric-sql/01-create-tables.sql` applied to dev, smoke, and uat Fabric SQL DBs
- [ ] All `config/seed-*.json` rows verified present in Fabric SQL via direct T-SQL query
- [ ] A point-in-time Delta snapshot of all 13 control tables has been exported as CSV backup
- [ ] Delta control Lakehouse is set to `IsActive = false` in `EnvironmentConfig` as a circuit-breaker

---

## TDD Cycle 1 — `get_config` requires Fabric SQL (no Delta fallback)

**Write tests** — `tests/test_nb_utils_config.py`, class `TestGetConfigFabricSqlRequired`:

```python
class TestGetConfigFabricSqlRequired(unittest.TestCase):
    """After Phase C, Delta fallback path is removed. Fabric SQL is the only path."""

    def test_get_config_calls_fabric_sql_always(self):
        spark = MagicMock()
        with patch("nb_utils_config.nb_utils_fabric_sql.get_environment_config",
                   return_value={"MaxRetries": "3"}) as mock_sql:
            result = nb_utils_config.get_config(spark, "db_control", "EnvVariables")
        mock_sql.assert_called_once()
        self.assertEqual(result["MaxRetries"], "3")

    def test_no_spark_sql_call_for_env_variables(self):
        """After Phase C, nb_utils_config should NOT call spark.sql for EnvVariables."""
        spark = MagicMock()
        with patch("nb_utils_config.nb_utils_fabric_sql.get_environment_config",
                   return_value={}):
            nb_utils_config.get_config(spark, "db_control", "EnvVariables")
        spark.sql.assert_not_called()

    def test_missing_fabric_sql_module_raises_import_error(self):
        """If nb_utils_fabric_sql is absent, fail fast with a clear message."""
        import importlib, sys
        with patch.dict(sys.modules, {"nb_utils_fabric_sql": None}):
            with self.assertRaises((ImportError, RuntimeError)):
                importlib.reload(nb_utils_config)
```

Run → **RED** (Delta fallback still present from Phase B).

**Implement** — `src/notebooks/nb_utils_config.py`:

```python
# Phase C: remove _get_config_from_delta and _get_fabric_sql_conn.
# nb_utils_fabric_sql is now required — no try/except around the import.

from nb_utils_fabric_sql import (
    get_environment_config as _sql_get_env,
    get_runbook_steps      as _sql_get_steps,
    get_object_config      as _sql_get_object,
    get_connection_config  as _sql_get_conn,
)


def get_config(spark, control_lh: str, query_type: str, params: dict | None = None) -> any:
    """
    Fetch runtime configuration from the Fabric SQL control database.

    spark and control_lh are retained as parameters for call-site compatibility
    but control_lh is no longer used as a Delta table prefix.
    The Fabric SQL connection string is read from the PEGGY_SQL_CONN env variable
    (set by nb_env_setup from EnvironmentConfig at notebook start).
    """
    import os
    sql_conn = os.environ.get("PEGGY_SQL_CONN", "")
    if not sql_conn:
        raise RuntimeError(
            "PEGGY_SQL_CONN environment variable is not set. "
            "nb_env_setup must run before get_config() is called."
        )
    return _get_config_from_fabric_sql(sql_conn, query_type, params)
```

**Update** `src/notebooks/nb_env_setup.py` to read `FabricSqlControlDb` from Fabric
Key Vault / Variable Library and set `os.environ["PEGGY_SQL_CONN"]` before any notebook
calls `get_config`.

Run → **GREEN** (with `PEGGY_SQL_STUB=sqlite` and `PEGGY_SQL_CONN=stub`).

---

## TDD Cycle 2 — existing 382-test suite passes without Delta calls

After Phase C, all tests must run under `PEGGY_SQL_STUB=sqlite` and `PEGGY_SQL_CONN=stub`.
The test harness sets both env vars via `conftest.py`:

**Create/update** `tests/conftest.py`:

```python
import os
import pytest

def pytest_configure(config):
    """Set Fabric SQL stub env vars for the full offline test suite."""
    os.environ.setdefault("PEGGY_SQL_STUB", "sqlite")
    os.environ.setdefault("PEGGY_SQL_CONN", "stub")
```

**Target**: `pytest tests/` (all 382+ tests) passes with zero Delta `spark.sql` calls
to control table paths. Verify with:

```bash
PEGGY_SQL_STUB=sqlite PEGGY_SQL_CONN=stub pytest tests/ -v --tb=short 2>&1 \
  | grep -E "PASSED|FAILED|ERROR" | wc -l
```

---

## TDD Cycle 3 — `nb_bootstrap` runs DDL against Fabric SQL, not Delta

`nb_bootstrap.py` creates all control tables on first deploy. After Phase C it must
target Fabric SQL.

**Write test**:

```python
class TestBootstrapFabricSqlDDL(unittest.TestCase):

    def test_bootstrap_creates_all_control_tables_in_fabric_sql(self):
        with patch("nb_bootstrap.nb_utils_fabric_sql") as mock_sql:
            spark = MagicMock()
            nb_bootstrap.create_control_tables(spark, "db_control", sql_conn="stub")
        called_tables = {call[0][0] for call in mock_sql.execute_ddl.call_args_list}
        required = {
            "EnvironmentConfig", "ControlLog", "WatermarkState",
            "ObjectConfig", "IngestionSource", "ConnectionConfig", "RunbookSteps",
        }
        self.assertTrue(required.issubset(called_tables))

    def test_bootstrap_does_not_create_delta_tables(self):
        spark = MagicMock()
        with patch("nb_bootstrap.nb_utils_fabric_sql"):
            nb_bootstrap.create_control_tables(spark, "db_control", sql_conn="stub")
        # spark.sql should not be called to CREATE TABLE in Delta
        delta_creates = [c for c in spark.sql.call_args_list
                         if "CREATE TABLE" in str(c).upper()]
        self.assertEqual(delta_creates, [])
```

**Implement** — `src/notebooks/nb_bootstrap.py`: route `create_control_tables` to execute
DDL in `config/control-schema/fabric-sql/01-create-tables.sql` via `nb_utils_fabric_sql`.

---

## TDD Cycle 4 — `nb_seed_control_lh` is Fabric SQL only

After Phase C, `seed_control_db` writes exclusively to Fabric SQL.
The `fabric_sql_conn` parameter becomes required (not optional).

```python
def test_seed_raises_when_no_conn_str(self):
    with self.assertRaises((TypeError, ValueError)):
        nb_seed_control_lh.seed_control_db(
            spark=MagicMock(), control_lh="db_control",
            fabric_sql_conn=None,   # no longer optional
            seed_data={},
        )
```

---

## Delta control table retirement

**Remove** from `src/notebooks/nb_utils_config.py`:
- `_get_config_from_delta()`
- `_get_fabric_sql_conn()`
- Phase B dual-path routing logic

**Remove** from `src/notebooks/nb_log_event.py`:
- Delta `write.format("delta").saveAsTable(...)` for `ControlLog`
- Delta `ControlLog` read path (Fabric SQL `get_control_log()` is now the only reader)

**Remove** from `src/notebooks/nb_utils_watermark.py` (if exists):
- Delta `WatermarkState` read/write paths

**Remove** from `config/seed-dev.json`:
- `FabricSqlControlDb` row (no longer a feature flag — it's mandatory; moved to Key Vault)

**Retain in Delta** (these are data tables, not control tables):
- All `lh_bronze`, `lh_silver`, `lh_gold` lakehouse tables
- `ObjectConfig.ViewScript` (if stored in Delta for performance reasons — review)

---

## `config/control-schema/fabric-sql/03-views.sql`

```sql
-- Operational monitoring views for Power BI DirectQuery
-- These replace the Delta-based queries previously in the Throughput Report

CREATE OR ALTER VIEW control.vw_pipeline_summary AS
SELECT
    PipelineID,
    COUNT(*)                                   AS RunCount,
    SUM(CASE WHEN Status = 'SUCCESS' THEN 1 ELSE 0 END) AS SuccessCount,
    AVG(ElapsedSeconds)                        AS AvgElapsedSeconds,
    MAX(StartTime)                             AS LastRunTime
FROM control.ControlLog
GROUP BY PipelineID;
GO

CREATE OR ALTER VIEW control.vw_watermark_health AS
SELECT
    ws.SourceID,
    ws.ObjectName,
    ws.LastWatermark,
    ic.ConnectorType,
    DATEDIFF(HOUR, TRY_CAST(ws.LastWatermark AS DATETIME2), GETUTCDATE()) AS HoursSinceLastIngest
FROM control.WatermarkState ws
LEFT JOIN control.IngestionSource ic ON ic.SourceID = ws.SourceID;
GO
```

---

## ADR-047 final update

Update `docs/adr/ADR-047-fabric-sql-control-plane-migration.md`:

```markdown
**Status:** Accepted — Phase C complete
**Date:** <sprint completion date>

## Consequences

All 13 control tables now live in a Fabric SQL Database (`PeggyControl`).
Delta control tables have been retired. The offline test suite uses
`PEGGY_SQL_STUB=sqlite` + `PEGGY_SQL_CONN=stub` via `tests/conftest.py`.

Power BI DirectQuery monitoring is available directly against `control.*` views
without requiring a Spark session. T-SQL stored procedures are available for
control plane automation (Role administration — see GAP backlog).

Score: closes ID31 "Fabric SQL control DB" from 0/3 to 3/3 (+18 weighted points).
Peggy total: ~381/390 = ~97% on closeable items.
```

---

## Definition of Done

- [ ] `PEGGY_SQL_STUB=sqlite PEGGY_SQL_CONN=stub pytest tests/` — all 382+ tests green
- [ ] Zero `spark.sql` calls to `*.control.EnvironmentConfig` or `*.control.ControlLog` Delta paths remain in source
- [ ] `nb_bootstrap.create_control_tables` targets Fabric SQL; Delta CREATE TABLE calls removed
- [ ] `config/control-schema/fabric-sql/03-views.sql` committed and applied in smoke DB
- [ ] Power BI DirectQuery connection to Fabric SQL `control.vw_pipeline_summary` confirmed working
- [ ] Delta control Lakehouse tables vacuumed and dropped from dev, smoke, uat (NOT prod until sign-off)
- [ ] ADR-047 status updated to `Accepted — Phase C complete`
- [ ] Score confirmed: framework-comparison.md ID31 updated to 3/3
