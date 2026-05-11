---
gap_id: GAP-05
sprint: 6
phase: C
status: DONE
adr_required: [ADR-047 — STATUS: ✅ ACCEPTED Phase B; update to Accepted Phase C complete]
tds_raised: []
---

# Task: GAP-05 Phase C — Fabric SQL full migration

**Status**: DONE
**Vibe Mode**: CREATION
**Branch**: `claude/review-recent-commits-Auyjc`
**Sprint**: 6
**Effort**: XL/3 (Phase C of 3)
**Score impact**: +18 pts (closes ID31 "Fabric SQL control DB" from 0/3 → 3/3)

---

## Carryover from Sprint 5

- Migration safety checklist — all items blocked on live Fabric workspace
- `02-seed-runbook-steps.sql` seed file — owned by Phase C
- Manual smoke: `FabricSqlControlDb` live routing — blocked on live Fabric workspace
- `scripts/14` live smoke + `01-create-tables.sql` applied — blocked on live Fabric workspace

---

## Context (The Elephants 🐘)

1. **`TestGetConfig` Delta-path tests will break at Cycle 1.**
   `test_env_variables_returns_dict`, `test_runbook_steps_uses_int_pipeline_id`,
   `test_object_config_escapes_quotes`, `test_unknown_query_type_returns_none`, and
   `TestGetConfigFabricSqlRouting::test_get_config_falls_back_to_delta_when_no_conn_str`
   all assume either Delta `spark.sql` calls or the Phase B routing. After Cycle 1 removes
   the Delta fallback, these will either fail or become vacuously true.
   - *Strategy*: Accept the regressions as expected. Fix them in Cycle 2 by adapting
     the old Delta-path tests to use `PEGGY_SQL_CONN=stub` + the SQLite stub.
     `test_get_config_falls_back_to_delta_when_no_conn_str` → replaced by
     `test_get_config_raises_when_peggy_sql_conn_not_set`.

2. **`nb_bootstrap.create_control_tables` is Delta-only; sprint plan adds `sql_conn` param.**
   Current signature: `create_control_tables(spark_session, control_lh_name)`.
   Phase C adds `sql_conn=None`. The existing `test_create_control_tables` calls the old
   2-arg form — it must remain passing for backward compatibility.
   `nb_utils_fabric_sql` needs an `execute_ddl(conn_str, ddl)` helper for the stub path.
   - *Strategy*: `execute_ddl` added to `nb_utils_fabric_sql` (stub: run via SQLite;
     prod: execute via pyodbc). `create_control_tables` routes to Fabric SQL when
     `sql_conn` is supplied; Delta path is the default until live cutover.

3. **`conftest.py` must set `PEGGY_SQL_CONN=stub` before any test imports `nb_utils_config`.**
   `pytest_configure` runs before collection, so env vars set there are visible to all
   test modules at import time. But test files that do `os.environ["PEGGY_SQL_STUB"] = "sqlite"`
   at module level (before the conftest `pytest_configure` runs) may conflict.
   - *Strategy*: Use `os.environ.setdefault` in conftest so per-file overrides win.
     Audit all test files that set `PEGGY_SQL_STUB` and verify they still work.

4. **`test_missing_fabric_sql_module_raises_import_error` reloads `nb_utils_config`.**
   `importlib.reload` re-executes the module. After Phase C the import is unconditional
   (`import nb_utils_fabric_sql`). Patching `sys.modules["nb_utils_fabric_sql"] = None`
   makes the `import` statement raise `ImportError` — which is what the test expects.
   But `reload` itself may surface other side-effects (re-running module-level code).
   - *Strategy*: Use `patch.dict(sys.modules, {"nb_utils_fabric_sql": None})` then
     call `importlib.reload(nb_utils_config)` inside `assertRaises(ImportError)`.
     If `reload` causes issues, use `del sys.modules["nb_utils_config"]` +
     `importlib.import_module` inside the patch instead.

5. **`PEGGY_SQL_CONN` is now mandatory at runtime — but `nb_env_setup.py` does not set it.**
   Phase C requires `nb_env_setup` to read `FabricSqlControlDb` from Key Vault / Variable
   Library and write it to `os.environ["PEGGY_SQL_CONN"]`. Without this, every notebook
   that calls `get_config` will raise `RuntimeError` at runtime.
   - *Strategy*: Add `_set_fabric_sql_conn()` helper to `nb_env_setup.py` that reads
     `FabricSqlControlDb` from `notebookutils` Variable Library and sets the env var.
     This is Fabric-platform-specific code guarded by `try/except`; offline/CI skip is
     automatic since `notebookutils` is absent. Not TDD'd (untestable offline); documented
     as a manual smoke item for Sprint 6 close.

---

## Live DEV Migration SQL

```sql
-- Phase C: no ALTER TABLE required — all tables already exist from Phase A/B.
-- Run 03-views.sql to create operational monitoring views after Phase C is deployed.
-- config/control-schema/fabric-sql/03-views.sql
```

No Delta schema changes. Phase C is read-path and bootstrap-path only.

---

## Execution Plan (Ralph's Ledger)

### ADR Cycle — Final ADR-047 update (Phase C complete)

- [ ] Update ADR-047 status: `Accepted — Phase B` → `Accepted — Phase C complete`
- [ ] Add Consequences section (all 13 tables in Fabric SQL, Delta retired, score +18)
- [ ] COMMIT: `docs(adr): ADR-047 Phase C complete — Delta control tables retired`

---

### Cycle 1 — `get_config` unconditional Fabric SQL (remove Delta fallback)

- [ ] 🔴 RED: `tests/test_nb_utils_config.py::TestGetConfigFabricSqlRequired::test_get_config_calls_fabric_sql_always`
- [ ] 🔴 RED: `tests/test_nb_utils_config.py::TestGetConfigFabricSqlRequired::test_no_spark_sql_call_for_env_variables`
- [ ] 🔴 RED: `tests/test_nb_utils_config.py::TestGetConfigFabricSqlRequired::test_missing_fabric_sql_module_raises_import_error`
- [ ] 🟢 GREEN: change `import nb_utils_fabric_sql` from guarded try/except to unconditional; remove `_get_fabric_sql_conn` and `_get_config_from_delta`; `get_config` reads `PEGGY_SQL_CONN` from env
- [ ] 🔵 REFACTOR: none required
- [ ] COMMIT RED + COMMIT GREEN (separate commits)

---

### Cycle 2 — Conftest + full test suite adapts to Phase C

- [ ] Update `tests/conftest.py` — add `pytest_configure` to set `PEGGY_SQL_STUB=sqlite` + `PEGGY_SQL_CONN=stub` as defaults
- [ ] Retire/update broken Delta-path tests in `TestGetConfig`:
  - [ ] `test_env_variables_returns_dict` → seed SQLite stub and assert against SQLite result
  - [ ] `test_runbook_steps_uses_int_pipeline_id` → update: no bootstrap read; validate int() raises on injection string before Fabric SQL is called
  - [ ] `test_object_config_escapes_quotes` → remove (Delta escape logic gone; Fabric SQL uses parameterized queries)
  - [ ] `test_unknown_query_type_returns_none` → still valid via stub path; simplify setup
- [ ] Replace `TestGetConfigFabricSqlRouting::test_get_config_falls_back_to_delta_when_no_conn_str` with `test_get_config_raises_when_peggy_sql_conn_not_set`
- [ ] `PEGGY_SQL_STUB=sqlite PEGGY_SQL_CONN=stub pytest tests/test_nb_utils_config.py` — all green
- [ ] COMMIT: `test(nb-utils-config): Cycle 2 — adapt test suite to Phase C Fabric SQL path`

---

### Cycle 3 — `nb_bootstrap.create_control_tables` targets Fabric SQL

- [ ] Add `execute_ddl(conn_str: str, ddl: str) -> None` to `nb_utils_fabric_sql.py`
  - stub path: `_stub_conn().executescript(ddl); _stub_conn().commit()`
  - prod path: execute via `_prod_conn(conn_str).execute(ddl)`
- [ ] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestExecuteDdl::test_execute_ddl_creates_temp_table`
- [ ] 🔴 RED: `tests/test_nb_bootstrap.py::TestBootstrapFabricSqlDDL::test_bootstrap_creates_all_control_tables_in_fabric_sql`
- [ ] 🔴 RED: `tests/test_nb_bootstrap.py::TestBootstrapFabricSqlDDL::test_bootstrap_does_not_create_delta_tables_when_sql_conn_set`
- [ ] 🟢 GREEN: add `sql_conn=None` to `create_control_tables`; when set, call `nb_utils_fabric_sql.execute_ddl` for each table DDL; Delta path unchanged when `sql_conn=None`
- [ ] 🔵 REFACTOR: none required
- [ ] COMMIT RED + COMMIT GREEN

---

### Cycle 4 — `seed_control_db` `fabric_sql_conn` becomes required

- [ ] 🔴 RED: `tests/test_nb_seed_control_lh.py::TestSeedFabricSqlDualWrite::test_seed_raises_when_no_conn_str`
- [ ] 🟢 GREEN: change `fabric_sql_conn=None` default → no default (required param); add validation
- [ ] COMMIT RED + COMMIT GREEN

---

### Delta retirement cleanup

- [ ] Remove from `nb_utils_config.py`:
  - [ ] `_get_config_from_delta()` function
  - [ ] `_get_fabric_sql_conn()` function
  - [ ] Phase B dual-path routing logic
- [ ] Remove from `nb_log_event.py`:
  - [ ] Delta `ControlLog` write path (keep Fabric SQL dual-write; make it the only path)
- [ ] Remove `FabricSqlControlDb` row from `config/seed-dev.json` (no longer a feature flag)
- [ ] COMMIT: `refactor: Delta control table retirement — Phase C cleanup`

---

### `config/control-schema/fabric-sql/03-views.sql`

- [ ] Create `config/control-schema/fabric-sql/03-views.sql` with `vw_pipeline_summary` and `vw_watermark_health`
- [ ] COMMIT: `feat(fabric-sql): 03-views.sql — operational monitoring views`

---

## Gate Checklist

### Hardening Phase
- [ ] `PEGGY_SQL_STUB=sqlite PEGGY_SQL_CONN=stub pytest tests/test_nb_utils_config.py` — all green
- [ ] `PEGGY_SQL_STUB=sqlite PEGGY_SQL_CONN=stub pytest tests/test_nb_utils_fabric_sql.py` — all green
- [ ] `PEGGY_SQL_STUB=sqlite PEGGY_SQL_CONN=stub pytest tests/test_nb_bootstrap.py` — all green
- [ ] `PEGGY_SQL_STUB=sqlite PEGGY_SQL_CONN=stub pytest tests/` — full suite, no regressions

### Gatekeeper Phase
- [ ] Gate 1: `bandit` — 0 new HIGH in changed files
- [ ] Gate 2: `ruff check src/notebooks/nb_utils_config.py src/notebooks/nb_utils_fabric_sql.py src/notebooks/nb_bootstrap.py src/notebooks/nb_seed_control_lh.py` — 0 errors
- [ ] Gate 3: `mypy src/notebooks/nb_utils_config.py src/notebooks/nb_utils_fabric_sql.py --ignore-missing-imports` — 0 new errors

---

## Iteration Log

- **2026-05-03**: Phase C task card created. Pre-mortem: 5 elephants. 4 TDD cycles + Delta retirement + views SQL + ADR final update. Score +18 pts on Phase C close.
- **Sprint close 2026-05-03**: All 4 TDD cycles ✅. Delta retirement cleanup ✅ (nb_log_event.py, seed-dev.json). 03-views.sql committed ✅. framework-comparison.md ID31 → 3/3 ✅. ADR-047 Phase C ✅. 81/84 tests passing (3 pre-existing cffi). Carryover: live Fabric commissioning → TD-064. TDs raised: TD-064. TDs closed: none.
