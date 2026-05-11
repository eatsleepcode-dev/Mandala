---
gap_id: GAP-05
sprint: 4
status: COMPLETE
adr_required: [ADR-047 — Fabric SQL Database for Control Plane Metadata — STATUS: ✅ COMMITTED]
tds_raised: []
---

# Task: GAP-05 — Fabric SQL control DB dual-write PoC (Phase A)

**Status**: COMPLETE
**Vibe Mode**: CREATION
**Branch**: `claude/review-recent-commits-Auyjc`
**Sprint**: 4
**Effort**: XL (3 sprints total; Phase A this sprint)
**Score impact**: 0 pts (score moves only at Phase C completion)

---

## Pre-existing Tech Debt

The following Medium TDs targeting Sprint 4 were found in the pre-flight check. None block
this sprint's work but are noted here for awareness. They are not included in Ralph's Ledger
(they are separate concerns not modified by GAP-05 Phase A).

| TD | Description |
|---|---|
| TD-040 | conftest.py mock_spark fixture returns itself |
| TD-041 | 12 test files fail to collect due to missing dependencies |
| TD-046 | `build_dag` / nb_orchestrator medium roast findings (6 items) |
| TD-052 | 9 notebooks with uncommented magic cells |
| TD-053 | nb_bootstrap.py B023 closure late-binding in `_coerce_row` |
| TD-056 | test_nb_utils_config.py 2 failures — azure SDK not installed |
| TD-057 | test_smoke_seed.py 2 failures — seed drift and None KV name |

---

## Context (The Elephants 🐘)

1. **SQLite SQL dialect vs T-SQL syntax**: `nb_utils_fabric_sql.py` must speak T-SQL for
   Fabric SQL but SQLite for offline tests. `INSERT OR REPLACE` (SQLite) ≠ `MERGE` or
   `IF NOT EXISTS` (T-SQL). If the stub routes to SQLite but the implementation uses T-SQL
   syntax, every CRUD test will fail with `OperationalError: near "MERGE": syntax error`.
   - *Strategy*: Use `PEGGY_SQL_STUB=sqlite` env var checked at module load time. The stub
     path builds a shared in-memory SQLite connection and uses SQLite-compatible DML
     (`INSERT OR REPLACE`, `INSERT OR IGNORE`). Production path uses pyodbc with T-SQL.
     Keep the two dialect paths explicit — no abstraction that tries to normalise SQL.
   - *Status*: ⏳ Pending — Cycle 1

2. **pyodbc import kills module load offline**: `import pyodbc` at module level raises
   `ModuleNotFoundError` in CI and local dev where pyodbc is not installed. This will cause
   every test that imports `nb_log_event` (which will import `nb_utils_fabric_sql`) to fail
   with a collection error — killing the entire test suite.
   - *Strategy*: Guard pyodbc with `try: import pyodbc as _pyodbc\nexcept ImportError: _pyodbc = None`.
     In production connection path, guard with `if _pyodbc is None: raise RuntimeError(...)`.
     The SQLite stub path never calls pyodbc. The `PEGGY_SQL_STUB=sqlite` check must be
     evaluated BEFORE any pyodbc-dependent code path.
   - *Status*: ⏳ Pending — Cycle 1

3. **`log_control_event` event dict → ControlLog column mismatch**: `insert_control_log(conn, event)`
   takes a generic dict. The Fabric SQL `control.ControlLog` schema has specific NVARCHAR/INT
   columns. The Cycle 3 test passes `{"Status": "SUCCESS"}` (partial dict). The INSERT must
   handle absent keys gracefully (NULL fill) rather than raising `KeyError` or a column-count
   error. If the INSERT uses positional parameters and the dict is partial, the INSERT will fail.
   - *Strategy*: `insert_control_log` must build the INSERT dynamically from the dict keys
     present (`INSERT INTO control.ControlLog (col1, col2) VALUES (?, ?)`). Only include keys
     that are present; absent columns get their DEFAULT/NULL from the schema. Parameterise all
     values to prevent SQL injection.
   - *Status*: ⏳ Pending — Cycle 3

4. **Dual-write failure must never block pipeline**: If the Fabric SQL write fails (connection
   timeout, bad connection string, schema mismatch), the Delta write is the authoritative path
   and must succeed regardless. If the dual-write `try/except` is placed incorrectly and wraps
   the Delta write, a Fabric SQL error will prevent the Delta write — silent data loss.
   - *Strategy*: Delta write executes unconditionally first. Fabric SQL write is in a
     separate `try/except Exception: pass` block that follows. Two-layer pattern matching
     the RTI Eventstream design from GAP-06 (Sprint 3). No shared exception handler.
   - *Status*: ⏳ Pending — Cycle 3

5. **SQLite in-memory DB is not shared across test methods**: SQLite `:memory:` connections
   are per-connection. If each CRUD helper creates its own connection, state written in
   `test_upsert_and_get` won't be visible in subsequent tests. Tests will pass in isolation
   but produce `AssertionError: {} != {"MaxRetries": "3"}` when expected rows aren't found.
   - *Strategy*: Under `PEGGY_SQL_STUB=sqlite`, the module holds a module-level SQLite
     connection singleton (`_STUB_CONN`) initialised at import time. All CRUD helpers use
     this singleton. The schema is bootstrapped in the same import block.
   - *Status*: ⏳ Pending — Cycle 1

---

## Live DEV Migration SQL

```sql
-- No DDL/schema change to existing Delta control tables in Phase A.
-- IngestionConfig, ConnectionConfig, ObjectConfig etc. are unchanged.
--
-- Phase A only adds a new parameter row to EnvironmentConfig (data insert, not DDL):
INSERT INTO control.EnvironmentConfig (EnvName, ParameterName, ParameterValue, Description)
VALUES
  ('dev', 'FabricSqlControlDb', NULL,
   'pyodbc connection string for the Fabric SQL control DB. NULL = Delta-only mode.');
--
-- The Fabric SQL Database itself is provisioned separately via:
--   python scripts/14-manage-fabric-sql-db.py create --workspace-id $WS --name PeggyControl --token $T
-- The Fabric SQL schema is in config/control-schema/fabric-sql/01-create-tables.sql
```

---

## Execution Plan (Ralph's Ledger)

### ADR Cycle — Write ADR-047 before implementation

- [x] Write `docs/adr/ADR-047-fabric-sql-control-plane-migration.md`
- [x] Add to `docs/adr/README.md` catalog
- [x] COMMIT: `docs(adr): ADR-047 — Fabric SQL Database for Control Plane Metadata`

---

### Cycle 1 — SQLite stub + all CRUD helpers in `nb_utils_fabric_sql.py`

- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestEnvironmentConfigCRUD::test_upsert_and_get` — upsert then get returns the row
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestEnvironmentConfigCRUD::test_upsert_updates_existing_row` — second upsert overwrites
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestEnvironmentConfigCRUD::test_get_returns_empty_dict_for_unknown_env` — missing env → {}
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestWatermarkStateCRUD::test_get_returns_none_when_no_row` — no row → None
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestWatermarkStateCRUD::test_set_and_get_watermark` — set then get
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestWatermarkStateCRUD::test_set_watermark_idempotent` — overwrite updates
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestControlLogCRUD::test_insert_and_get_control_log` — insert then query by pipeline_id
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestControlLogCRUD::test_get_control_log_respects_limit` — limit=3 returns ≤3 rows
- [x] 🟢 GREEN: create `src/notebooks/nb_utils_fabric_sql.py` with SQLite stub + pyodbc guard + all CRUD helpers
- [x] 🔵 REFACTOR: extract `_stub_conn()` accessor; add `# noqa: S608` on SQL strings
- [x] COMMIT: `feat(nb-utils-fabric-sql): Cycle 1 — SQLite stub + CRUD helpers [GREEN]`

---

### Cycle 2 — `EnvironmentConfig` seed has `FabricSqlControlDb` parameter

- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestFabricSqlSeedRows::test_fabric_sql_control_db_parameter_in_seed` — ParameterName in seed
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestFabricSqlSeedRows::test_fabric_sql_control_db_is_null_in_dev_seed` — ParameterValue is None
- [x] 🟢 GREEN: add `FabricSqlControlDb` null row to `config/seed-dev.json` EnvironmentConfig
- [x] 🔵 REFACTOR: none
- [x] COMMIT: `feat(seed): add FabricSqlControlDb row to EnvironmentConfig seed [GREEN]`

---

### Cycle 3 — dual-write path via `log_control_event` in `nb_log_event.py`

- [x] 🔴 RED: `tests/test_nb_log_event.py::TestDualWriteFabricSql::test_fabric_sql_insert_called_when_connection_string_set` — insert_control_log called when conn str set
- [x] 🔴 RED: `tests/test_nb_log_event.py::TestDualWriteFabricSql::test_delta_still_written_when_fabric_sql_set` — Delta write always fires
- [x] 🔴 RED: `tests/test_nb_log_event.py::TestDualWriteFabricSql::test_fabric_sql_failure_does_not_prevent_delta_write` — SQL error → Delta write still occurs
- [x] 🔴 RED: `tests/test_nb_log_event.py::TestDualWriteFabricSql::test_fabric_sql_not_called_when_connection_string_absent` — absent conn str → no SQL call
- [x] 🟢 GREEN: add `log_control_event` to `nb_log_event.py` with guarded `nb_utils_fabric_sql` import + dual-write
- [x] 🔵 REFACTOR: `# noqa: S110` on try/except/pass; ensure import guard matches pattern from `_requests`
- [x] COMMIT: `feat(nb-log-event): Cycle 3 — log_control_event with dual-write path [GREEN]`

---

### Cycle 4 — Fabric SQL DB lifecycle script + DDL files

- [x] Create `scripts/14-manage-fabric-sql-db.py` (full code from sprint plan)
- [x] Create `config/control-schema/fabric-sql/01-create-tables.sql` (DDL from sprint plan)
- [x] COMMIT: `feat(scripts): 14-manage-fabric-sql-db.py + Fabric SQL DDL schema [GAP-05]`

---

## Gate Checklist

### Hardening Phase
- [x] `PEGGY_SQL_STUB=sqlite pytest tests/test_nb_utils_fabric_sql.py` — all green
- [x] `pytest tests/test_nb_log_event.py` — all green (existing + new Cycle 3 tests)
- [x] `pytest tests/` — full suite, no regressions (pyodbc import guard does not break collections)
- [x] `nb_utils_fabric_sql` import without `PEGGY_SQL_STUB` succeeds silently when pyodbc absent

### Gatekeeper Phase
- [x] Gate 1: `gitleaks` — no secrets in scripts (token params are CLI args, not literals)
- [x] Gate 2: `bandit -r src/notebooks/nb_utils_fabric_sql.py src/notebooks/nb_log_event.py -ll -f txt` — 0 new HIGH
- [x] Gate 3: `ruff check src/notebooks/nb_utils_fabric_sql.py src/notebooks/nb_log_event.py scripts/14-manage-fabric-sql-db.py` — 0 new errors
- [x] Gate 4: `mypy src/notebooks/nb_utils_fabric_sql.py src/notebooks/nb_log_event.py --ignore-missing-imports` — 0 new errors
- [x] Gate 5: `PEGGY_SQL_STUB=sqlite pytest tests/test_nb_utils_fabric_sql.py tests/test_nb_log_event.py -v` — all green

---

## Iteration Log

- **2026-05-03**: Task card created via `/build-sprint GAP-05`. Pre-flight blocked on TD-044,
  TD-048, TD-049, TD-050 (all High). Fixed inline before task card was written. Pre-mortem:
  3 elephants (SQLite dialect, pyodbc import kill, log_control_event dict→column mismatch).
  ADR-047 must be written first. 4 TDD cycles planned. No tidy cycle (log_event not modified).
- **Sprint close 2026-05-03**: All DoD items ✅ (4/7 done, 3/7 carryover — all blocked on
  live Fabric workspace). Carryover: `scripts/14-manage-fabric-sql-db.py` live smoke +
  `01-create-tables.sql` applied in live Fabric SQL DB → Sprint 5. TDs raised: none.
  TDs closed: TD-044, TD-048, TD-049, TD-050.
