---
sprint: 13
title: "Source Onboarding Wizard — nb_source_wizard + nb_jdbc_introspect"
feature_plan_phase: 2
effort: L + M
status: PLANNED
score_before: TBD
score_after_estimate: TBD
adr_required: ["ADR-056"]
branch: TBD
pre_existing_closed_tds: "TD-035 (hash-based SCD2) ✅, TD-037 (filename timestamp) ✅"
pre_existing_open_tds: "TD-038 (SQL schema introspection) 🔲 — closed by this sprint"
prerequisite: Sprint 12 COMPLETE (nb_connection_test.py required by wizard Step 3)
---

# Sprint 13 — Source Onboarding Wizard (FEATURE_PLAN Phase 2)

## Goals

Adding a new data source requires no code changes and no JSON editing. This sprint delivers the
guided source registration wizard and the SQL schema introspection notebook.

| Item | Deliverable | Done when |
|---|---|---|
| P2-A | `nb_source_wizard.py` — 7-step guided source registration | All source types (JDBC/REST/File/Dataverse) flow through; control table rows inserted |
| P2-B(TD-038) | `nb_jdbc_introspect.py` — SQL schema introspection | PK inference logic works; proposed `ObjectConfig` rows written with `IsActive=False` |
| P2-D | Cleansing rule wizard tab in `nb_maintenance_objectconfig.py` | 4 rule types (NORMALIZE_TEXT/COLUMN_SPLIT/NULL_FILL/DATETIME_PARSE) add/remove with preview |

---

## Pre-flight notes

**TD-035** (hash-based SCD2) and **TD-037** (filename timestamp sequencing) are already closed ✅.
Those enhancements are in `nb_silver_transform.py` and `nb_landing_to_bronze.py` respectively.

**TD-038** (SQL schema introspection) — open; closed by `nb_jdbc_introspect.py` this sprint.

**Prerequisite**: `nb_connection_test.py` from Sprint 12 must be available — wizard Step 3 calls
it inline.

---

## Notebook delivery order

### nb_jdbc_introspect.py (build first — wizard depends on it)

1. **Cycle 1** — `_query_information_schema` → column list + PK candidates from
   `INFORMATION_SCHEMA.KEY_COLUMN_USAGE`
2. **Cycle 2** — `_infer_pk_from_column_names` — pattern match `*Id`, `*Key`, `*No`; amber flag
   when no formal PK constraint
3. **Cycle 3** — `_build_object_config_rows` — proposed rows with `IsActive=False`;
   watermark column candidates (`updated_at`, `modified_date`, `rowversion` patterns)
4. **Cycle 4** — `write_to_object_config` + `write_to_ingestion_config` — insert with review-before-enable
5. **Cycle 5** — `run_jdbc_introspect` orchestrator + widget UI (display only; logic tested separately)

### nb_source_wizard.py

6. **Cycle 6** — Steps 1–2: source type selection + connection details branching (JDBC/REST/File/Dataverse)
7. **Cycle 7** — Step 3: inline connection test (calls `nb_connection_test` logic)
8. **Cycle 8** — Step 4: schema introspection for JDBC (calls `nb_jdbc_introspect` logic)
9. **Cycle 9** — Steps 5–6: proposed ObjectConfig review + write to control tables
   (`ConnectionConfig`, `IngestionConfig`, `ObjectConfig`)
10. **Cycle 10** — Step 7: optional first load trigger; run `nb_catalog_sync` to verify

### nb_maintenance_objectconfig.py cleansing rules tab

11. **Tidy** — read existing widget structure; identify extension point for new tab
12. **Cycle 11** — add `CleansingRules` tab: add/remove rules per object
    (rule types match `control.CleansingRules` schema)
13. **Cycle 12** — sample data preview before saving (read 10 rows from Silver, apply rule, show diff)

---

## TDD summary

| Cycle | Test class | Key test methods |
|---|---|---|
| 1 | `TestJdbcIntrospectSchema` | `test_information_schema_query_returns_columns`, `test_pk_extracted_from_key_column_usage` |
| 2 | `TestPkInference` | `test_id_suffix_inferred_as_pk`, `test_amber_flag_when_no_formal_pk` |
| 3 | `TestBuildObjectConfigRows` | `test_rows_written_with_is_active_false`, `test_watermark_candidate_detected` |
| 4 | `TestWriteToControlTables` | `test_object_config_insert`, `test_ingestion_config_insert` |
| 5 | `TestRunJdbcIntrospect` | `test_orchestrator_returns_proposed_rows` |
| 6 | `TestSourceWizardSteps` | `test_jdbc_branch_collects_server_database_auth`, `test_rest_branch_collects_base_url_auth` |
| 7 | `TestSourceWizardSteps` | `test_step3_connection_test_called_inline` |
| 8 | `TestSourceWizardSteps` | `test_step4_introspection_skipped_for_non_jdbc` |
| 9 | `TestSourceWizardSteps` | `test_step5_proposed_rows_shown`, `test_step6_control_tables_written` |
| 10 | `TestSourceWizardSteps` | `test_step7_catalog_sync_called_after_write` |
| 11–12 | `TestCleansingRulesTab` | `test_add_rule_inserts_row`, `test_remove_rule_deletes_row` |
| 12 | `TestCleansingRulesTab` | `test_preview_applies_rule_to_sample_rows` |

---

## Key design decisions

- **JDBC introspection is offline-testable** via SQLite stub (same pattern as `nb_utils_fabric_sql`).
  `INFORMATION_SCHEMA` queries work against SQLite in tests.
- **Review-before-enable** — all proposed rows written with `IsActive=False`. Operator activates
  after reviewing PK/watermark assignments.
- **Source wizard is widget-heavy** — the wizard orchestration logic is extracted into
  pure-Python functions and tested separately from the `ipywidgets` display layer.
- **Cleansing rule preview** — reads max 10 rows from Silver to avoid large data moves in the
  notebook UI.

---

## Control table / DDL changes

| Table | Change | Migration guard |
|---|---|---|
| `control.CleansingRules` | Ensure `RuleType` column accepts: `NORMALIZE_TEXT`, `COLUMN_SPLIT`, `NULL_FILL`, `DATETIME_PARSE` | `ALTER TABLE IF NOT EXISTS COLUMN` in nb_bootstrap |

---

## Definition of Done

- [ ] `pytest tests/test_nb_jdbc_introspect.py -v` — all green
- [ ] `pytest tests/test_nb_source_wizard.py -v` — all green
- [ ] `pytest tests/test_nb_maintenance_objectconfig.py -k "CleansingRules" -v` — all green
- [ ] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [ ] `gitleaks detect --verbose` — clean
- [ ] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [ ] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [ ] TD-038 marked resolved in `TECH_DEBT.md`
- [ ] `CleansingRules.RuleType` migration guard in `nb_bootstrap.py`
- [ ] Sprint register updated
