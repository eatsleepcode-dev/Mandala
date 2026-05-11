---
gap_id: GAP-05
sprint: 5
phase: B
status: COMPLETE
completed_date: 2026-05-03
adr_required: [ADR-047 — STATUS: ✅ ACCEPTED (Phase B in progress)]
tds_raised: []
---

# Task: GAP-05 Phase B — Fabric SQL read migration

**Status**: COMPLETE
**Vibe Mode**: CREATION
**Branch**: `claude/review-recent-commits-Auyjc`
**Sprint**: 5
**Effort**: XL/3 (Phase B of 3)
**Score impact**: 0 pts (score moves at Phase C only)

---

## Carryover from Sprint 4

- `scripts/14-manage-fabric-sql-db.py create` live smoke — blocked on live Fabric workspace
- `scripts/14-manage-fabric-sql-db.py connection-string` live smoke — blocked on live Fabric workspace
- `config/control-schema/fabric-sql/01-create-tables.sql` applied in live Fabric SQL DB — blocked on live Fabric workspace

---

## Context (The Elephants 🐘)

1. **`RunbookStep` vs `RunbookSteps` naming mismatch**: The Delta table is
   `control.RunbookStep` (singular — matches `nb_bootstrap.py` DDL and `nb_utils_config.py`
   line 64). The Sprint 5 plan uses `RunbookSteps` (plural). `01-create-tables.sql` from
   Phase A has no `RunbookStep` table at all.
   - *Strategy*: Use `RunbookStep` (singular) everywhere — consistent with Delta DDL. Create
     `config/control-schema/fabric-sql/02-add-runbook-step.sql` for the missing DDL.
     Extend `_bootstrap_stub` to add this table for offline tests.
   - *Status*: ⏳ Pending — Cycle 1

2. **SQLite bootstrap missing tables**: `_bootstrap_stub` in `nb_utils_fabric_sql.py` only
   creates EnvironmentConfig, ControlLog, WatermarkState. New CRUD helpers for RunbookStep,
   ObjectConfig, ConnectionConfig will fail with `OperationalError: no such table`.
   - *Strategy*: Extend `_bootstrap_stub` to create all 6 control tables before adding any
     new CRUD helper. All new tables added in one atomic change.
   - *Status*: ⏳ Pending — Cycle 1

3. **`get_config` CC=15 — routing addition would push it higher**: The flat if/elif chain
   in `get_config` already rates C (CC=15). Adding a Fabric SQL routing branch inline would
   reach CC=20+. Must tidy first.
   - *Strategy*: Tidy cycle extracts `_get_config_from_delta(spark, control_lh, query_type, params)`
     (exact copy of current implementation) before any RED cycle. This reduces `get_config`
     CC to ~5. Then the routing logic stays clean.
   - *Status*: ⏳ Pending — Tidy Cycle

4. **Bootstrap read must never self-route**: `_get_fabric_sql_conn` reads
   `FabricSqlControlDb` from Delta EnvironmentConfig to bootstrap the routing decision.
   If `_get_fabric_sql_conn` itself called `get_config`, it would recurse infinitely.
   - *Strategy*: `_get_fabric_sql_conn` uses a direct `spark.sql(...)` Delta read — it
     bypasses `get_config` entirely. One-liner; no helper needed.
   - *Status*: ⏳ Pending — Cycle 2

5. **`nb_seed_control_lh.py` has uncommented `%%configure -f`** (TD-052 partial):
   The file has bare `%%configure -f` at line 20 causing a `SyntaxError` on import. Also
   `import notebookutils` is unguarded. Cannot add tests without fixing these first.
   - *Strategy*: Comment `%%configure -f` → `# %%configure -f` (same fix as TD-050).
     Guard `import notebookutils` with a try/except. These are prerequisite tidy commits
     before the Cycle 3 RED.
   - *Status*: ⏳ Pending — Cycle 3 prerequisite

---

## Live DEV Migration SQL

```sql
-- Phase B: add RunbookStep table to Fabric SQL control DB
-- (Phase A created EnvironmentConfig, ControlLog, WatermarkState, ObjectConfig,
--  IngestionSource, ConnectionConfig — RunbookStep was missing)
-- Deploy via Azure Data Studio or sqlcmd against the PeggyControl database.
```

The DDL file is `config/control-schema/fabric-sql/02-add-runbook-step.sql` (created in Cycle 1).
No ALTER TABLE on existing Delta tables — Phase B is read-path only.

---

## Execution Plan (Ralph's Ledger)

### ADR Cycle — Update ADR-047 status to Accepted

- [x] Update `docs/adr/ADR-047-fabric-sql-control-plane-migration.md` status: `Proposed` → `Accepted — Phase B in progress`
- [x] COMMIT: `docs(adr): ADR-047 status Accepted — Phase B in progress`

---

### Tidy Cycle — Extract `_get_config_from_delta` from `get_config` (CC=15 → ~5)

- [x] Extract existing `get_config` body into `_get_config_from_delta(spark, control_lh, query_type, params)`
- [x] `get_config` becomes a 2-line dispatcher: calls `_get_config_from_delta`
- [x] `pytest tests/test_nb_utils_config.py` — all existing tests still pass
- [x] COMMIT: `tidy(nb-utils-config): extract _get_config_from_delta [CC 15→5]`

---

### Cycle 1 — Additional CRUD helpers + SQLite stub bootstrap

- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestRunbookStepCRUD::test_upsert_and_get_runbook_step` — upsert then get returns the row
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestRunbookStepCRUD::test_get_runbook_steps_only_returns_active` — IsActive=0 row excluded
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestObjectConfigCRUD::test_upsert_and_get_object_config` — upsert then get by ObjectName
- [x] 🔴 RED: `tests/test_nb_utils_fabric_sql.py::TestObjectConfigCRUD::test_get_object_config_returns_none_for_unknown` — missing → None
- [x] 🟢 GREEN: extend `nb_utils_fabric_sql.py` — add `get_runbook_steps`, `upsert_runbook_step`, `get_object_config`, `upsert_object_config`, `get_connection_config`; extend `_bootstrap_stub` with RunbookStep, ObjectConfig, ConnectionConfig tables
- [x] 🔵 REFACTOR: none required
- [x] Create `config/control-schema/fabric-sql/02-add-runbook-step.sql` DDL
- [x] COMMIT: `feat(nb-utils-fabric-sql): Cycle 1 — RunbookStep/ObjectConfig/ConnectionConfig CRUD [GREEN]`

---

### Cycle 2 — `get_config` routes to Fabric SQL when connection string present

- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestGetConfigFabricSqlRouting::test_get_config_env_variables_uses_fabric_sql_when_conn_str_set`
- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestGetConfigFabricSqlRouting::test_get_config_falls_back_to_delta_when_no_conn_str`
- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestGetConfigFabricSqlRouting::test_get_config_runbook_steps_uses_fabric_sql_when_conn_str_set`
- [x] 🟢 GREEN: add `_get_fabric_sql_conn`, `_get_config_from_fabric_sql`, guarded import + routing block to `nb_utils_config.py`
- [x] 🔵 REFACTOR: add `# noqa: S110` on bootstrap read try/except
- [x] COMMIT: `feat(nb-utils-config): Cycle 2 — Fabric SQL routing in get_config [GREEN]`

---

### Cycle 3 — `nb_seed_control_lh` seeds Fabric SQL when flag set

- [x] Prerequisite: comment `%%configure -f` → `# %%configure -f` in `nb_seed_control_lh.py`
- [x] Prerequisite: guard `import notebookutils` with try/except
- [x] 🔴 RED: `tests/test_nb_seed_control_lh.py::TestSeedFabricSqlDualWrite::test_fabric_sql_seeded_when_conn_str_set`
- [x] 🔴 RED: `tests/test_nb_seed_control_lh.py::TestSeedFabricSqlDualWrite::test_no_fabric_sql_call_when_conn_str_none`
- [x] 🟢 GREEN: add `seed_control_db(spark, control_lh, seed_data, fabric_sql_conn=None)` to `nb_seed_control_lh.py`; add guarded `nb_utils_fabric_sql` import
- [x] 🔵 REFACTOR: none required
- [x] COMMIT: `feat(nb-seed-control-lh): Cycle 3 — dual-write seeding to Fabric SQL [GREEN]`

---

## Gate Checklist

### Hardening Phase
- [x] `PEGGY_SQL_STUB=sqlite pytest tests/test_nb_utils_fabric_sql.py` — all green
- [x] `PEGGY_SQL_STUB=sqlite pytest tests/test_nb_utils_config.py -k FabricSql` — all green
- [x] `pytest tests/test_nb_utils_config.py` — existing tests unbroken (Delta fallback intact)
- [x] `pytest tests/` — full suite, no regressions

### Gatekeeper Phase
- [x] Gate 1: `bandit` — 0 new HIGH in changed files
- [x] Gate 2: `ruff check src/notebooks/nb_utils_config.py src/notebooks/nb_utils_fabric_sql.py src/notebooks/nb_seed_control_lh.py` — 0 errors
- [x] Gate 3: `mypy src/notebooks/nb_utils_config.py src/notebooks/nb_utils_fabric_sql.py --ignore-missing-imports` — 0 new errors

---

## Iteration Log

- **2026-05-03**: Phase B task card created. Pre-flight: TD-051 descoped from Sprint 5
  (nb_utils_fabric.py not in scope). Pre-mortem: 5 elephants. Tidy cycle required (CC=15).
  3 TDD cycles + ADR update. Score unchanged — Phase C closes GAP-05.
- **Sprint close 2026-05-03**: All DoD items ✅ (4/6; 2 carryover to Sprint 6). ADR cycle, Tidy cycle, Cycles 1–3 all committed. 65 tests pass; 3 pre-existing infrastructure failures unchanged. Carryover: `02-seed-runbook-steps.sql` seed file + live Fabric SQL smoke test. TDs raised: none. TDs closed: none.
