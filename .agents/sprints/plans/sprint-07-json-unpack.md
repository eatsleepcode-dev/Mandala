---
sprint: 7
title: "JSON unpack pipeline"
gaps: [GAP-07]
effort: M
status: COMPLETE
score_before: 381
score_after: 381
branch: feat/dev-diary
started: 2026-05-03
completed: 2026-05-03
---

# Sprint 7 — JSON unpack pipeline

## Goals

| Deliverable | Done when |
|---|---|
| `control.UnpackSpec` DDL in `nb_bootstrap.py` | Migration guard present; `PendingMaterializedViews` removed |
| `profiling.ColumnStats.PathExpression` column | Migration guard in bootstrap |
| `nb_json_unpack_sync.py` — full pipeline | `discover_variant_columns`, `parse_variant_schema_to_paths`, `derive_candidate_unpack_rows`, `merge_unpack_proposals`, `run_json_unpack_sync` — 22 tests green |
| `nb_view_seeder.py` — dead materialized-view code removed | CC ≤8; `load_unpack_spec` wired in |
| `build_view_ddl` UnpackSpec support | Views generated from `UnpackSpec` rows |

---

## TD Pre-flight

**TD-064 (High)** — live Fabric SQL commissioning (requires live Fabric workspace) — **open, out of
scope for Sprint 7**. JSON unpack pipeline is a new Python notebook with no dependency on the live
Fabric SQL commissioning path.

---

## Notebook delivery order

1. **Tidy A** — `create_control_tables` CC=16 → 5 (extract helper methods)
2. **Tidy B** — `run_view_seeder` CC=16 → 8 (extract helpers)
3. **Cycle 1** — `control.UnpackSpec` DDL; `PendingMaterializedViews` removed from bootstrap
4. **Cycle 2** — `profiling.ColumnStats.PathExpression` migration guard
5. **Cycles 3–7** — `nb_json_unpack_sync.py` core pipeline (5 functions, 22 tests)
6. **Cycle 8** — remove dead materialized-view code from `nb_view_seeder.py`
7. **Cycle 9** — `load_unpack_spec` + `build_view_ddl` UnpackSpec support
8. **Tidy** — mypy `type: ignore` suppressions for Fabric execution cell
9. **Roast fixes** — `_scalar_projection` `$.` prefix strip; `load_unpack_spec` wired into `run_view_seeder`

---

## TDD summary

| Cycle | Test class / area | Notes |
|---|---|---|
| Tidy A/B | — | structural only; CC gate |
| 1 | `TestUnpackSpecDDL` | bootstrap DDL present |
| 2 | `TestColumnStatsPathExpression` | migration guard present |
| 3–7 | `TestJsonUnpackSync` | 22 tests covering all 5 pipeline functions |
| 8 | — | dead-code removal; regression only |
| 9 | `TestBuildViewDDLUnpackSpec` | UnpackSpec rows produce valid VIEW DDL |

---

## Key design decisions

- **VARIANT columns**: `discover_variant_columns` returns empty `schema_str` until a future sprint
  adds `schema_of_variant_agg` profiling SQL (runtime-only function, not testable offline).
- **Scalar projections**: `$.` prefix stripped from path expressions for valid Fabric VARIANT SQL.
- **UnpackSpec rows** activate JSON unpack views; rows shipped with `IsActive=False` until operator
  confirms schema. No feature-score change until rows are activated.

---

## Definition of Done

- [x] `pytest tests/test_nb_json_unpack_sync.py -v` — all green (22 tests)
- [x] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [x] `gitleaks detect --verbose` — clean
- [x] `bandit -r src/ -ll -f text` — 0 HIGH; 6 MEDIUM B608 pre-existing
- [x] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [x] `mypy src/notebooks/nb_json_unpack_sync.py --ignore-missing-imports` — 0 errors
- [x] `control.UnpackSpec` DDL in `nb_bootstrap.py`
- [x] `profiling.ColumnStats.PathExpression` migration guard in `nb_bootstrap.py`
- [x] Dead materialized-view code removed from `nb_view_seeder.py`
- [x] `load_unpack_spec` wired into `run_view_seeder` (not dead code)
- [x] Sprint register updated

---

## Carryover

- `schema_of_variant_agg` profiling (VARIANT runtime-only) — deferred; `discover_variant_columns`
  returns empty `schema_str` until a future sprint adds the profiling SQL.
