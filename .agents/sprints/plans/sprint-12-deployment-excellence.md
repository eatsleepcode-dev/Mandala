---
sprint: 12
title: "Deployment Excellence — wire React wizard to platform notebooks + validator + connection test"
feature_plan_phase: 1
effort: M + M + S
status: PLANNED
score_before: TBD
score_after_estimate: TBD
adr_required: []
branch: TBD
pre_existing_closed_tds: "TD-031 (SCD2 delete-reinsert) ✅ Done"
---

# Sprint 12 — Deployment Excellence (FEATURE_PLAN Phase 1)

## Context — wizard already exists

**Do not build a new wizard from scratch.** A production-quality 8-step React deployment wizard
already exists, built with React 18 / Vite / anywidget, committed April 2026:

- **React source:** `__inbox/peggy_os_workspace/src/wizard/` (Steps 1–8, manifest-driven,
  Driver.js tours, 111 tests)
- **Built bundle:** `Modules/Hub_Plugins/Deployment_Wizard/wizard_index.js` (949KB ESM)
- **Python backend:** `Modules/Hub_Plugins/Deployment_Wizard/azure_deployment.py` (full trait
  surface, MSAL, Fabric REST)
- **Build command:** `cd __inbox/peggy_os_workspace && npm run build:wizard`

### What the existing wizard covers

| Step | Label | Status |
|---|---|---|
| 1 | Bootstrap (KV URL, SPN credentials, capacity selection) | ✅ Built |
| 2 | Pre-flight (workspace, capacity, Azure, KV, Dataverse checks) | ✅ Built |
| 3 | Infrastructure (Azure ARM provisioning) | ✅ Built |
| 4 | Workspace Connect (capacity & workspace) | ✅ Built |
| 5 | Workspace Sync (Git code migration) | ✅ Built |
| 6 | Cloud Connections (Fabric REST APIs) | ✅ Built |
| 7 | Variable Library (pipeline params) | ✅ Built |
| 8 | Config & Handoff (finalise & deploy) | ✅ Built |

### Gaps vs FEATURE_PLAN P1-A spec

| Gap | Description |
|---|---|
| **SPN-first** | Wizard Step 1 is SPN-only. FEATURE_PLAN + ADR-045 requires Workspace Identity as default, SPN as fallback. WI path not yet in wizard. |
| **Bespoke pre-flight** | Step 2 checks are embedded in `azure_deployment.py`; not reusable. `nb_environment_validator.py` (standalone callable) does not exist. |
| **No `nb_connection_test.py`** | Connection tests are inline in the wizard. No standalone notebook for use outside the wizard (e.g. from CI or `nb_source_wizard`). |
| **Source location** | Wizard JSX lives in `__inbox/peggy_os_workspace/` — a working-copy location. Canonical source should be `peggy-hub-ui` repo (separate JS repo, last updated April 2026). Relationship not formally documented. |
| **No `seed-template.json`** | `config/seed-template.json` does not exist. Wizard loads `seed-dev.json`; no documented template for new environments. |

---

## Goals

| Item | Deliverable | Done when |
|---|---|---|
| P1-A gap | `nb_environment_validator.py` — standalone callable | 7 checks; `ValidationResult` dict; wizard Step 2 calls it via `notebookutils.notebook.run` |
| P1-A gap | `nb_connection_test.py` — standalone callable | JDBC/REST/File/KV test paths; callable from wizard Step 6 and from `nb_source_wizard` |
| P1-A gap | Workspace Identity detection in wizard Step 1 | WI probe added to `azure_deployment.py`; Step 1 UI shows WI as default option when detected |
| P1-C | `config/seed-template.json` | All seed keys documented with null defaults and inline comments |
| Housekeeping | Document `peggy-hub-ui` relationship | `__inbox/peggy_os_workspace/README.md` explains build pipeline and points to `peggy-hub-ui` as canonical source |

---

## Notebook delivery order

### nb_environment_validator.py

1. **Tidy** — read `azure_deployment.py` pre-flight logic; extract the 7 check functions into a
   standalone notebook
2. **Cycle 1** — `ValidationResult` dataclass + `check_variable_library` + `check_lakehouses`
3. **Cycle 2** — `check_control_tables` + `check_kv_accessible`
4. **Cycle 3** — `check_spark_environment` + `check_object_config_populated` + `check_watermarks_writable`
5. **Cycle 4** — `run_validation` aggregator → `ValidationResult(passed, checks)` dict;
   colour-coded text/HTML table output
6. **Cycle 5** — `SkipKVCheck` parameter support; `run_validation` returns programmatically-usable
   dict (not just printed output)

### nb_connection_test.py

7. **Cycle 6** — JDBC `SELECT 1` test + friendly driver-error messages
8. **Cycle 7** — REST base URL GET + ADLS `mssparkutils.fs.ls` + KV secret fetch + Dataverse
   `$top=1` test

### Workspace Identity detection in wizard

9. **Cycle 8** — `azure_deployment.py`: add `_probe_workspace_identity()` — calls
   `notebookutils.credentials.getToken("pbi")` without SPN params; sets `wi_available` traitlet
10. **Cycle 9** — Wizard Step 1 React: when `wi_available=True`, show WI option as default radio;
    SPN fields collapse to secondary option. Rebuild bundle.

### Seed template + docs

11. **Cycle 10** — `config/seed-template.json` with all keys + inline `_comment` fields
12. **Cycle 11** — `__inbox/peggy_os_workspace/README.md` documenting build pipeline, Fabric
    deployment path, and relationship to `peggy-hub-ui` repo

---

## TDD summary

| Cycle | Test class | Key test methods |
|---|---|---|
| 1 | — | structural only |
| 2 | `TestValidationChecks` | `test_check_variable_library_pass`, `test_check_lakehouses_missing_returns_fail` |
| 3 | `TestValidationChecks` | `test_check_control_tables_all_present`, `test_check_kv_inaccessible_returns_fail` |
| 4 | `TestValidationChecks` | `test_check_spark_env_default_returns_warn`, `test_check_watermarks_writable` |
| 5 | `TestRunValidation` | `test_all_pass_returns_green_result`, `test_one_fail_returns_fail_result`, `test_skip_kv_check` |
| 6 | `TestConnectionTestJdbc` | `test_jdbc_select_1_success`, `test_jdbc_driver_error_friendly_message` |
| 7 | `TestConnectionTestRest` | `test_rest_200_returns_pass`, `test_adls_ls_permission_error`, `test_kv_secret_not_found` |
| 8 | `TestWizardWiProbe` | `test_wi_probe_sets_traitlet_true`, `test_wi_probe_sets_false_on_import_error` |
| 9 | — | React unit tests in JS (existing Jest/Vitest suite) |
| 10–11 | — | file existence checks; no unit tests |

---

## Key design decisions

- **`nb_environment_validator` is source of truth** — the wizard Step 2 calls it via
  `notebookutils.notebook.run("nb_environment_validator", {"SkipKVCheck": False})` and reads
  results from the exit value. The bespoke check logic inside `azure_deployment.py` is
  **not** removed this sprint (backward compat); it is superseded but left in place.
- **WI probe is non-breaking** — `_probe_workspace_identity()` is wrapped in try/except;
  if `notebookutils` is unavailable (local dev), `wi_available=False` silently. SPN path is
  unchanged.
- **`peggy-hub-ui` relationship** — documented only this sprint; source migration (moving JSX out
  of `__inbox/`) is deferred to a dedicated housekeeping sprint to avoid disrupting the build pipeline.
- **`seed-template.json` uses `_comment` keys** — JSON does not support comments; `_comment_<key>`
  convention (matching FMD's documentation pattern) is used to annotate each field.

---

## Control table / DDL changes

None required. All new notebooks use existing control tables.

---

## Definition of Done

- [ ] `pytest tests/test_nb_environment_validator.py -v` — all green
- [ ] `pytest tests/test_nb_connection_test.py -v` — all green
- [ ] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [ ] `gitleaks detect --verbose` — clean
- [ ] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [ ] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [ ] `nb_environment_validator.py` — 7 checks; `ValidationResult` dict; `SkipKVCheck` param
- [ ] `nb_connection_test.py` — JDBC/REST/File/KV/Dataverse paths tested
- [ ] `azure_deployment.py` — `_probe_workspace_identity()` added; `wi_available` traitlet set
- [ ] `config/seed-template.json` created
- [ ] `__inbox/peggy_os_workspace/README.md` documents build pipeline + peggy-hub-ui relationship
- [ ] Sprint register updated
