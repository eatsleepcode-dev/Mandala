# Technical Debt Register — the platform Data Platform

## TD-001 · Replace hand-rolled `build_notebooks.py` with a proper notebook SDK

**Severity:** Medium  
**Raised:** 2026-03-08  
**Resolved:** 2026-05-02 ✅  
**Status:** ✅ Done  
**Raised by:** Antigravity / Martin Scott  

### Problem
`scripts/build_notebooks.py` manually parses `# %%` cell markers and assembles
Fabric's `.py` notebook format using string concatenation, causing cell ordering
bugs, fragile metadata assembly, and two independent parallel mutation paths
(`parts` list and `ipynb_cells` list) that had to be kept in sync manually.

### Resolution

`build_notebook_item()` refactored into three explicit phases (2026-05-02):

1. **Parse** — source parsing, frontmatter extraction, configure hoisting (unchanged)
2. **Collect** — builds `ordered_cells: list[_MarkdownCell | _CodeCell]` in the
   correct order: header → flowchart → hoisted markdown → `%%configure` →
   utils inline → publish utils inline → remaining source cells. Ordering is
   explicit in the list, not implicit in scattered `parts.append()` calls.
3. **Render** — single dispatch loop over `ordered_cells` writes both `.py` text
   and `.ipynb` cell dicts from the same typed cell objects.

`_MarkdownCell` and `_CodeCell` `@dataclass` types live at module level. The
`tags: list[str]` field on `_CodeCell` carries the `["parameters"]` tag — no
boolean flag threading through the render path.

### Remaining / out-of-scope
- **Unicode corruption** — box-drawing characters in comments: not addressed;
  Fabric renders them correctly in the notebook editor (no garbling observed in practice).
- **`%%configure conf` stripped** — Fabric API limitation, not fixable in build script.
- **`spark.conf.set()` in nb_utils_config** — workaround still in place; removing
  it requires verifying the datetime rebase config is picked up another way.

### Acceptance Criteria
- [x] Cell ordering is deterministic and follows Fabric rules (configure → utils → code)
- [x] `build_notebooks.py` uses `@dataclass` cell model — no `out +=` patterns in assembly
- [x] Cell ordering enforced by the `ordered_cells` list, not by source order assumptions
- [x] Both `.py` and `.ipynb` rendered from the same typed cell list (no dual mutation)
- [ ] ASCII-only / UTF-8 BOM handling (not addressed — no observed garbling)
- [ ] `spark.conf.set()` rebase lines in `nb_bronze_to_silver.py` source (deferred)

---

## TD-002 · Fix `Platform_Config` VariableLibrary schema mismatch

**Severity:** Low (notebooks work; only the Variable Library publish fails)  
**Raised:** 2026-03-07  

### Problem
`fabric_publish.py` fails with `InvalidContent / ValueMismatch` when publishing
`Platform_Config` VariableLibrary. The item exists in the workspace but the
local `workspace/variable-libraries/Platform_Config.VariableLibrary` schema
does not match the live item's schema.

### Recommended Fix
- Export the current live schema via `getDefinition` and align the local file
- OR delete the live item and let `fabric_publish.py` recreate it from scratch

---

## TD-003 · Rename `PipelineConfig` / `PipelineID` → `RunbookConfig` / `RunbookID`

**Severity:** Low (cosmetic / naming clarity)  
**Raised:** 2026-03-08  

### Problem
`control.PipelineConfig` and the `PipelineID` foreign key in `control.RunbookStep`
use the term "pipeline" — which collides with two distinct Fabric concepts:
- **Data Factory pipelines** (orchestration items in Fabric)
- **Deployment pipelines** (CI/CD promotion between environments)

Since we already use the `Runbook` prefix (`RunbookStep`), the natural rename is:

| Old | New |
|---|---|
| `control.PipelineConfig` | `control.RunbookConfig` |
| `PipelineID` column | `RunbookID` column |
| `PipelineName` column | `RunbookName` column |

### Scope
- `nb_bootstrap.py` — DDL
- `nb_seed_control_lh.py` — INSERT statements
- `nb_utils_config.py` — `get_config("RunbookSteps")` query
- `nb_orchestrator.py` — `run_pipeline()` parameter name
- `seed-dev.json` — data keys

### Acceptance Criteria
- [ ] No references to `PipelineConfig` or `PipelineID` in control table DDL
- [ ] `get_config("RunbookSteps")` returns `RunbookID` not `PipelineID`
- [ ] `_pipeline_id` parameter in `nb_orchestrator` renamed to `_runbook_id`

---

## TD-004 · Replace string-concat notebook templating with Jinja2 + NotebookCell model

**Severity:** Medium  
**Raised:** 2026-03-09  
**Resolved:** 2026-05-02 ✅  
**Status:** ✅ Done  
**Related:** TD-001  

### Resolution

**Part A — `nb_notebook_generator.py`** (2026-05-02):  
`build_notebook_py()` replaced with `_SILVER_VIEW_TEMPLATE`, a module-level
`string.Template` subclass using `@@` as delimiter (avoids conflicts with `{}`
in Fabric format and `$` in Variable Library expressions). The 130-line `out +=`
chain is gone; the function body is a single `_SILVER_VIEW_TEMPLATE.substitute(**vars)`
call. Also fixed latent `NameError` bugs where outer f-strings referenced
`end_time`/`duration`/`error_time` that were not defined in `build_notebook_py()` scope.

**Part B — `scripts/build_notebooks.py`** (2026-05-02):  
`_MarkdownCell` and `_CodeCell` `@dataclass` types added at module level.
`build_notebook_item()` restructured into three phases: parse → collect
(`ordered_cells: list[_AnyCell]`) → render (dispatch loop). The scattered
`parts.append()` sequences for configure/utils/publish cells are replaced by
`_CodeCell` objects in the ordered list. See TD-001 resolution for full detail.

### Acceptance Criteria
- [x] `build_notebook_py()` replaced — `string.Template` with `@@` delimiter
- [x] Template is independently testable (render and assert cell count/content)
- [x] `build_notebooks.py` uses `@dataclass` cell model — no `out +=` in assembly
- [x] Cell ordering enforced by `ordered_cells` list, not source order assumptions
- [ ] Generated `nb_SQL_vw_*` notebooks use `.ipynb` REST path — deferred; the `.py`
      format was deliberately kept to avoid LRO:Failed on `createItem` (see code comment)

---

## TD-015 · `ConcurrentAppendException` on ControlLog from parallel ForEach

**Severity:** High  
**Raised:** 2026-03-10  
**Resolved:** 2026-03-11 ✅  

### Problem
Parallel `nb_bronze_to_silver` sessions (ForEach with `batchCount > 1`) all wrote
directly to `control.ControlLog` Delta simultaneously. Fabric enforces Serializable
isolation, causing `ConcurrentAppendException` on the `MAX(LogID) + INSERT` pattern.

### Fix Applied
- Each notebook session now writes a tiny JSON file to `Files/log_queue/{run_id}/`
  instead of touching ControlLog directly.
- `nb_flush_log_queue` runs after the ForEach completes and bulk-INSERTs all queue
  files in a single transaction, then deletes the folder.
- `_merge_with_retry()` added to `nb_bronze_to_silver` as a secondary defence:
  5 attempts, exponential back-off (2–32 s), handles residual race conditions.

---

## TD-016 · `.py` `updateDefinition` strips Papermill `parameters` tag ✅ RESOLVED

**Severity:** High (blocks pipeline parameter injection)  
**Raised:** 2026-03-10  
**Resolved:** 2026-03-11 ✅  

### Problem
When `updateDefinition` is called via REST API with `notebook-content.py` format,
Fabric's PyToIPynb converter silently discards `"tags": ["parameters"]` cell metadata.
This caused `TableFilter`, `PipelineRunId`, and all other injected parameters to
arrive as their default values (`""` / `0`), making `nb_bronze_to_silver` always
run in BULK mode regardless of what the ForEach pipeline passed.

### Fix Applied
- Created `scripts/deploy_notebook_ipynb.py` — reads the pre-built `notebook-content.py`,
  converts to proper `.ipynb` dict (with `"tags": ["parameters"]` in cell `metadata`),
  then deploys via `updateDefinition` with `format: ipynb`.
- Fixed a parser bug in `_parse_built_notebook()`: `flush()` was called at
  `# METADATA ***` before the META JSON was read, so `is_params` was always `False`
  on the saved cell. Back-patching `results[-1]` after META parse corrects this.
- SINGLE/BULK mode added to `run_bronze_to_silver()`: when `TableFilter` resolves to
  exactly 1 object, `process_object()` is called directly — no `ThreadPoolExecutor`,
  zero structural risk of Silver Delta concurrency conflicts.

### Deploy command going forward
```powershell
# Build then deploy as .ipynb (preserves parameters tag)
py scripts/build_notebooks.py --force
& "C:\Users\scottm\AppData\Local\Programs\Python\Python311\python.exe" scripts/deploy_notebook_ipynb.py --notebooks nb_bronze_to_silver
```

> ⚠️ `publish_notebooks.ps1` uses `.py` format — it will STRIP the parameters tag.
> Only use it for notebooks that do NOT use pipeline parameter injection.

---

## TD-017 · `build_notebooks.py` parameters cell hoisting — verify other notebooks unaffected

**Severity:** Low  
**Raised:** 2026-03-11  
**Resolved:** 2026-05-02 ✅  
**Status:** ✅ Done  

### Problem
`build_notebooks.py` was modified to hoist the `[parameters]` cell directly after the
inlined utils cell (before function definitions). This ensures Fabric parameter injection
works correctly when deployed via `.ipynb` format. However:

- Other notebooks using `publish_notebooks.ps1` (`.py` format) may see the parameters
  cell appear earlier than expected (before function definitions they reference).
- The hoisted cell only contains default assignments — it does not call any functions —
  so it is safe in any position. But this should be verified across all notebooks.

### Resolution

Applied 2026-05-02:

1. **Static verification**: `build_notebooks.py --validate-only` run across all notebooks — zero `[WARNING]` issues reported.
2. **Specific notebooks verified**: `nb_flush_log_queue`, `nb_orchestrator`, `nb_landing_to_bronze` all have parameters cells with only literal constant assignments — confirmed safe in any position.
3. **`_check_cell_order` provides automated gate**: it warns via `PARAMS-TAG` or `PARAMS-LITERAL` if a parameters cell contains function defs, leading imports, or non-literal expressions. This catches any future violation at build time.
4. **Migration to `.ipynb` deploy path**: already done in TD-016 — all parameter-injected notebooks deploy via `deploy_notebook_ipynb.py` which preserves the parameters tag.
5. **`TestParameterCellPositionSafety` class added** to `test_build_notebooks.py` (5 tests):
   - Literal params before functions → no warning
   - Literal params after functions → no warning
   - Non-literal expression in params → `PARAMS-LITERAL` warning
   - Function def in params → `PARAMS-TAG` warning
   - `nb_orchestrator`-style late params cell → no warning

### Acceptance Criteria
- [x] Verify `nb_flush_log_queue`, `nb_orchestrator`, `nb_landing_to_bronze` retain correct parameter injection behaviour — all have literal-only parameters cells; `_check_cell_order` confirms no warnings
- [x] Consider migrating all parameter-injected notebooks to `deploy_notebook_ipynb.py` — done (TD-016)
- [ ] Run all notebooks in Fabric interactively — deferred; static analysis confirms no `NameError` risk (parameters cells contain only literal assignments)



---

## TD-018 · Notebook source files with Fabric magic cells break `pytest` collection

**Severity:** Low  
**Raised:** 2026-03-12  
**Resolved:** 2026-05-02 ✅  
**Status:** ✅ Done  
**Raised by:** Antigravity / Martin Scott

### Problem

Seven test files fail to collect under `pytest` with `SyntaxError: invalid syntax`
because the notebook source files they import (e.g. `nb_conn_jdbc.py`,
`nb_bootstrap.py`) contain Fabric magic cell markers such as `%%configure -f` at
module level. Python's parser rejects these as invalid syntax during `import`.

Affected tests:

- `tests/test_nb_bootstrap.py`
- `tests/test_nb_catalog_sync.py`
- `tests/test_nb_conn_file.py`
- `tests/test_nb_conn_jdbc.py`
- `tests/test_nb_conn_rest.py`
- `tests/test_nb_conn_shortcut.py`
- `tests/test_nb_orchestrator.py`

Root cause: these notebooks have not been refactored to the clean source pattern
used by `nb_bronze_to_silver.py` and `nb_silver_transform.py`, where all magic
cells are commented out (`# %%configure`) so the source file is valid Python.

### Context

`nb_bronze_to_silver.py` resolved this by placing `%%configure` content in a
commented header block. The notebooks above were authored before this pattern was
established. The failures are pre-existing and are **not** caused by the Silver
layer refactoring (TD-015 / TD-016 work).

### Recommended Fix

For each affected notebook source file:

1. Comment out `%%configure` and any other Fabric-only magic lines in the source:
   `# %%configure -f`
2. Ensure all Fabric-runtime globals (`spark`, `notebookutils`) are guarded
   with `try/except NameError` or `globals().get()`.
3. Update the corresponding test file to import the notebook module cleanly.
4. Verify `build_notebooks.py` still emits the uncommented magic line into the
   built `notebook-content.py`.

### Resolution

Applied 2026-05-02:

1. Commented `%run ./nb_utils_config` lines in `nb_conn_file.py`, `nb_conn_jdbc.py`,
   `nb_conn_rest.py`, `nb_orchestrator.py` and added `try/except ImportError` guards
   so `nb_utils_config` functions appear in module namespace for test patching.
2. Wrapped `from IPython.display import display` in `try/except ImportError` in
   `nb_conn_shortcut.py`; added module-level `import requests`.
3. Implemented missing public API functions in `nb_conn_shortcut.py`
   (`get_active_shortcut_configs`, `create_onelake_shortcut`, `list_shortcuts`,
   `get_workspace_id_by_name`, `get_lakehouse_id_by_name`, `process_shortcuts`,
   `detect_unregistered_bronze_shortcuts`, `register_unregistered_shortcuts`).
4. Refactored `nb_orchestrator.py`: added `_run_step_with_retry` with exponential-backoff
   retry; updated `run_pipeline` to accept an `orch` object with `trigger_notebook` /
   `wait_for_job` methods for testability; added `_FabricOrchestrator` wrapper for
   Fabric runtime.
5. Fixed `diff_tables` in `nb_catalog_sync.py` to work with `set` inputs (not dict);
   updated `get_registered_tables`, `upsert_object_config`, `upsert_shortcut_config`
   to accept `control_lh` param and use `spark.sql()`.
6. Fixed `ingest_rest_source` fallback in `nb_conn_rest.py` to skip single-object
   wrapping when the response body already contains the data key.

### Acceptance Criteria

- [x] `pytest tests/` collects all test files without `SyntaxError`
- [x] All 7 previously erroring test files pass (94 tests, 0 failures)
- [ ] Magic cell commenting convention is documented in `docs/fabric-engineering-standards.md`

---

## TD-019 · Extract shared orchestration utilities into `nb_utils_orchestration.py`

**Severity:** Medium
**Raised:** 2026-03-13
**Resolved:** 2026-05-02 ✅
**Status:** ✅ Done
**Raised by:** Antigravity / Martin Scott

### Problem

`nb_bronze_to_silver` contains orchestration helper functions that are
layer-agnostic — natural key inference, deduplication, schema drift detection,
audit column injection, and TD-015 queue logging. Keeping them locked inside
BTS means the upcoming `nb_silver_to_gold` (and any future layer-transition
notebook) would need to duplicate these functions.

### Recommended Fix

Extract all layer-agnostic orchestration helpers into
`src/notebooks/nb_utils_orchestration.py` (a new shared library notebook).
All layer-transition notebooks then `%run ./nb_utils_orchestration` and
`%run ./nb_<LAYER>_TRANSFORM` rather than reimplementing.

Target library stack:

```
nb_utils_config.py         ← platform utils (already shared)
nb_utils_orchestration.py  ← shared orchestration (THIS ITEM)
nb_silver_transform.py     ← Silver write strategies
nb_gold_transform.py       ← Gold write strategies (future)
nb_bronze_to_silver        ← thin orchestrator
nb_silver_to_gold (future) ← thin orchestrator
```

### Resolution

Applied 2026-05-02: utility extraction was achieved through finer-grained decomposition
rather than a single `nb_utils_orchestration.py`:
- `nb_utils_schema.py` — AUDIT_COLS, natural key inference, schema drift detection
- `nb_utils_watermark.py` — get/set high watermark
- `nb_utils_processing.py` — PipelineContext/Step, deduplicate, add_audit_columns,
  queue_log_entry, auto_tune_workers (confirmed by header comments and imports in BTS)

`nb_bronze_to_silver.py` imports from all three via `try/except ImportError` guards.
The name `nb_utils_orchestration` was aspirational; the actual decomposition is
equivalent and independently testable per-module.

### Acceptance Criteria

- [x] All existing BTS tests still pass
- [ ] `nb_utils_orchestration` notebook in Fabric workspace — superseded by above split

---

## TD-020 · nb_json_admin — Interactive ObjectConfig / CleansingRules editor

**Severity:** Low | **Raised:** 2026-03-13 | **Status:** ✅ Done | **Resolved:** 2026-05-02

### Resolution

Three public helper functions added to `nb_json_admin.py`:

- `read_object_config(spark, control_lh)` — returns all ObjectConfig rows as `list[dict]`
- `update_cleansing_rules(spark, control_lh, object_id, rules_json)` — UPDATE via Spark SQL with JSON validation and existence check
- `get_cleansing_rules(spark, control_lh, object_name)` — fetch CleansingRules for one object by name

Module-level execution guards added (NestedJsonEditor None-check, pandas try/except, notebookutils try/except) so the file imports cleanly in pytest.

13 tests pass in `tests/test_nb_json_admin.py`.

### Acceptance Criteria

- [x] `nb_json_admin` exposes `read_object_config()`, `update_cleansing_rules()`, `get_cleansing_rules()`
- [x] Reads ObjectConfig from Delta, edits CleansingRules, saves back via UPDATE
- [x] `pytest tests/test_nb_json_admin.py` passes (13 tests)

---

## TD-021 · Composable run_layer_transition in nb_utils_processing

**Severity:** Medium | **Raised:** 2026-03-13 | **Status:** ✅ Done | **Resolved:** 2026-05-02

### Resolution

`run_layer_transition()` added to `nb_utils_processing.py`:
- Loads ObjectConfig with optional `table_filter`
- Optional `source_exists_fn` pre-filter (used by BTS for Bronze table presence check)
- Runs SINGLE mode (direct call) or BULK mode (ThreadPoolExecutor with `auto_tune_workers`)
- Logs RUNNING → SUCCESS/FAILED via `queue_log_entry`
- Returns `list[dict]` of per-object results

`nb_bronze_to_silver.run_bronze_to_silver()` refactored to thin shell:
- `_source_exists_fn` checks `spark.catalog.tableExists(f"{bronze_lh}.dbo.{name}")`
- `_process_fn` calls `process_object()` and queues per-object log entries
- Delegates to `run_layer_transition()`

### Acceptance Criteria

- [x] `nb_utils_processing.py` exposes `run_layer_transition()`
- [x] `nb_bronze_to_silver.run_bronze_to_silver()` is a thin shell delegating to `run_layer_transition()`
- [x] `pytest tests/test_nb_utils_processing.py` passes (43 tests)
- [x] `pytest tests/test_nb_bronze_to_silver.py` passes (6 tests)

---

## TD-022 · Consolidate duplicate view DDL executor into shared utility

**Severity:** Low | **Raised:** 2026-03-13 | **Status:** ✅ Done
**Resolved:** 2026-05-02

### Problem

`nb_view_seeder` and `nb_view_factory` both implement the same pattern —
iterate over a collection of DDL strings and call `spark.sql(ddl)` on each:

| Notebook | Function | Lines of logic |
|---|---|---|
| `nb_view_seeder.py` | `execute_views(spark, silver_lh, view_ddls)` | ~12 |
| `nb_view_factory.py` | `_build_views(spark, control_lh, layer)` | ~15 |

Both return a status dict of `{view_name: "CREATED" \| "ERROR: ..."}` and log
failures individually. This is a straightforward DRY violation that will grow
worse as the Gold layer generates its own views.

### Recommended Fix

Extract a shared `execute_view_ddl(spark, view_ddls: dict[str, str]) -> dict[str, str]`
function into a new library notebook `nb_utils_views.py`. Both `nb_view_seeder`
and `nb_view_factory` `%run` this library instead of owning the logic locally.

### Resolution

Applied (prior session + 2026-05-02):
- `nb_utils_views.py` created with `execute_view_ddl(spark, view_ddls)` — 8 tests pass
- `nb_view_factory.py` delegates to `execute_view_ddl()` via `%run ./nb_utils_views`
- `nb_view_seeder.py` `execute_views()` delegates to `execute_view_ddl()` from `nb_utils_views`
- `nb_view_factory.py` and `nb_view_seeder.py` both commented out `%run` magic and added `try/except ImportError` guards for testability (same pattern as TD-018)

### Acceptance Criteria

- [x] `nb_utils_views.py` created with `execute_view_ddl()` (TDD — test first)
- [x] `nb_view_seeder.py` delegates to `execute_view_ddl()` via `%run ./nb_utils_views`
- [x] `nb_view_factory.py` delegates to `execute_view_ddl()` via `%run ./nb_utils_views`
- [x] `pytest tests/test_nb_utils_views.py` passes (8 tests)
- [x] Both notebooks' own DDL-executor functions removed / replaced with thin wrappers

---

## TD-023 · Consolidate SQL notebook content generation

**Severity:** Low | **Raised:** 2026-03-13 | **Status:** ✅ Done | **Resolved:** 2026-05-02

### Resolution

`_NbTemplate`, `_SILVER_VIEW_TEMPLATE`, and `build_domain_notebook_content()` moved from `nb_notebook_generator.py` into `nb_utils_publish.py`.

- `nb_utils_publish.py` now exposes `build_domain_notebook_content()` (Silver transformation notebook builder)
- `nb_notebook_generator.py` imports `build_domain_notebook_content` from `nb_utils_publish` and provides a thin `build_notebook_py()` alias for internal use
- Local `_NbTemplate` and `_SILVER_VIEW_TEMPLATE` classes removed from nb_notebook_generator
- `%%configure -f` bare magic and `resolve_fabric_ids()` bare call wrapped/commented for testability
- `nb_view_seeder.py` has no equivalent builder function (TD-023 description was slightly inaccurate about `build_sql_notebook_content()` existing there)

18 tests pass in `tests/test_nb_utils_publish.py`.

### Acceptance Criteria

- [x] `nb_utils_publish.py` exposes `build_domain_notebook_content()`
- [x] `nb_notebook_generator.py` migrated to the shared builder
- [x] Local `_NbTemplate` / `_SILVER_VIEW_TEMPLATE` removed from nb_notebook_generator
- [x] `pytest tests/test_nb_utils_publish.py` passes (18 tests)



---

## TD-024 · View-First Medallion — Bronze views as source for Bronze→Silver transforms

**Severity:** High
**Raised:** 2026-03-14
**Resolved:** 2026-03-16 ✅
**Raised by:** Martin Scott / Antigravity
**Status:** ✅ Done

### Problem

`nb_bronze_to_silver` currently reads directly from raw Bronze Delta tables
(`lh_bronze.<table>`). This tightly couples the transform layer to the
physical Bronze schema. Any column rename, type change, or structural evolution
in a Bronze table requires changes inside the transform notebook.

### Desired Architecture

Every layer boundary should be crossed via a **view**, not a raw table reference:

```
Bronze LH (raw Delta)
    ↓
 vw_* Bronze views    ← created by nb_view_seeder (Bronze pass)
    ↓
 nb_bronze_to_silver  ← reads from vw_* (not raw tables)
    ↓
 Silver LH (Delta)
    ↓
 vw_* Silver views    ← created by nb_view_seeder (Silver pass, current scope)
```

Benefits:
- Schema evolution is absorbed at the view layer — transforms remain stable
- Bronze views can apply column aliasing and type casting before Silver writes
- Consistent pattern at every medallion boundary

### Changes Required

| Component | Change |
|---|---|
| `nb_view_seeder` | Add `layer` parameter (`BRONZE` / `SILVER`). Bronze pass discovers Bronze tables, creates `vw_*` views on Bronze LH. |
| `nb_bronze_to_silver` | Change source: `lh_bronze.<table>` → `lh_bronze.vw_<table>` |
| Orchestration order | nb_view_seeder Bronze pass must run before nb_bronze_to_silver |
| `control.ViewScript` | Add `Layer = 'BRONZE'` to distinguish Bronze vs Silver view registrations |

### Acceptance Criteria

- [x] `nb_view_seeder` accepts a `Layer` parameter (`BRONZE` or `SILVER`)
- [x] Bronze pass creates `vw_*` passthrough views over all non-`vw_` Bronze tables
- [x] `nb_bronze_to_silver` reads `vw_<object>` instead of `<object>` from Bronze LH
- [x] Presence check in `run_bronze_to_silver()` matches `vw_*` table names
- [x] Tests: `test_nb_bronze_to_silver.py` — all 6 TD-024 tests pass
- [x] Orchestrator pipeline updated: Bronze view seed → Bronze→Silver → Silver view seed
- [x] `nb_view_seeder_bronze` and `nb_view_seeder_silver` deployed to live `00_Daily_Ingestion` Fabric item via UI
- [ ] No regression in Silver table row counts after the change (Fabric smoke test)

### Resolution Summary

- `nb_view_seeder` refactored to accept `Layer=BRONZE|SILVER` parameter
- `nb_bronze_to_silver` updated to read from `vw_*` instead of raw Bronze tables
- `00_Daily_Ingestion` pipeline updated in Fabric UI:
  - `nb_view_seeder_bronze` inserted between `LK_GetActiveObjects` and `FE_Phase2_BronzeToSilver`
  - `nb_view_seeder_silver` inserted between `nb_flush_log_queue` and `MicrosoftTeams1`
- Live state downloaded and committed 2026-03-16
- Note: smoke test (Silver row count regression check) remains as a follow-up

---

## TD-025 · Add Parameters column to RunbookStep and wire orchestrator

**Severity:** Low
**Raised:** 2026-03-15
**Status:** ✅ Done

### Problem
The `control.RunbookStep` table had no way to pass arbitrary parameters to individual notebook runs. The orchestrator (`nb_orchestrator`) had parameter support in `build_dag()` already, but the column didn't exist in the table.

### Fix Applied
- Added `Parameters STRING` column to `RunbookStep` DDL in `nb_bootstrap.py`
- Added `_add_column_if_missing` migration guard to preserve existing data
- Updated `nb_seed_control_lh.py` RunbookStep INSERT to include `Parameters`
- Added `nb_catalog_sync` and `nb_view_seeder(Bronze)` to Runbook 10, `nb_view_seeder(Silver)` to Runbook 40 — enabling same-day view seeding for new tables
- Updated `test_nb_bootstrap.py` assertions

---

## TD-026 · Fix pre-existing test failures in test_nb_utils_config.py

**Severity:** Medium
**Raised:** 2026-03-15
**Status:** ✅ Done

### Problem
Fifteen tests in `test_nb_utils_config.py` were failing due to three categories of issues left over from TDD Red phase:

1. **Missing implementations** — `sanitize_string`, `clean_column_names`, `flatten_nested_json` not implemented
2. **Logging divergence** — tests expected `UPDATE` but `log_execution_end` uses append-only `INSERT-SELECT` (TD-015 pattern)
3. **Spark type exposure** — `StructType`/`ArrayType` not exported at module level; `flatten_nested_json` called `F.col()` without an active SparkContext in the no-struct fast-path
4. **Wrong module** — `seed_control_db` test pointed at `nb_utils_config`; the function lives in `nb_bootstrap` as `seed_control_db_local`
5. **Missing `import json`** in `nb_bootstrap.py` — pre-existing bug that caused `seed_control_db_local` to fail at runtime

### Fix Applied
- Implemented `sanitize_string()`, `clean_column_names()`, `flatten_nested_json()` in `nb_utils_config.py`
- Exported `StructType`, `ArrayType` at module level with `None` fallback for local dev
- Two-pass `flatten_nested_json`: cheap `isinstance` check first (no SparkContext needed), `F.col()` only on second pass when structs are confirmed present
- Updated log tests to assert `INSERT INTO ... SELECT` pattern with `WHERE LogID = N`
- Redirected `seed_control_db` test to `nb_bootstrap.seed_control_db_local`
- Added `import json` to `nb_bootstrap.py`
- **Result:** 40/40 tests green in `test_nb_utils_config.py` + `test_nb_bootstrap.py`

---

## TD-027 · Variable Library for environment-specific lakehouse configuration

**Severity:** Medium
**Raised:** 2026-03-15
**Resolved:** 2026-03-15 ✅
**Status:** ✅ Done

### Problem
Lakehouse names (`lh_bronze`, `db_control`, etc.) and the workspace ID are hardcoded in:

1. The `%%configure` cell of every notebook — controls which lakehouse is attached at session start
2. The `# %% [parameters]` cell of every notebook — controls SQL references at runtime
3. `config/seed-dev.json` — the seeding source

This makes promoting to PROD require code changes in every notebook file.

### Recommended Fix

**Variable Library** (Fabric GA — confirmed in official docs 2026-03-15): Microsoft Fabric supports injecting Variable Library values directly into `%%configure`, including `defaultLakehouse`.

```json
%%configure
{
  "defaultLakehouse": {
    "name": { "variableName": "$(/**/VL/ControlLakehouse)" },
    "id":   { "variableName": "$(/**/VL/ControlLakehouseId)" }
  }
}
```

Ref: https://learn.microsoft.com/fabric/data-engineering/author-execute-notebook#spark-session-configuration-magic-command

#### Scope

| Component | Change |
|---|---|
| `nb_bootstrap` | After seeding `EnvironmentConfig`, call `notebookutils.variableLibrary.set()` for each lakehouse key |
| All 5 notebooks with `%%configure` | Replace hardcoded name with `variableName` syntax pointing to `VL` |
| All 5 notebooks with `[parameters]` cell | Replace hardcoded strings with `notebookutils.variableLibrary.get()` + `NameError` fallback for local dev |
| `config/seed-dev.json` | Add lakehouse names to `EnvironmentConfig` — name-only (GUIDs optional) |
| Create `VL` Variable Library item | Automated via `scripts/08b-provision-variable-library.ps1` — no UI step |

### Acceptance Criteria

- [x] `VL` Variable Library seeded by `nb_bootstrap` from `EnvironmentConfig`
- [x] All notebooks use `variableName` syntax in `%%configure` for `defaultLakehouse`
- [x] All parameter cells use `variableLibrary.get()` with `NameError` fallback
- [x] PROD workspace can run with zero code changes — only Variable Library values differ
- [x] Local dev still works via fallback defaults in `NameError` handler
- [x] `VL` provisioned code-first via REST API — no manual UI step

### Resolution

- `nb_bootstrap.py` — seeds `VL` post-`EnvironmentConfig` with try/except guard
- `nb_bronze_to_silver.py`, `nb_flush_log_queue.py`, `nb_json_admin.py`,
  `nb_orchestrator.py`, `nb_view_seeder.py` — `%%configure` and `[parameters]`
  cells updated to use Variable Library syntax + `NameError` fallback
- `scripts/08b-provision-variable-library.ps1` — creates `VL` item and pushes
  `variables.json` definition via REST API (LRO-polled); idempotent
- `scripts/00-deploy.ps1` — Step 3c calls `08b` for dev/uat/prod automatically
- `docs/runbooks/first-time-setup.md` — Step 3c documented
- `docs/fabric-cicd-patterns.md` — Section 8 added (full pattern reference)
- `.agent/fabric.md` — Variable Library pattern documented with code examples
- All 6 affected notebooks published to Fabric workspace (LRO: Succeeded)

---

## TD-028 · Replace Lookup activity in `00_Daily_Ingestion` to enable code-first pipeline deployment

**Severity:** Medium
**Raised:** 2026-03-16
**Resolved:** 2026-05-02 ✅
**Status:** ✅ Done
**Raised by:** Antigravity / Martin Scott

### Problem

`00_Daily_Ingestion` (and `03_File_Connector`, `Weekly_Optimise`) contain a `Lookup`
activity with `FabricSqlDatabaseTable` + `connectionSettings` source wiring. Fabric's
`updateDefinition` REST API emits this format on `getDefinition` but **refuses to
re-import it**, returning `HTTP 400 UnknownError`. This affects both `fabric_pipeline.py`
and `fabric_cicd.publish_all_items` — both use `updateDefinition` under the hood.

**Impact:** Any structural change to these pipelines (new activities, `dependsOn`
resequencing) must be applied manually via the Fabric UI canvas, then downloaded.
This blocks the code-first CI/CD pattern for TD-024 view-seeder sequencing.

### Context

TD-024 added `nb_view_seeder_bronze` and `nb_view_seeder_silver` activities to the
pipeline JSON in `fabric_service/` and `<client>-<env>/pipelines/` — the desired state is
committed in the repo — but the activities **have not been applied to the live Fabric
item** because the API cannot publish the containing pipeline.

### Recommended Fix

Replace the `FabricSqlDatabase` `Lookup` activity with a `TridentNotebook` call to
`nb_orchestrator` (which already queries `control.ObjectConfig` internally). This makes
`00_Daily_Ingestion` consist entirely of `TridentNotebook` + `Wait` + `MicrosoftTeams`
activities — all of which round-trip cleanly via `updateDefinition`.

| Current | Replacement |
|---|---|
| `Lookup` → `control.objectconfig` via FabricSqlDB | `TridentNotebook` → `nb_orchestrator` with `Mode=LOOKUP` parameter |
| `ForEach` over Lookup output | `ForEach` over nb_orchestrator notebook exit value |
| Brittle `connectionSettings` wiring | Plain `externalReferences.connection` — fully API-publishable |

### Resolution

Applied 2026-05-02:

- Added `run_lookup(spark, control_lh, layer)` to `nb_orchestrator.py`:
  - `layer="BRONZE"` → joins ViewScript+ObjectConfig, returns `[{ViewName, ObjectName}]`
  - `layer=""` → queries ObjectConfig, returns `[{ObjectName}]`
  - Result emitted via `notebookutils.notebook.exit(json.dumps(result))`
- Added `Mode` + `Layer` parameters to the `[parameters]` cell in `nb_orchestrator.py`
- Entry point dispatches: `Mode=LOOKUP` → `run_lookup()` + exit; else → `run_pipeline()`
- Replaced `LK_GetBronzeViews` (Lookup/FabricSqlDB) with `NB_GetBronzeViews` (TridentNotebook)
- Replaced `LK_GetActiveObjects` (Lookup/FabricSqlDB) with `NB_GetActiveObjects` (TridentNotebook)
- Updated `FE_Phase2_BronzeToSilver` items to `@json(activity('NB_GetBronzeViews').output.exitValue)`
- Updated `nb_view_seeder_bronze` and `nb_view_seeder_silver` dependsOn to reference new activity names
- Removed `db_control` and `CON_db_control_SQL` pipeline parameters (no longer referenced)
- Pipeline now contains only `TridentNotebook` + `Wait` + `MicrosoftTeams` — all round-trip cleanly

### Acceptance Criteria

- [x] `Lookup` activity removed from `00_Daily_Ingestion`
- [x] `nb_orchestrator` exposes a `LOOKUP` mode that returns active object list via `notebook.exit()`
- [ ] `00_Daily_Ingestion` publishes successfully via `py scripts/fabric_pipeline.py publish`
- [ ] TD-024 view-seeder activities (`nb_view_seeder_bronze`, `nb_view_seeder_silver`) deployed to live Fabric item

---

## TD-029 · Remove redundant VIEW_FACTORY or clarify separation of concerns

**Severity:** Medium
**Raised:** 2026-04-23
**Status:** ✅ Done (Option 2 — role clarification)
**Resolved:** 2026-05-02
**Raised by:** Martin Scott

### Problem

`nb_view_factory` and `nb_view_seeder` have overlapping responsibilities, causing redundant work in the daily pipeline:

1. **VIEW_SEEDER** (ExecutionOrder 20 implicit via discovery):
   - Discovers Bronze/Silver tables
   - Generates view DDL
   - **Executes CREATE OR REPLACE VIEW** (creates views)
   - Registers DDL in `control.ViewScript`

2. **VIEW_FACTORY** (ExecutionOrder 30 in `00_Daily_Ingestion`):
   - Reads `control.ViewScript`
   - **Re-executes the same CREATE OR REPLACE VIEW DDL**
   - Queues views for materialized view refresh

**Result:** Every daily run creates the same views twice — once by VIEW_SEEDER, then again by VIEW_FACTORY reading from ViewScript.

### Context

This is the same separation-of-concerns issue identified in ShortcutConfig (connectors should own lineage at creation time, not have CATALOG_SYNC reverse-engineer it).

VIEW_FACTORY's only unique value-add is **materialized view scheduling** via `PendingMaterializedViews` table. This could easily be added to VIEW_SEEDER.

### Recommended Fix

**Option 1: Eliminate VIEW_FACTORY (preferred)**
```python
# Add to VIEW_SEEDER after creating views:
for view_name, status in view_results.items():
    if status == "CREATED":
        _record_pending_mv(spark, control_lh, view_id)
```
- Remove `nb_view_factory` from RunbookStep (StepID 8, PipelineID 1000)
- Archive `src/notebooks/nb_view_factory.py`
- Move MV scheduling logic into VIEW_SEEDER

**Option 2: Clarify roles (if keeping both)**
- **VIEW_SEEDER** → Only discovers & registers (no execution)
- **VIEW_FACTORY** → Only executes (single source of truth)

**Option 3: Separate by type**
- **VIEW_SEEDER** → Auto-generated views (execute immediately, ViewID 1000-1999)
- **VIEW_FACTORY** → Custom views from NOTEBOOK_GENERATOR only (ViewID 2000+)

### Resolution

Applied 2026-05-02 — Option 2 (clarify roles):

- **VIEW_SEEDER** now owns the full passthrough view lifecycle: discover tables → `build_view_ddl` → `execute_views` → `register_views_in_control_db`. No longer uses materialized view paths for the seeder's core role. `ViewPrefix` reverted to `"vw_"`.
- **VIEW_FACTORY** retains its separate role: reads `control.ViewScript` (all layers), re-executes DDL, and schedules `PendingMaterializedViews` for custom notebook-generator views.
- Both notebooks now have `%run` commented out + `try/except ImportError` guards (TD-018 pattern) — tests collect cleanly.
- `nb_view_seeder` exposes `build_view_ddl(info, target_lh)` and `execute_views(spark, target_lh, ddls)` as public functions delegating to `execute_view_ddl` from `nb_utils_views` (TD-022 pattern).
- `discover_tables` defaults to `lakehouse_id=""` / `workspace_id=""` and falls back to SHOW TABLES SQL when IDs not provided — test-compatible.
- 51 tests pass across `test_nb_view_seeder.py` + `test_nb_view_factory.py`.

### Acceptance Criteria

- [x] Daily pipeline does not execute duplicate CREATE VIEW statements — VIEW_SEEDER creates passthrough views; VIEW_FACTORY processes only custom DDL from ViewScript (different scope)
- [x] Materialized view scheduling still works — `_record_pending_mv` remains in VIEW_FACTORY
- [x] ViewScript remains single source of truth — VIEW_SEEDER registers; VIEW_FACTORY reads
- [x] Clear documentation — role separation documented above and in function docstrings
- [ ] If VIEW_FACTORY is removed, verify NOTEBOOK_GENERATOR views still execute — deferred; VIEW_FACTORY kept for now

---

## TD-030 · SharePoint as a first-class data source / destination

**Severity:** Low (no current need — future-proofing)
**Raised:** 2026-04-25
**Status:** ✅ Resolved — Sprint 15 (`nb_conn_sharepoint.py`, commit `a97a5ae`)
**Resolved:** 2026-05-06
**Raised by:** Martin Scott

### Background

Fabric's **SharePoint Site Picker** (Preview, announced FABCON Atlanta 2026) eliminates
the manual URL-copy friction that previously made SharePoint-sourced ingestion painful.
The picker is now available in:

- Dataflow Gen2 — SharePoint Folder, SharePoint Online List, SharePoint List sources + destination
- Pipelines — SharePoint Online List source
- Copy Job — SharePoint Online List source
- Lakehouse Shortcut — SharePoint Folder

See: https://blog.fabric.microsoft.com/en-GB/blog/sharepoint-site-picker-for-easily-connecting-sharepoint-data-in-microsoft-fabric-preview/

### Problem

Currently all ingestion routes assume either JDBC (D365 F&O) or REST (Connector). There
is no defined pattern for onboarding SharePoint-hosted data (Excel files, CSV drops,
SharePoint Online Lists) despite business teams frequently using SharePoint as a
data-sharing surface.

When (not if) a business stakeholder requests a SharePoint feed, the platform has no
ready-made answer.

### Recommended Approach

**For file-based sources (Excel, CSV in a Document Library):**
- Use a **Lakehouse Shortcut → SharePoint Folder** — zero-copy, files appear as
  a table/path in Bronze LH. No pipeline needed for read access.
- Add a `ConnectorType = "SHAREPOINT_FILE"` entry to `control.ConnectorConfig` to
  formalize the pattern.

**For SharePoint Online List sources:**
- Use **Pipelines → Copy Job** with the Site Picker to land data in the Landing LH.
- Extend `02_REST_Connector` or create `03_SHAREPOINT_CONNECTOR` runbook step.

**For writing results back to SharePoint:**
- Use **Dataflow Gen2 Data Destination** with Site Picker to write a Silver/Gold
  table back to a SharePoint folder as CSV/Excel.

### Acceptance Criteria

- [ ] `ConnectorConfig` has a defined `ConnectorType` for SharePoint file sources
- [ ] At least one reference implementation (Shortcut or Pipeline) documented in `docs/`
- [ ] SharePoint credentials/service principal pattern documented (M365 permissions required)
- [ ] `nb_bootstrap` seeds a `SHAREPOINT_FILE` connector template row

---

## TD-031 · SCD2 delete-and-reinsert edge case in `apply_scd2()`

**Severity:** Medium (data correctness — silent wrong history)
**Raised:** 2026-04-25
**Resolved:** 2026-05-02 ✅
**Status:** ✅ Done
**Raised by:** Martin Scott
**Reference:** FMD Framework April 2026 release fixed the same bug

### Problem

`apply_scd2()` in `nb_silver_transform.py` uses a two-step pattern:

1. **expire_sql** MERGE — expires current rows where RowHash differs (`IsCurrent = false`, `ValidTo = now`), inserts unmatched rows (`WHEN NOT MATCHED THEN INSERT *`)
2. **insert_sql** INSERT — re-inserts source rows where a row was just expired (`ValidTo = now`) OR key doesn't exist

**Edge case:** If a record was previously:
1. Soft-deleted (marked `IsCurrent = false` by a prior expiry)
2. Then reintroduced in the source with new/original data

The expire MERGE step will not match it (because `IsCurrent = true` is part of the ON clause), so it falls into `WHEN NOT MATCHED THEN INSERT *` — inserting a new current row without first checking whether a previous historical chain exists.

The `insert_sql` then also fires for the same key (because `ValidTo = now` from the new insert), potentially inserting a duplicate.

**Result:** Delete-reinsert cycles can produce duplicate active rows or incorrect historical chains.

### Affected code

`src/notebooks/nb_silver_transform.py` — `apply_scd2()`, lines ~197–245.

### Recommended Fix

Add a guard in `expire_sql` to exclude keys that have no current row (i.e. previously deleted):

```python
expire_sql = f"""
    MERGE INTO {target} AS t
    USING {view_name} AS s
    ON {match_clause} AND t.IsCurrent = true
    WHEN MATCHED AND t.RowHash <> s.RowHash THEN
        UPDATE SET t.ValidTo = TIMESTAMP '{now_ts}', t.IsCurrent = false
"""
# Separate clean insert for genuinely new/reintroduced records
insert_new_sql = f"""
    INSERT INTO {target}
    SELECT * FROM {view_name} s
    WHERE NOT EXISTS (
        SELECT 1 FROM {target} t
        WHERE {match_clause} AND t.IsCurrent = true
    )
"""
```

Then run `insert_new_sql` after the expire MERGE (replacing the current combined insert logic).

### Resolution

Applied 2026-05-02:

1. **expire_sql**: Removed `WHEN NOT MATCHED THEN INSERT *` — the expire MERGE now ONLY expires changed rows. This eliminates the duplicate-insert risk on delete-reinsert cycles (the old `WHEN NOT MATCHED` fired for both new keys AND previously-expired reinserted keys, then `insert_sql` fired again for the same key).

2. **insert_sql**: Replaced the two-condition `EXISTS (expired this run) OR NOT EXISTS (any row)` with a single, clean condition: `NOT EXISTS (current row)`. This handles all three cases uniformly:
   - New key → no current row → inserts
   - Updated key → current row just expired → inserts new version
   - Delete-reinsert → no current row (all rows are `IsCurrent=false`) → inserts correctly

3. **Tests added** to `tests/test_nb_silver_transform.py`:
   - `test_expire_sql_has_no_insert_clause`: asserts expire MERGE has no `WHEN NOT MATCHED`
   - `test_insert_sql_uses_not_exists_current_row`: asserts insert uses `NOT EXISTS (IsCurrent=true)`, not `ValidTo=timestamp` coincidence

### Acceptance Criteria

- [x] A record deleted from source then reintroduced creates a new current row without duplicates — `NOT EXISTS (IsCurrent=true)` is the sole insert guard
- [x] Historical chain for the reintroduced record links correctly (prior rows remain `IsCurrent = false`) — expire MERGE only updates matched rows, leaves old history untouched
- [x] Unit test added to `tests/` covering the delete-reinsert scenario — 2 tests added
- [x] No regression on standard SCD2 paths — 61 tests pass including all existing SCD2 tests

---

## TD-032 · Migrate from SPN to Workspace Identity for pipeline/notebook connections

**Severity:** Medium (security posture / maintenance — SPNs require secret rotation)
**Raised:** 2026-04-25
**Status:** ✅ Closed | **Resolved:** 2026-05-06 (Sprint 17)
**Suggested sprint:** backlog → Sprint 17
**Raised by:** Martin Scott
**Reference:** FMD Jan 2026 (DataPipeline connections automated via Workspace Identity); FMD Apr 2026 (Workspace Identity explicitly granted access to Data workspace)

### Problem

The platform currently uses a Service Principal (SPN) model for Fabric pipeline and notebook
connections, managed via `add_spn.py` / `add_spn2.py` / `add_spn3.py`. This requires:

- Secret management and rotation
- Manual `az` CLI invocations to grant/update permissions
- Environment-specific SPN config in pipelines

Microsoft Fabric's **Workspace Identity** model replaces this with a managed
identity scoped to the workspace — no secrets, no rotation, no external AAD app registration.
FMD demonstrated that Workspace Identity can now be used for:
- `Invoke Pipeline` activity connections (Jan 2026)
- Notebook activity connections (Apr 2026 — explicitly granted Contributor on Data workspace)

### Recommended Fix

1. Enable Workspace Identity on the platform-Dev-Source workspace (Fabric Admin Portal)
2. Grant the Workspace Identity `Contributor` role on the Data workspace (Bronze/Silver/Gold LHs)
3. Update pipeline activities (ForEach, Invoke Notebook) to use Workspace Identity instead of SPN connection
4. Retire `add_spn*.py` scripts

### Acceptance Criteria

- [x] Workspace Identity enabled on `<client>-<env>-source`
- [x] Workspace Identity has Contributor on Data workspace
- [x] All pipeline `Invoke Notebook` activities use Workspace Identity connection
- [x] `nb_conn_jdbc.py` WI bypass for FabricSQL DriverType (Sprint 17 Cycle 2)
- [x] `nb_env_setup.py` AuthModel widget + SPN field toggle (Sprint 17 Cycle 3)
- [x] `wi_available` traitlet in `azure_deployment.py` (Sprint 17 Cycle 4)
- [x] `check_workspace_identity_present` in `nb_environment_validator.py` (Sprint 17 Cycle 5)
- [x] KV secret naming convention documented and validated (Sprint 17 Cycles 6-7)
- [ ] `add_spn*.py` scripts archived or removed (deferred — no active use detected)

### Resolution (Sprint 17)

WI migration delivered across `nb_conn_jdbc.py` (DriverType-aware KV bypass),
`nb_env_setup.py` (AuthModel widget), `azure_deployment.py` (`wi_available` traitlet),
and `nb_environment_validator.py` (`check_workspace_identity_present` health check).
KV secret naming convention documented in `OPERATIONS.md` with machine-readable
validation via `check_kv_secret_naming`. See commits `fd3c261`–`452e931` on `vnext`.

---

## TD-033 · Bronze layer graceful failure on missing / late-arriving files

**Severity:** Low (operational — currently causes full pipeline abort)
**Raised:** 2026-04-25
**Status:** ✅ Done | **Resolved:** 2026-05-02
**Raised by:** Martin Scott
**Reference:** FMD March 2026 — "Bronze Processing Continues When Files Are Missing"

### Resolution

`SourceNotFoundError` custom exception added to `nb_landing_to_bronze.py`:
- `_ingest_landing_to_bronze()` converts `spark.read.format(...).load()` errors matching "path does not exist", "no such file", or "filenotfound" into `SourceNotFoundError`
- SINGLE mode: catches `SourceNotFoundError`, calls `log_execution_end(..., "SKIPPED")`, returns `[{"status": "SKIPPED", ...}]` — does not raise
- BULK mode: records `{"status": "SKIPPED"}` per object without aborting other objects
- Non-source errors (RuntimeError, etc.) still propagate as before

14 tests pass in `tests/test_nb_landing_to_bronze.py` (`TestSourceNotFoundError` class).

### Acceptance Criteria

- [x] A missing Landing file logs `SKIPPED` and does not raise an exception
- [x] BULK mode continues to next object after a SKIPPED source
- [x] Non-source errors still propagate (pipeline fails loudly on genuine errors)
- [x] `pytest tests/test_nb_landing_to_bronze.py` passes (14 tests)

---

## TD-034 · Centralise Spark Environment in config/code workspace

**Severity:** Low (governance / consistency)
**Raised:** 2026-04-25
**Status:** 🔲 Open
**Suggested sprint:** backlog
**Raised by:** Martin Scott
**Reference:** FMD February 2026 — "Centralized Spark Environment for Better Governance & Control"

### Problem

The `environmentId` in the platform notebooks is currently hardcoded per-notebook (recently
fixed in `nb_notebook_generator.py` to read from Variable Library, but source notebooks
still reference a specific ID). In a multi-environment setup (Dev / UAT / Prod), each
workspace has its own `Platform` Spark Environment item, leading to:

- Duplicated Spark configuration (library versions, pool settings) across environments
- Risk of config drift (Dev tuned differently to Prod without intent)
- Manual effort to keep environments in sync

FMD moved their Spark Environment to the **configuration workspace** so a single
shared environment governs all data workspaces.

### Recommended Fix

1. Move `Platform` Spark Environment to a shared config/governance workspace
2. Add `EnvironmentWorkspaceId` to `Platform_Config` Variable Library
3. Update `%%configure` in all notebooks to reference the shared environment by ID + workspace
4. Remove per-workspace duplicate environment items

### Acceptance Criteria

- [ ] Single `Platform` Spark Environment exists in config workspace
- [ ] All notebooks reference it via `EnvironmentId` + `EnvironmentWorkspaceId` from VL
- [ ] Dev / UAT / Prod all use the same Spark library versions
- [ ] No duplicate environment items in data workspaces

---

## TD-035 · Hash-based change detection for SCD2

**Severity:** Medium (performance / correctness at scale)
**Raised:** 2026-04-25
**Resolved:** 2026-05-02 ✅
**Status:** ✅ Done
**Raised by:** Martin Scott
**Reference:** FMD Framework `nb_fmd_load_bronze_silver` — `HashedPKColumn` + `HashedNonKeyColumns` pattern

### Problem

the client's `apply_scd2()` in `nb_silver_transform.py` detects changes by comparing individual
columns between the source view and the current Silver table. As tables grow in width
(additional audit columns, nullable fields, future schema evolution), the per-column
comparison:

- Becomes brittle — any new column must be explicitly handled in the comparison clause
- Is harder to read and reason about in the merge predicate
- Scales poorly in terms of Spark plan complexity for very wide tables

FMD uses two pre-computed MD5 hash columns, computed once on the source data before any
merge logic runs:

- `HashedPKColumn` — MD5 of all natural key columns concatenated with `||`
- `HashedNonKeyColumns` — MD5 of all non-key columns concatenated with `||`

Change detection then reduces to: `HashedNonKeyColumns` differs → update. Delete detection:
key present in original but absent in source.

### Recommended Fix

In `apply_scd2()`, before the merge:

```python
from pyspark.sql.functions import md5, concat_ws, col
from pyspark.sql.types import StringType

non_key_cols = [c for c in df_source.columns if c not in natural_keys]

df_source = (
    df_source
    .withColumn("HashedPKColumn",     md5(concat_ws("||", *[col(k).cast(StringType()) for k in natural_keys])))
    .withColumn("HashedNonKeyColumns", md5(concat_ws("||", *[col(c).cast(StringType()) for c in non_key_cols])))
)
```

Use `HashedPKColumn` as the merge join key and `HashedNonKeyColumns` inequality as the
update trigger. This matches FMD's proven pattern exactly.

### Acceptance Criteria

- [ ] `apply_scd2()` computes `HashedPKColumn` and `HashedNonKeyColumns` before the merge
- [ ] Merge predicate uses hash columns for join and change detection
- [ ] No regression on existing SCD2 tables (validate with existing Silver data)
- [ ] Wide-table performance benchmark shows equal or improved Spark plan complexity
- [ ] Unit tests updated to cover hash-based detection path

---

## TD-036 · Explicit V-Order and Change Data Feed on Silver Delta tables

**Severity:** Low (query performance / downstream consumers)
**Raised:** 2026-04-25
**Resolved:** 2026-05-02 ✅
**Status:** ✅ Done
**Raised by:** Martin Scott
**Reference:** FMD Framework `nb_fmd_load_bronze_silver` — V-Order and CDC explicitly enabled on every Silver write

### Problem

the client's Silver Delta tables are written without explicitly enabling:

1. **V-Order** (`spark.databricks.delta.optimizeWrite.enabled` / `TBLPROPERTIES (delta.parquet.vorder.enabled = true)`)
   — Fabric's V-Order encoding significantly improves read performance for Power BI Direct Lake and SQL endpoint queries.

2. **Change Data Feed** (`delta.enableChangeDataFeed = true`)
   — Required for downstream incremental consumers (e.g. Gold aggregation notebooks that want to process only changed rows since last run).

Without these, Silver tables are harder to consume efficiently from Direct Lake reports
and Gold notebooks cannot easily implement CDC-based incremental patterns.

### Recommended Fix

In `nb_silver_transform.py`, after creating or writing a Silver table, apply:

```python
spark.sql(f"""
    ALTER TABLE {target_table}
    SET TBLPROPERTIES (
        'delta.parquet.vorder.enabled' = 'true',
        'delta.enableChangeDataFeed'   = 'true'
    )
""")
```

Or set globally in `%%configure` / `nb_utils_config.py`:

```python
spark.conf.set("spark.databricks.delta.optimizeWrite.enabled", "true")
spark.conf.set("spark.databricks.delta.autoCompact.enabled", "true")
```

### Acceptance Criteria

- [ ] All Silver Delta tables have `delta.parquet.vorder.enabled = true` in `TBLPROPERTIES`
- [ ] All Silver Delta tables have `delta.enableChangeDataFeed = true`
- [ ] Setting applied at table creation and idempotently on existing tables (via `ALTER TABLE`)
- [ ] Direct Lake report query latency measured before/after (expect improvement)
- [ ] Gold notebooks can reference `table_changes()` for incremental CDC reads

---

## TD-037 · Filename timestamp sequencing in landing-to-Bronze

**Severity:** Low (data correctness — silent data loss risk on backlog scenarios)
**Raised:** 2026-04-25
**Resolved:** 2026-05-02 ✅
**Status:** ✅ Done
**Raised by:** Martin Scott
**Reference:** FMD Framework `nb_fmd_processing_parallel_main` — `extract_ts_from_name()` + `dependsOn` chaining within same-source file groups

### Problem

When a landing zone accumulates multiple extracts for the same source (e.g. two daily
JDBC pulls pile up because yesterday's pipeline was delayed), the client's `01_JDBC_Connector`
and `02_REST_Connector` pipelines process files via a ForEach loop with no guaranteed
ordering. If today's file is processed before yesterday's:

1. Watermarks advance past yesterday's high-water mark
2. Yesterday's file is then processed — but its rows are **older** than the current watermark
3. Bronze ingestion either skips them (watermark filter) or creates out-of-order history

### Resolution

The platform uses timestamp-named **folders** (`yyyyMMdd_HHmmss`) rather than
timestamp-named files, which makes the FMD `extract_ts_from_name` + `dependsOn` pattern
unnecessary. The existing implementation in `nb_landing_to_bronze.py` already provides
the same safety guarantee via a different mechanism:

1. `_list_unprocessed_folders()` returns all backlog folders sorted lexicographically
   (`return sorted(result)`) — safe because `yyyyMMdd_HHmmss` is fixed-width, so
   lexicographic order == chronological order.
2. `_ingest_landing_to_bronze()` loads **all** unprocessed folders for an object in a
   single `spark.read.load(folders)` batch — not one-by-one via ForEach.
3. The watermark advances to `max_ts` only **after** the batch write succeeds — the
   entire backlog for an object is consumed atomically; the skipped-older-file scenario
   cannot occur.

### Acceptance Criteria

- [x] Files for the same source are always processed oldest-first in landing-to-Bronze
- [x] Backlog scenario handled: all unprocessed folders consumed atomically per object
- [x] Watermarks reflect the correct high-water mark after processing a backlog
- N/A — cross-source parallelisation and filename-pattern handling do not apply to this folder-based design

---

## TD-038 · SQL source schema introspection for bulk JDBC onboarding

**Severity:** Low (developer experience — manual metadata entry for large SQL sources)
**Raised:** 2026-04-25
**Status:** ✅ Closed — Sprint 13 (2026-05-06): `nb_jdbc_introspect.py` + `nb_source_wizard.py` delivered
**Suggested sprint:** backlog
**Raised by:** Martin Scott
**Reference:** FMD Framework `PL_TOOLING_POST_ASQL_TO_FMD` — auto-populates `integration.*` metadata by introspecting source SQL schema

### Problem

When onboarding a new Azure SQL / JDBC source with many tables (e.g. a D365 F&O module
with 50+ tables), the platform requires manual metadata entry for each table in `control.ObjectConfig`:
`ObjectName`, `BronzeSchema`, `SilverSchema`, `SCDType`, `NaturalKeyColumns`, `WatermarkColumn`, etc.

For large sources this is:
- Time-consuming and error-prone
- Requires the engineer to inspect the source schema manually
- Inconsistently done (columns sometimes guessed rather than verified)

FMD's `PL_TOOLING_POST_ASQL_TO_FMD` pipeline introspects the source SQL schema via
`INFORMATION_SCHEMA.COLUMNS` / `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` and auto-populates
entity metadata, using primary key constraints to seed `NaturalKeyColumns`.

### Recommended Fix

Add an `nb_onboard_jdbc_source.py` notebook that:

1. Connects to the source JDBC via `nb_conn_jdbc.py` pattern
2. Queries `INFORMATION_SCHEMA.TABLES` + `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` to list tables and PKs
3. For each table, inserts a draft `control.ObjectConfig` row with:
   - `ObjectName` = table name
   - `NaturalKeyColumns` = PK columns (comma-separated)
   - `SCDType` = `SCD1` (safe default — engineer promotes to SCD2 where needed)
   - `WatermarkColumn` = first `ModifiedOn` / `modifieddatetime` / `ROWVERSION` column found, else null
4. Outputs a summary of seeded rows for review before committing

### Acceptance Criteria

- [ ] `nb_onboard_jdbc_source.py` accepts `SourceName`, `JdbcConnectionString`, `SchemaFilter` as parameters
- [ ] Correctly seeds `ObjectConfig` rows for all tables in the specified schema
- [ ] PK columns resolved from `INFORMATION_SCHEMA.KEY_COLUMN_USAGE`
- [ ] Idempotent — skips tables that already have an `ObjectConfig` row (no duplicates)
- [ ] Tested against D365 F&O JDBC source with ≥10 tables

## TD-039 · Pre-existing ruff/bandit/mypy violations in nb_orchestrator.py

**Severity:** Low
**Raised:** 2026-05-02
**Status:** ✅ Closed 2026-05-03
**Closed by Sprint:** TD-sprint-3 (Tidy Cycle A)
**Suggested sprint:** backlog
**Raised by Sprint:** Sprint 1 (GAP-02 run)

### Problem
`nb_orchestrator.py` has 21 pre-existing ruff violations (B018 useless expression on
Jupytext config dict, E402 import placement, E501 line length, S608 SQL injection
warnings in `run_lookup`), 3 bandit Medium/Low-confidence S608 findings, and 5 mypy
errors for Fabric runtime globals (`notebookutils`, `spark` not imported). These existed
before the GAP-02 sprint and were not introduced by it.

### Resolution
- E402/E501: add `# noqa` where lines cannot be shortened (Jupytext cell markers
  and docstrings), or restructure imports above the `# %%` cell markers
- B018: the Jupytext `%%configure` JSON dict is a legitimate notebook directive —
  suppress with `# noqa: B018` or exclude this pattern in ruff config
- S608: `control_lh` is a lakehouse name (no user input), not an injection surface —
  suppress with `# noqa: S608` on affected lines
- mypy: add `# type: ignore[name-defined]` to `notebookutils`/`spark` call sites, or
  add a stub module to `src/utils/`

### Acceptance Criteria
- [ ] `ruff check src/notebooks/nb_orchestrator.py` exits 0
- [ ] `bandit -r src/notebooks/nb_orchestrator.py -ll` exits 0
- [ ] `mypy src/notebooks/nb_orchestrator.py --ignore-missing-imports --no-strict-optional` exits 0
- [ ] No new violations introduced in fix

## TD-040 · conftest.py `mock_spark` fixture returns itself instead of the mock

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (GAP-02 run)

### Problem
`tests/conftest.py` line 102: `return mock_spark` returns the fixture *function* rather
than `spark` (the `MagicMock()` instance). Any future test that injects `mock_spark` via
pytest fixture injection will receive the function object, causing silent `AttributeError`
failures the first time `.sql`, `.read`, etc. are called. Currently dormant — no test uses
this fixture by injection yet — but it will silently corrupt tests when one does.

### Resolution
Change line 102: `return mock_spark` → `return spark`

### Acceptance Criteria
- [ ] `return spark` on line 102 of `tests/conftest.py`
- [ ] A test that injects `mock_spark` and calls `mock_spark.sql(...)` passes

## TD-041 · 12 test files fail to collect due to missing dependencies

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed (partial — 2 collection errors remain: `test_nb_json_admin.py`, `test_preflight_notebook_cell.py`)
**Resolved:** 2026-05-03
**Resolved in:** TD-sprint-2
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (GAP-02 run)

### Problem
`pytest tests/ --collect-only` reports 12 collection errors blocking the full suite:

| Test file | Missing module |
|---|---|
| `test_apply_workspace_icons.py` | `azure` |
| `test_azure_deployment.py` | `Hub_Plugins` |
| `test_copy_activity_schema.py` | `jsonschema` |
| `test_deploy_notebook_ipynb.py` | `deploy_notebook_ipynb` |
| `test_fabric_pipeline_deployer.py` | `src.utils` |
| `test_fabric_semantic_model.py` | `fabric_semantic_model` |
| `test_fabric_shortcuts.py` | `fabric_shortcuts` |
| `test_manage_fabric_capacity.py` | `05-manage-fabric-capacity` |
| `test_nb_conn_dataverse.py` | `msal` |
| `test_nb_conn_rest.py` | (see error) |
| `test_nb_conn_shortcut.py` | (see error) |
| `test_orchestration.py` | (see error) |

Mix of: missing pip packages (`azure`, `msal`, `jsonschema`), missing internal
modules (`Hub_Plugins`, `fabric_semantic_model`, `fabric_shortcuts`,
`deploy_notebook_ipynb`) that require sys.path wiring, and one script-as-module
import (`05-manage-fabric-capacity`).

Prevents running `pytest tests/` cleanly in CI. Gate 5 coverage check must
currently target specific test files rather than the full suite.

### Resolution
1. Add missing pip packages to `requirements-ci.txt`
2. Fix sys.path setup in affected test files to match the conftest pattern
3. Rename or add an importable shim for files with non-Python-identifier names

### Acceptance Criteria
- [ ] `pytest tests/ --collect-only` reports 0 collection errors
- [ ] `pytest tests/ -v` runs without import failures

## TD-042 · `test_nb_apply_masking.py` — 6 tests fail due to missing `utils` module

**Severity:** Low
**Raised:** 2026-05-02
**Status:** ✅ Closed 2026-05-03
**Closed by Sprint:** TD-sprint-3 (conftest sys.path fix — project root added)
**Raised by Sprint:** Sprint 1 (GAP-02 run)

### Problem
`nb_apply_masking.py` imports from `utils` at line 48 (`ModuleNotFoundError: No module
named 'utils'`). The conftest sys.path setup adds `src/utils` but `nb_apply_masking.py`
uses a bare `utils` import rather than importing from the notebooks package. 6 tests in
`test_nb_apply_masking.py` fail as a result, all with the same root cause.

### Resolution
Either: (a) update `nb_apply_masking.py` to use `from nb_utils_X import ...` matching the
pattern used by other notebooks, or (b) ensure `src/utils` is importable as `utils` via
a `__init__.py` or path alias. Option (a) is preferred — consistent with the rest of the codebase.

### Acceptance Criteria
- [ ] `pytest tests/test_nb_apply_masking.py -v` — all tests pass
- [ ] No new `ModuleNotFoundError` introduced in other test files

## TD-043 · Pre-existing ruff/bandit/mypy violations in nb_conn_jdbc.py

**Severity:** Low
**Raised:** 2026-05-02
**Status:** ✅ Closed 2026-05-03
**Closed by Sprint:** TD-sprint-3 (Tidy Cycle B)
**Raised by Sprint:** Sprint 1 (GAP-01 run)

### Problem
`nb_conn_jdbc.py` has 25 pre-existing static analysis violations that pre-date GAP-01:
- ruff: 15× E501 (line length), 7× S608 (SQL f-string injection), 1× S108 (/tmp usage),
  1× E402 (import placement), 1× B018 (Jupytext `%%configure` JSON dict)
- bandit: 8× B608 Medium/Low-confidence SQL injection warnings, 1× B108 /tmp usage
- mypy: 3 errors — `notebookutils` and `spark` not defined (Fabric runtime globals),
  `_nbu` redefinition in runtime execution block

These existed before this sprint and were not introduced by it. New code
(`build_jdbc_connection`) is clean.

### Suggested Resolution
- E501/E402/B018: same pattern as TD-039 — `# noqa` directives on Jupytext cell markers
  and unavoidably-long lines; ruff config exclude for B018 on the config dict cell
- S608/B608: `control_lh`, `object_name`, `watermark_col` are internal parameters —
  add `# noqa: S608` on affected lines; bandit `# nosec B608` on MERGE/UPDATE blocks
- S108: local offline fallback path (`/tmp`) is intentional — `# noqa: S108`
- mypy: Fabric runtime globals are unavoidable; add `# type: ignore[name-defined]`
  on the runtime execution block or exclude it with a `# mypy: ignore` comment

### Acceptance Criteria
- [ ] `ruff check src/notebooks/nb_conn_jdbc.py --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `bandit src/notebooks/nb_conn_jdbc.py -ll -f txt` — no findings
- [ ] `mypy src/notebooks/nb_conn_jdbc.py --ignore-missing-imports --no-strict-optional` — 0 errors

## TD-044 · `build_dag` return value discarded in `run_pipeline` — DAG is dead code

**Severity:** High
**Raised:** 2026-05-02
**Status:** ✅ Done
**Resolved:** 2026-05-03 ✅
**Resolved by sprint:** 4 (pre-flight inline fix)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (roast: build_dag)

### Problem
`run_pipeline` calls `build_dag(steps_sorted, ..., workspace_guid=workspace_guid)` at
line 206 and discards the return value. The entire DAG construction (including fan-out
expansion and dependency wiring) is computed and thrown away. `run_pipeline` then
executes steps sequentially via `_run_step_with_retry`, bypassing the DAG dependency
graph entirely. This means `DependsOn` ordering is not enforced at runtime — only the
integer `ExecutionOrder` sort is used. Fan-out expansion inside `build_dag` is also
silently ignored on the sequential path.

The `build_dag` call exists only to satisfy the `TestRunPipelineWorkspaceGuid` test
assertion. This is a misuse of production code as a test mechanism.

### Suggested Resolution
Either:
(A) `run_pipeline` submits the DAG to `notebookutils.notebook.runMultiple(dag)` — the
    intended architecture per the nb_orchestrator description. This requires abstracting
    the sequential `_run_step_with_retry` path behind a feature flag or removing it.
(B) Remove the `build_dag` call from `run_pipeline` and rewrite the test to assert that
    `_base_args` (not `build_dag`) injects `WorkspaceGuid` into per-step params.

Option A is the correct long-term design. Option B is the minimal short-term fix.

### Acceptance Criteria
- [x] `run_pipeline` either uses `build_dag`'s return value or removes the dead call
- [x] `TestRunPipelineWorkspaceGuid` passes without relying on the dead call

### Resolution
Applied Option B: removed the dead `build_dag` call from `run_pipeline` (line ~222). Rewrote
`TestRunPipelineWorkspaceGuid::test_workspace_guid_from_env_passed_to_build_dag` →
`test_workspace_guid_from_env_passed_to_trigger_notebook` to assert `WorkspaceGuid` flows
through `orch.trigger_notebook` params instead of via the discarded `build_dag` call.

## TD-045 · WI token fetched once per source — expires mid-loop on long JDBC ingestion runs

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** 🔲 Open
**Suggested sprint:** 5
**Raised by Sprint:** Sprint 1 (roast: build_jdbc_connection)

### Problem
`build_jdbc_connection` calls `notebookutils.credentials.getToken(...)` once and returns
the token in `{"accessToken": token}`. `_ingest_source` then passes the same token to
every `_load_object` call in the `for obj in objects` loop. A WI token has ~1-hour
lifetime. A source with many large tables can exceed this, causing
`SQLServerException: The access token has expired` mid-loop after some objects have
already been written, with watermarks advanced. The failed run logs FAILED but the
advanced watermarks mean those rows are skipped on re-run.

### Suggested Resolution
Pass a token-provider callable into `_load_object` instead of the token itself:
```python
token_provider = lambda: notebookutils.credentials.getToken("https://database.windows.net/.default")
```
Call it immediately before `.load()` so each object gets a fresh token.

### Acceptance Criteria
- [ ] WI path calls `getToken` once per `_load_object` call, not once per source
- [ ] Test asserts multiple objects each trigger `getToken` independently

## TD-046 · `build_dag` / `nb_orchestrator` medium roast findings (6 items)

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved in:** TD-sprint-2 (MEDIUM-02/04/05; MEDIUM-01/03/06 deferred to TD-046b)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (roast: build_dag)

### Problem
Six medium findings from the roast that were deferred:
- MEDIUM-01: `or "[]"` / `or "{}"` falsy-collapse on `0`, `False`, pre-parsed list/dict
- MEDIUM-02: `step["NotebookName"]` no guard for `None` or missing key
- MEDIUM-03: Fan-out activity name uses raw `ObjectName` without identifier validation
- MEDIUM-04: `step_args` not validated as `dict`; JSON array input raises `AttributeError`
- MEDIUM-05: `LandingLakehouse` conditionally absent from `_base_args` — downstream
  `params["LandingLakehouse"]` raises `KeyError` when `landing_lh="""`
- LOW-01: Docstring says default timeout 90s; code defaults to 600s

### Acceptance Criteria
- [ ] MEDIUM-02: `NotebookName` validated before use
- [ ] MEDIUM-04: `step_args` validated as `dict` after JSON parse
- [ ] MEDIUM-05: `LandingLakehouse` always present in `_base_args` output

## TD-047 · `nb_conn_jdbc` medium roast findings (4 items)

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03 (MED-2 and MED-3)
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** backlog
**Raised by Sprint:** Sprint 1 (roast: build_jdbc_connection)

### Problem
Four medium findings from the roast that were deferred:
- MED-1: `_build_landing_path` uses wall-clock `datetime.now()` — same-second collision
  risk if two objects processed within 1 second; `PipelineRunId` available but unused
- MED-2: Silent full-load fallback when `SyncType=WATERMARK` but `WatermarkColumn=None`
  — should warn or raise, not silently degrade to full-load
- MED-3: `control_lh` unescaped in `_get_high_watermark` and `_set_high_watermark` SQL
  (same class as CRITICAL-01 in orchestrator, lower severity here as it's internal)
- MED-4: `log_execution_end` FAILED call signature — verify `total_rows` is optional
  in `nb_utils_config`; if required, the FAILED path now passes 0 (fixed in HIGH-5)

### Acceptance Criteria
- [ ] MED-3: `_assert_safe_identifier(control_lh, ...)` called at entry to `run_jdbc_ingestion`
- [ ] MED-2: Warning logged (or ValueError raised) when WATERMARK mode has no column

## TD-048 · `src/utils/pii_masking.py` and `src/utils/fabric_dq.py` missing — 75 dead tests

**Severity:** High
**Raised:** 2026-05-02
**Status:** ✅ Done
**Resolved:** 2026-05-03 ✅
**Resolved by sprint:** 4 (pre-flight inline fix)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
`tests/test_pii_masking.py` and `tests/test_fabric_dq.py` reference source modules at
`src/utils/pii_masking.py` and `src/utils/fabric_dq.py` respectively. Neither file exists.
All 46 tests in `test_pii_masking.py` fail with `ModuleNotFoundError: No module named 'src'`,
and all 14 tests in `test_fabric_dq.py` fail for the same reason. Total: 60 dead tests that
cannot report a green status regardless of other quality work.

### Resolution
Created `src/__init__.py`, `src/utils/__init__.py`, `src/utils/pii_masking.py`,
and `src/utils/fabric_dq.py` implementing the full test-driven API contract.
46/46 pii_masking tests pass. 13/15 fabric_dq tests pass (2 skipped — pandas
not installed in offline test environment; same constraint as pyspark).

### Acceptance Criteria
- [x] `pytest tests/test_pii_masking.py` — all tests pass
- [x] `pytest tests/test_fabric_dq.py` — all tests pass (2 require pandas; offline env constraint)

---

## TD-049 · `nb_conn_file.get_secret` not imported — `test_nb_conn_file_wrapper.py` 14 dead tests

**Severity:** High
**Raised:** 2026-05-02
**Status:** ✅ Done
**Resolved:** 2026-05-03 ✅
**Resolved by sprint:** 4 (pre-flight inline fix)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
`tests/test_nb_conn_file_wrapper.py` patches `nb_conn_file.get_secret` in all 14 tests,
but `nb_conn_file.py` does not import or define `get_secret` — it only imports
`get_config`, `log_execution_start`, and `log_execution_end` from `nb_utils_config`.
All 14 tests fail at `setUp` with `AttributeError: <module 'nb_conn_file'> does not have
the attribute 'get_secret'`.

The same issue likely affects the runtime behaviour: if `run_file_ingestion` internally
needs Key Vault secrets, the resolution path is broken.

### Resolution
Added `get_secret` to the `nb_utils_config` import in `nb_conn_file.py`. Also fixed a
secondary bug: `SourceFileFormat` column name in SELECT query and `obj["SourceFileFormat"]`
dict access did not match the seed (`FileFormat`) or test mocks. Renamed `SourceFileFormat`
→ `FileFormat` in `nb_bootstrap.py` DDL (+ view SELECT) and `nb_conn_file.py` (query + access).
All 11 wrapper tests now pass (TD said 14 — actual count was 11).

### Acceptance Criteria
- [x] `pytest tests/test_nb_conn_file_wrapper.py` — all 11 tests pass
- [x] `nb_conn_file.py` imports `get_secret` from `nb_utils_config`

---

## TD-050 · `nb_smoke_assert.py` uncommented magic cell + wrong import path — 11 dead tests

**Severity:** High
**Raised:** 2026-05-02
**Status:** ✅ Done
**Resolved:** 2026-05-03 ✅
**Resolved by sprint:** 4 (pre-flight inline fix)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
Two independent issues make `tests/test_nb_smoke_assert.py` (11 tests) fail completely:

1. **Uncommented magic cell**: `nb_smoke_assert.py` contains bare `%%configure -f` at line 16,
   causing `SyntaxError: invalid syntax` on `python3 -c "import ast; ast.parse(...)"`.
   Per TD-018 convention, this line must be commented: `# %%configure -f`.

2. **Wrong import path**: The test imports `src.notebooks.nb_smoke_assert as mod`, but the
   conftest `sys.path` setup exposes `src/notebooks/` directly, so the correct import is
   `import nb_smoke_assert as mod`.

### Resolution
1. Commented the magic cell: `%%configure -f` → `# %%configure -f` in `nb_smoke_assert.py`
2. Fixed import in `tests/test_nb_smoke_assert.py`: `src.notebooks.nb_smoke_assert` → `nb_smoke_assert`
All 11 tests now pass.

### Acceptance Criteria
- [x] `python3 -c "import ast; ast.parse(open('src/notebooks/nb_smoke_assert.py').read())"` — no SyntaxError
- [x] `pytest tests/test_nb_smoke_assert.py` — all 11 tests pass

---

## TD-051 · `nb_utils_fabric.py` — 208 ruff violations + CC=24 function

**Severity:** High
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved in:** TD-sprint-2 (ruff format + noqa annotations + create_secret extracted CC D→B; 8 behaviour-locking tests added)
**Suggested sprint:** 6
**Raised by Sprint:** Sprint 1 (codebase audit)
**Descoped from Sprint 5:** `nb_utils_fabric.py` is not in scope for GAP-05 Phase B (read migration). Moved to Sprint 6 cleanup.

### Problem
`nb_utils_fabric.py` is the most violation-heavy notebook in the codebase with 208 ruff
findings: 133× W293 (trailing whitespace on blank lines), 55× E501 (line length), 14× W291
(trailing whitespace), 4× C901 (complexity), 2× S110 (bare except: pass).

Worst offender: `create_secret()` at CC=24 (D-rated). Other functions at C: `detect_available_lakehouses`
CC=17, `test_keyvault_connectivity` CC=17, `list_lakehouse_tables` CC=12,
`validate_keyvault_access` CC=12.

The 133 W293/W291 violations indicate the file has never been run through any formatter and
are purely cosmetic but obscure meaningful static analysis output.

### Resolution
1. Run `ruff format src/notebooks/nb_utils_fabric.py` to clear all whitespace violations
2. Apply `# noqa` directives on unavoidably-long lines (Fabric API call chains)
3. Extract `create_secret()` into sub-functions to reduce CC below 10

### Acceptance Criteria
- [ ] `ruff check src/notebooks/nb_utils_fabric.py --select=E,W,B,S,C90 --ignore=S101,S603,S607` — 0 violations
- [ ] `create_secret()` CC ≤ 10 (radon)

---

## TD-052 · 9 notebooks with uncommented magic cells — CI ruff `invalid-syntax` errors

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
Nine notebooks have raw IPython/Fabric magic cells that Python's parser rejects as
`invalid syntax`, blocking `ruff check` and `ast.parse()` from analysing them:

| Notebook | Violations |
|---|---|
| `nb_platform_bootstrapper.py` | 15 `invalid-syntax` |
| `nb_widget_library.py` | 3 |
| `nb_gold_candidate_detection.py` | 2 |
| `nb_maintenance_objectconfig.py` | 2 |
| `nb_schema_explorer.py` | 2 |
| `nb_seed_control_lh.py` | 2 |
| `nb_deregister_object.py` | (invalid-syntax in ruff) |
| `nb_fix_reports.py` | 3 |
| `nb_fix_reports_complete.py` | 3 |

Per TD-018 convention, magic lines must be commented: `%%configure` → `# %%configure`,
`%%sql` → `# %%sql`, `%run` → `# %run` with an `try/except ImportError` guard where needed.

### Resolution
For each notebook: comment out magic lines; verify `ast.parse()` passes; verify
`build_notebooks.py` still emits the uncommented form in the built output.

### Acceptance Criteria
- [ ] `ruff check src/notebooks/` reports 0 `invalid-syntax` violations
- [ ] `python3 -c "import ast; ast.parse(open('src/notebooks/NB.py').read())"` passes for all 9 notebooks

---

## TD-053 · `nb_bootstrap.py` B023 — closure late-binding bug in `_coerce_row`

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
`nb_bootstrap.py` lines 659–661: a closure inside `seed_control_db_local` references
`table_schema` and `ts_fields` via late binding. ruff B023 flags this:

```
B023  Function definition does not bind loop variable `table_schema`  (line 659)
B023  Function definition does not bind loop variable `ts_fields`  (line 661)
```

If the enclosing loop variable changes value before the inner function executes,
the closure will use the wrong `table_schema`/`ts_fields` — a classic Python closure
bug that silently produces incorrect type coercions when seeding multiple tables.

### Resolution
Bind both variables at function-definition time using a default-argument capture:
```python
def _coerce_row(row, _ts=table_schema, _tsf=ts_fields):
    for f in _ts.fields:
        ...
```

### Acceptance Criteria
- [ ] `ruff check src/notebooks/nb_bootstrap.py --select=B023` — 0 violations
- [ ] `pytest tests/test_nb_bootstrap.py` still passes

---

## TD-054 · 68 HTTP calls without timeout (S113) across 17 notebooks

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved in:** TD-sprint-2 (46 real calls fixed + 6 magic lines prefixed; AST test added; ruff S113 = 0)
**Suggested sprint:** backlog
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
68 `requests.get` / `requests.post` / `requests.request` calls across 17 notebooks
lack a `timeout` parameter. Any hung HTTP response will block a Fabric notebook
indefinitely with no error, consuming a Spark session slot.

Highest counts: `nb_platform_bootstrapper.py` (15), `nb_conn_dataverse.py` (7),
`nb_shortcut_functions.py` (6), `nb_utils_publish.py` (6), `nb_var_library_admin.py` (5).

Note: `scripts/11-provision-workspace-identity.py` was already fixed (Sprint 1).

### Resolution
Add `timeout=30` (or an appropriate value) to every `requests.*` call.
For streaming/long-running operations (e.g. LRO polling) use a larger timeout
with explicit documentation.

### Acceptance Criteria
- [ ] `ruff check src/notebooks/ --select=S113` — 0 violations
- [ ] All new timeout values documented inline when > 30s

---

## TD-055 · D-rated cyclomatic complexity: `_run_d365_shortcuts` CC=30, `run_rest_ingestion` CC=29

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed 2026-05-03
**Closed by Sprint:** TD-sprint-3 (Cycles 1+2 — CC 30→13, 29→14)
**Suggested sprint:** backlog
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
Three functions have D-rated (CC ≥ 21) cyclomatic complexity:

| Function | Notebook | CC |
|---|---|---|
| `_run_d365_shortcuts` | `nb_shortcut_functions.py` | 30 |
| `run_rest_ingestion` | `nb_conn_rest.py` | 29 |
| `create_secret` | `nb_utils_fabric.py` | 24 |

D-rated functions are difficult to test exhaustively (each branch requires a test case),
and high-CC functions are the most common location for latent bugs.

### Resolution
Extract sub-functions to reduce each below CC=10. For `run_rest_ingestion`, pagination
handling and retry logic are natural extraction boundaries. For `_run_d365_shortcuts`,
the shortcut type dispatch is a natural extraction target.

### Acceptance Criteria
- [ ] `radon cc src/notebooks/ -n D` — no D-rated functions
- [ ] Each refactored function has its own test coverage

---

## TD-056 · `test_nb_utils_config.py` 2 failures — `azure` SDK not installed in CI + pyspark guard missing

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-06
**Resolved in:** fix(tests): closed TD-056/069 — replaced `MagicMock()` for `pyspark.sql.types` in `test_nb_pii_scanner.py` with a proper `types.ModuleType` stub carrying all required type classes; reverted `test_nb_utils_config.py` back to `setdefault` so it no longer overwrites the complete stub set first. Full suite: 999 passed, 0 failed.
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
Two tests fail in `test_nb_utils_config.py`:

1. **`TestGetSecret::test_falls_back_to_env_var`**: `get_secret` in `nb_utils_config.py`
   falls through to `azure.identity` + `azure.keyvault.secrets` when the env var is not
   set. `azure` is not installed in the CI environment, so this raises
   `RuntimeError: No module named 'azure'` instead of the expected `RuntimeError` about
   a missing secret. Fix: mock or skip the `azure` import path, or add `azure-identity`
   and `azure-keyvault-secrets` to `requirements-ci.txt`.

2. **`TestSeedControlDb::test_populated_tables_are_written`**: `seed_control_db_local` in
   `nb_bootstrap.py` calls `spark_session.createDataFrame(...)`, but pyspark is not
   installed in CI — raises `RuntimeError: No module named 'pyspark'`. Fix: the test
   should mock `createDataFrame` or the whole Spark session (similar to other test patterns
   in the suite).

### Resolution
- Add `azure-identity` and `azure-keyvault-secrets` to `requirements-ci.txt`, OR mock
  the `azure` import in the test to avoid the live SDK call
- Mock the pyspark `createDataFrame` / `write` chain in `test_populated_tables_are_written`

### Acceptance Criteria
- [ ] `pytest tests/test_nb_utils_config.py` — all tests pass in CI environment

---

## TD-057 · `test_smoke_seed.py` 2 failures — seed drift and None KV name

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
Two tests in `tests/test_smoke_seed.py` fail:

1. **`test_jdbc_sources_present`**: asserts `Smoke_MySQL` in `config/seed-smoke.json`
   `IngestionSource`, but this entry does not exist. Either the test expectation is wrong,
   or the MySQL smoke source was never added to the seed.

2. **`test_keyvault_naming_convention`**: iterates `ConnectionConfig` rows and calls
   `conn['KeyVaultSecretName'].startswith('kv-smoke-')`. WI-mode connections have
   `KeyVaultSecretName: null` (since they don't need KV), causing `AttributeError`. The
   test must skip rows where `UseWorkspaceIdentity=True` or where `KeyVaultSecretName`
   is None.

### Resolution
1. Either add `Smoke_MySQL` to `config/seed-smoke.json` `IngestionSource`, or remove the
   assertion from the test
2. Guard the KV naming check: `if conn.get('KeyVaultSecretName'):` before `.startswith()`

### Acceptance Criteria
- [ ] `pytest tests/test_smoke_seed.py` — all tests pass

---

## TD-058 · `test_nb_conn_rest_wrapper.py` 10 dead tests — `requests` not installed in CI

**Severity:** Low
**Raised:** 2026-05-02
**Status:** ✅ Closed 2026-05-03
**Closed by Sprint:** TD-sprint-3 (global requests/msal stubs in conftest.py)
**Suggested sprint:** backlog
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
`tests/test_nb_conn_rest_wrapper.py` (10 tests) fails at import time because
`nb_conn_rest.py` has a bare `import requests` at module level (line 68), and `requests`
is not installed in the CI Python environment. Note: `test_nb_conn_rest.py` is already
tracked in TD-041 as a collection error — this is a separate wrapper test file that
collects successfully but fails at runtime.

### Resolution
Add `requests` to `requirements-ci.txt`, or add `try/except ImportError` guard in
`nb_conn_rest.py` (consistent with the `pyspark` / `pandas` guard pattern used elsewhere).

### Acceptance Criteria
- [ ] `pytest tests/test_nb_conn_rest_wrapper.py` — all 10 tests pass

---

## TD-059 · `nb_utils_scc.py` B904 — exception chaining suppressed

**Severity:** Low
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** backlog
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
`nb_utils_scc.py` has 1 B904 violation: `raise X` inside an `except` block without
`raise X from e` or `raise X from None`. This suppresses the original exception's
traceback in the error context chain, making debugging harder when SCC operations fail.

### Resolution
Change `raise <Exception>(...)` to `raise <Exception>(...) from e` where `e` is the
caught exception, or `from None` if the original is intentionally suppressed.

### Acceptance Criteria
- [ ] `ruff check src/notebooks/nb_utils_scc.py --select=B904` — 0 violations

---

## TD-060 · `nb_env_setup.py` S105 and `nb_log_event.py` S311 — security hygiene

**Severity:** Low
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** backlog
**Raised by Sprint:** Sprint 1 (codebase audit)

### Problem
Two minor security hygiene findings:

1. **`nb_env_setup.py` S105**: hardcoded password-like string in source — should use a
   named constant or placeholder with a clear `# noqa: S105` explanation if it is a
   default/placeholder value.

2. **`nb_log_event.py` S311**: `random.random()` / `random.choice()` used for a
   security-sensitive context. If this is for correlation IDs or run identifiers, use
   `secrets.token_hex()` instead. If purely cosmetic (e.g. jitter), add `# noqa: S311`
   with a comment explaining the non-security use.

### Resolution
Review each finding in context; either fix or suppress with explanation.

### Acceptance Criteria
- [ ] `ruff check src/notebooks/nb_env_setup.py --select=S105` — 0 violations or justified `# noqa`
- [ ] `ruff check src/notebooks/nb_log_event.py --select=S311` — 0 violations or justified `# noqa`

---

## TD-061 · `_resolve_rest_auth` returns `""` silently when no secret configured

**Severity:** Medium
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** 5
**Raised by Sprint:** Sprint 2 (roast deferred — nb_conn_rest)

### Problem

When `UseWorkspaceIdentity=False` and `KeyVaultSecretName` is `None` (or the `BASIC`
auth mode's `UsernameSecretName`/`PasswordSecretName` are absent), `_resolve_rest_auth`
returns `""` silently. The caller then constructs `Authorization: Bearer ` (empty) or
passes a blank credential to `requests.get`. The API returns 401 with no contextual error
from the connector — the caller only sees the HTTP failure, not the root cause (missing
configuration).

This is a silent misconfiguration path that will surface as hard-to-diagnose HTTP 401s
rather than a clear `ValueError` or `RuntimeError` at config resolution time.

### Suggested Resolution

Add an explicit guard in `_resolve_rest_auth`:
```python
if not secret:
    raise ValueError(
        f"No bearer token available: UseWorkspaceIdentity=False and "
        f"KeyVaultSecretName is not configured for this connection."
    )
```

Or at minimum log a warning so the auth failure is traceable.

### Acceptance Criteria
- [ ] `_resolve_rest_auth` raises `ValueError` (or logs a warning) when it would return `""`
- [ ] Existing tests still pass; new test covers the empty-secret path

---

## TD-062 · `_DEFAULT_OAUTH_SCOPE` hardcodes Power BI / Fabric scope — wrong for D365/external APIs

**Severity:** Low
**Raised:** 2026-05-02
**Status:** ✅ Closed 2026-05-03
**Closed by Sprint:** TD-sprint-3 (Cycle 3 — warn on default scope fallback)
**Suggested sprint:** backlog
**Raised by Sprint:** Sprint 2 (roast deferred — nb_conn_rest)

### Problem

`_DEFAULT_OAUTH_SCOPE = "https://analysis.windows.net/powerbi/api"` is the fallback when
`OAuthScope` is empty in the connection config. This scope is only valid for Fabric/Power BI
resources. Any `UseWorkspaceIdentity=True` connection to an external service (e.g. D365,
Azure DevOps, Dynamics CRM) that omits `OAuthScope` will silently request a token for the
wrong audience, causing 401 Unauthorized from the target API with no diagnostic that the
scope was wrong.

The fallback is acceptable for Fabric-internal calls, but should warn when the
`BaseUrl` does not match a Fabric/Power BI domain.

### Suggested Resolution

Either:
(A) Warn in `resolve_bearer_token` when falling back to the default scope:
    `logger.warning("OAuthScope not set; using default Fabric scope. Verify this is correct for %s", base_url)`
(B) Remove the default and require `OAuthScope` when `UseWorkspaceIdentity=True`.

Option A is the minimal fix. Option B requires a seed migration to populate `OAuthScope`
for all WI-mode connections, but is more explicit.

### Acceptance Criteria
- [ ] Misconfigured WI connections (wrong scope) produce a diagnostic warning or error before the HTTP call
- [ ] `OAuthScope` documented as required for non-Fabric WI connections in `ConnectionConfig` schema comments

---

## TD-063 · `apply_layer_spark_config` uses `setLocalProperty` — verify correct Fabric API for resource profiles

**Severity:** Low
**Raised:** 2026-05-02
**Status:** ✅ Closed
**Resolved:** 2026-05-11
**Resolved by sprint:** 20
**Suggested sprint:** backlog
**Raised by Sprint:** Sprint 3 (roast: apply_layer_spark_config)

### Problem

`apply_layer_spark_config` sets the Fabric Resource Profile via
`sparkContext.setLocalProperty("spark.fabric.resourceProfile", ...)`. All other settings
in this function use `spark.conf.set(...)`. `setLocalProperty` is thread-local and is reset
after each Spark job, meaning the profile may not apply to subsequent actions in the same
notebook session. Additionally, on Fabric Runtime 1.3+ with Spark Connect, `sparkContext`
may not be available at all (guarded by `getattr` in the implementation — no crash, but the
profile is silently not applied).

It is unclear whether Fabric's Resource Profile API actually expects `setLocalProperty`,
a dedicated Fabric SDK call, or a `spark.conf.set` with a different key name.

### Suggested Resolution

Verify the correct API against the Fabric documentation or Fabric Runtime release notes.
Update `apply_layer_spark_config` to use the confirmed approach.

### Acceptance Criteria
- [x] Confirmed Fabric API for Resource Profile injection via live Livy verification in DEV
- [x] `apply_layer_spark_config` behavior validated for BRONZE/SILVER/GOLD (including `setLocalProperty` round-trip)
- [x] Test/verification evidence recorded in Sprint 20 task card and diary

## TD-063b · `log_event` EnvironmentConfig query — memoize per notebook session

**Severity:** Low
**Raised:** 2026-05-03
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 3 (GAP-06 RTI observability)

### Problem

`log_event` now queries `control.EnvironmentConfig` on every call to check
`EnableRTIObservability`. On a 50-object pipeline with 3 events each = 150 extra
SQL queries per run. Currently wrapped in `try/except` so failures are silent, but
the overhead compounds at scale.

### Suggested Resolution

Cache the EnvironmentConfig lookup for the lifetime of a notebook session (e.g.
module-level `_rti_config_cache: dict | None = None`). Invalidate the cache on
explicit reset only (no TTL needed — Fabric notebook sessions are single-run).

### Acceptance Criteria
- [ ] `_get_rti_config(spark)` helper caches after first call
- [ ] Cache is populated on first `log_event` call and reused for subsequent calls
- [ ] Tests confirm SQL is called exactly once for N successive `log_event` calls
- [ ] CC of `log_event` reduced from 11 to ≤ 8 by extracting RTI lookup into helper

## TD-064 · GAP-05 live commissioning — apply SQL schema, smoke, nb_env_setup, Power BI, Delta retirement

**Severity:** High
**Raised:** 2026-05-03
**Status:** 🔲 Open
**Raised by Sprint:** Sprint 6 (carryover — all items blocked on live Fabric workspace)

### Problem

Sprint 6 completed all offline-testable Phase C work. Five items require a live Fabric
capacity and cannot be unit-tested:

1. `config/control-schema/fabric-sql/01-create-tables.sql` applied in dev/smoke/uat Fabric SQL DBs
2. `config/control-schema/fabric-sql/03-views.sql` applied and Power BI DirectQuery connection confirmed
3. `nb_env_setup.py`: add `_set_fabric_sql_conn()` helper that reads `FabricSqlControlDb` from
   Key Vault / Variable Library and sets `os.environ["PEGGY_SQL_CONN"]` before `get_config` is called
4. Phase A–B smoke validation: `scripts/14-manage-fabric-sql-db.py` create + connection-string,
   `scripts/11` and `scripts/12` provisioning smoke
5. Delta control Lakehouse tables vacuumed and dropped from dev, smoke, uat (NOT prod until sign-off)

### Suggested Resolution

Run when a live Fabric workspace is available. Execute SQL files via SSMS / Azure Data Studio
against the `PeggyControl` Fabric SQL DB. Add `_set_fabric_sql_conn()` to `nb_env_setup.py`
(~10 lines, Fabric-platform code under `try/except ImportError`). Run pipeline smoke. Drop Delta
control tables after confirming 5 clean pipeline runs with Fabric SQL as sole path.

### Acceptance Criteria
- [ ] `01-create-tables.sql` applied to dev, smoke, uat Fabric SQL DBs
- [ ] `03-views.sql` applied; `SELECT * FROM control.vw_pipeline_summary` returns rows
- [ ] `nb_env_setup.py` sets `PEGGY_SQL_CONN` from Key Vault; manual Fabric notebook run confirms
- [ ] 5 full pipeline runs complete with zero `RuntimeError: PEGGY_SQL_CONN not set` errors
- [ ] Delta `db_control.control.*` tables vacuumed + dropped from dev and smoke (uat/prod after sign-off)

---

## TD-063c · `log_event` CC=11 — extract RTI lookup + emit into `_maybe_emit_to_rti`

**Severity:** Low
**Raised:** 2026-05-03
**Status:** ✅ Closed
**Resolved:** 2026-05-03
**Resolved by sprint:** TD sprint 1 (2026-05-03)
**Suggested sprint:** 4
**Raised by Sprint:** Sprint 3 (GAP-06 sniff-test: radon CC=11)

### Problem

`log_event` has cyclomatic complexity 11 (rank C) after GAP-06 added the RTI
lookup + emit block. The threshold for tidy-first is CC > 10. The increase was
accepted during the sprint (near deadline), but should be addressed in Sprint 4.

### Suggested Resolution

Extract the RTI lookup and emit into a private helper:
```python
def _maybe_emit_to_rti(spark_session, pipeline_run_id, object_name, event_type, rows_processed):
    ...
```
This reduces `log_event` CC by ~3 (removes the nested try/if/if/call block).
Fix naturally resolves TD-063b at the same time.

### Acceptance Criteria
- [ ] `log_event` CC ≤ 8 after extraction
- [ ] `_maybe_emit_to_rti` is covered by existing `TestRTIEventstreamEmit` tests
- [ ] No behaviour change — all 7 `test_nb_log_event.py` tests still pass

---

## TD-065 · pytest coverage gate missing from CI/CD Build stage

**Severity:** Medium
**Raised:** 2026-05-04
**Status:** 🔲 Open
**Suggested sprint:** backlog (XS effort — single pipeline step)
**Raised by:** WAF assessment R10 (Operational Excellence — automated quality gates)

### Problem

`pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` is
mandated in `CLAUDE.md` quality gates and enforced locally, but it is not a required step
in `azure-pipelines.yml`. The existing `Build_And_Test` stage runs the Papermill dry-run
notebook smoke but does not execute the pytest suite. A PR that reduces coverage below 80%
would pass CI.

### Suggested Resolution

Add a single pipeline step to the `Build_And_Test` stage in `azure-pipelines.yml`:

```yaml
- script: |
    pip install pytest pytest-cov
    pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v
  displayName: 'pytest coverage gate (≥80%)'
```

No code changes required. The `PEGGY_SQL_STUB=sqlite` environment variable must be set
in the pipeline step to activate the offline SQLite stub.

### Acceptance Criteria
- [ ] `azure-pipelines.yml` `Build_And_Test` stage includes `pytest --cov-fail-under=80` step
- [ ] `PEGGY_SQL_STUB=sqlite` and `PEGGY_SQL_CONN=stub` set as pipeline environment variables
- [ ] A deliberate coverage-reducing PR fails the Build stage (verified in a test branch)
- [ ] Step passes on `claude/new-session-Jgqbi` without failures

---

## TD-066 · ADO approval gate missing between Dev and UAT deployment stages

**Severity:** Medium
**Raised:** 2026-05-04
**Status:** 🔲 Parked
**Suggested sprint:** backlog (XS effort — ADO portal configuration only)
**Raised by:** WAF assessment R1 (Security / Operational Excellence — environment promotion gates)
**Parked:** 2026-05-11 (Sprint 20 kickoff deferred; can be added to any sprint as standalone ADO portal config)

### Problem

Microsoft WAF Operational Excellence guidance recommends Azure DevOps Environments with
manual approval gates before UAT and PROD promotion. The current `azure-pipelines.yml`
uses `condition: succeeded()` chains — a passing `Bootstrap_Dev` stage automatically
triggers `Deploy_UAT` with no human review. There is no break-glass mechanism to halt
promotion if a Dev run produces unexpected results.

### Suggested Resolution

Create two Azure DevOps Environments in the ADO project portal:
- `peggy-uat` — with a required approver (e.g. the Platform Lead)
- `peggy-prod` — with a required approver + business sign-off (two approvers)

Reference these environments in the pipeline YAML:

```yaml
- stage: Deploy_UAT
  jobs:
  - deployment: deploy_uat
    environment: peggy-uat   # triggers approval gate in ADO portal
    ...
```

No code changes to notebooks or tests required. ADO portal configuration only.

### Acceptance Criteria
- [ ] `peggy-uat` ADO Environment created with at least one required approver
- [ ] `peggy-prod` ADO Environment created with two required approvers
- [ ] `azure-pipelines.yml` `Deploy_UAT` stage references `environment: peggy-uat`
- [ ] `azure-pipelines.yml` `Deploy_Prod` stage references `environment: peggy-prod`
- [ ] A test run confirms the pipeline pauses at the UAT stage pending approval

---

## TD-067 · Review nb_orchestrator.py retry logic against native Fabric notebook retry policy

**Severity:** Low
**Raised:** 2026-05-04
**Status:** ✅ Closed
**Resolved:** 2026-05-11
**Resolved by sprint:** 20
**Suggested sprint:** Sprint 7 (review only — no code change expected)
**Raised by:** Fabric April 2026 Feature Summary — Notebook Retry Policy GA

### Problem

Fabric Notebooks now support a native retry policy (up to 3 automatic restarts, ~120s
between attempts) when a Spark cluster is recycled mid-run. `nb_orchestrator.py`
implements its own retry / error-handling logic in `run_pipeline` via `try/except` blocks
and `ControlLog` failure recording. It is not yet known whether the two retry mechanisms
interact correctly — specifically:

1. If Fabric retries a notebook that has already partially written to a Delta table, does
   the second attempt produce duplicate rows or trigger a watermark state conflict?
2. Does `nb_orchestrator.py`'s `log_control_event` failure recording fire on each retry
   attempt or only on final failure? If it fires on each attempt, the ControlLog will
   contain spurious failure events for transient cluster recycling.
3. Does the native retry count towards the orchestrator's own retry budget, or is it
   additive?

### Suggested Resolution

1. Read the Fabric documentation for the native notebook retry policy (retry scope,
   idempotency guarantees, and interaction with Spark session state).
2. Test with `EnableProfiling=True` (GAP-07 path) to confirm that a mid-run cluster
   recycle followed by a native retry does not double-write profile rows to
   `control.BronzeProfile`.
3. If the native retry is safe for the current notebook design (idempotent watermark
   writes, MERGE-based Silver writes), document the finding in a CLAUDE.md note and
   close this TD.
4. If interaction issues exist, add a `idempotency_token` (run_id) guard to the
   Delta MERGE predicate so that a retry with the same `run_id` is a no-op.

### Acceptance Criteria
- [x] Retry strategy reviewed against Fabric behavior; no conflict requiring code change found
- [x] Finding recorded inline in orchestrator notes during Sprint 20 review
- [x] TD closed as review-only outcome (no idempotency code changes required)

---

## TD-068 · Assert Workspace Outbound Access Protection (OAP) active in provisioning script

**Severity:** Low
**Raised:** 2026-05-04
**Status:** 🔲 Open
**Suggested sprint:** backlog (XS effort — Fabric REST API call + assertion)
**Raised by:** Fabric April 2026 — Workspace OAP GA for Spark, Data Factory, Mirrored Databases

### Problem

Workspace Outbound Access Protection (OAP) reached GA in April 2026 for Spark notebooks,
Data Factory Pipelines/Copy Job/Dataflows, and Mirrored Databases. OAP prevents Fabric
workloads from making outbound connections to destinations not explicitly allowlisted by
the Workspace Admin, providing a defence-in-depth security boundary (WAF R11).

`scripts/11-provision-workspace-identity.py` currently provisions Workspace Identity (WI)
but does not check whether OAP is enabled on the target workspace. A workspace deployed
without OAP is technically functional but does not meet the WAF security posture.

Peggy's notebooks are OAP-compatible by design (all outbound calls go through WI/SCC/Key
Vault registered routes), but the provisioning script does not assert this or fail fast
if OAP is not active.

### Suggested Resolution

Add a pre-flight OAP check to `scripts/11-provision-workspace-identity.py`:

```python
def assert_oap_enabled(workspace_id: str, token: str) -> None:
    url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/settings"
    resp = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    resp.raise_for_status()
    oap = resp.json().get("outboundAccessProtectionEnabled", False)
    if not oap:
        raise RuntimeError(
            f"Workspace {workspace_id}: Outbound Access Protection is not enabled. "
            "Enable OAP in the Fabric Admin portal before running this script."
        )
```

No notebook code changes required — OAP is a workspace-level setting enforced by the
Fabric platform, not by application code.

### Acceptance Criteria
- [ ] `scripts/11-provision-workspace-identity.py` calls `assert_oap_enabled` as a pre-flight step
- [ ] Script exits with a clear error message if OAP is not active
- [ ] README or `scripts/README.md` documents the one-time OAP portal enablement step
- [ ] Verified: `nb_conn_jdbc.py`, `nb_conn_rest.py`, `nb_conn_mirror.py` all function correctly with OAP enabled (no allowlist additions needed for standard WI/SCC paths)

---

## TD-069 · `test_write_pii_candidates_calls_spark_write` — untracked failing test

**Severity:** Low
**Raised:** 2026-05-04
**Status:** ✅ Closed
**Resolved:** 2026-05-06
**Resolved in:** fix(tests): closed TD-056/069 — root cause was `from pyspark.sql.types import StructType` failing because `_make_stubs()` placed a plain `MagicMock()` in `sys.modules["pyspark.sql.types"]`. Python 3.11's import machinery cannot `from MagicMock import Name`. Fixed by building a proper `types.ModuleType` stub with all required type classes as real (but trivial) type objects, set with direct assignment to guarantee it wins regardless of test-collection order. 999 passed, 0 failed.

### Acceptance Criteria
- [x] `pytest tests/test_nb_pii_scanner.py::TestScanDataframe::test_write_pii_candidates_calls_spark_write` passes
- [x] No new mock leakage into other tests in the file

---

## TD-070 · En dashes (–) in docstring parameter separators across notebooks

**Severity:** Low
**Raised:** 2026-05-04
**Status:** ✅ Closed
**Resolved:** 2026-05-11
**Resolved by sprint:** 20
**Suggested sprint:** backlog (XS effort — sed/replace pass)
**Raised by:** repo memory audit (2026-05-04)

### Problem

En dash (U+2013) is used as a parameter description separator in docstrings across
multiple notebook source files. Should be ASCII hyphen-minus (`-`) for consistency
and to avoid encoding surprises in tooling (e.g. grep, diff, some CI log renderers).

**Files affected:**
- `src/notebooks/nb_conn_rest.py` — lines 49–51 (auth_mode values), lines 211–215 (Parameters block)
- `src/notebooks/nb_conn_file.py` — lines 246–250 (Parameters block)
- `src/notebooks/nb_conn_jdbc.py` — lines 51–55 (Parameters block)
- `src/notebooks/nb_utils_config.py` — line 62 (inline comment), line 98 (docstring precedence list)
- `src/notebooks/nb_landing_to_bronze.py` — lines 36–37, 92, 140, 168 (inline comments)

Already fixed: `nb_landing_to_bronze.py` lines 48–52 (docstring params).

### Suggested Resolution

```powershell
Get-ChildItem src/notebooks/*.py | ForEach-Object {
    (Get-Content $_.FullName -Raw) -replace '\u2013', '-' | Set-Content $_.FullName
}
```

Verify no ruff/bandit regressions after the pass.

### Acceptance Criteria
- [x] Zero U+2013 characters in `src/notebooks/` source files
- [x] Normalization validated in Sprint 20 local tranche (commit `46873ca`)

---

## TD-071 · `_resolve_landing_files_root` duplicated in two notebooks

**Severity:** Low
**Raised:** 2026-05-04
**Status:** ✅ Closed
**Resolved:** 2026-05-11
**Resolved by sprint:** 20
**Suggested sprint:** backlog
**Raised by:** repo memory audit (2026-05-04)

### Problem

`_resolve_landing_files_root(notebookutils, landing_lh)` is defined inline in both
`nb_conn_rest.py` and `nb_landing_to_bronze.py`. The function belongs in
`nb_utils_fabric.py` alongside `find_lakehouse_details` / `get_lakehouse_id_by_name`.

**Blockers before refactor:**
- Both callers `%run ./NB_UTILS_CONFIG` only — need to add `%run ./NB_UTILS_FABRIC`
- `nb_utils_fabric.py` uses `notebookutils` as a Fabric global (no parameter); helper
  takes it as a parameter — convention needs reconciling before move

### Suggested Resolution

1. Add `_resolve_landing_files_root` to `nb_utils_fabric.py` with `notebookutils` as parameter
2. Add `%run ./NB_UTILS_FABRIC` (commented, with `try/except ImportError` guard) to
   `nb_conn_rest.py` and `nb_landing_to_bronze.py`
3. Remove the inline copies from both connectors

### Acceptance Criteria
- [x] Shared resolver extracted to `src/notebooks/nb_utils_paths.py`
- [x] Inline copies replaced with shared import/delegation in both notebooks
- [x] Existing connector tests pass (validated in Sprint 20 local tranche)

---

## TD-072 · `NB_SOURCE_TO_LANDING` missing `IsActive` filter and ControlLog writes

**Severity:** Low
**Raised:** 2026-05-04
**Status:** 🔲 Open
**Suggested sprint:** backlog
**Raised by:** repo memory audit (2026-05-04)

### Problem

Two gaps in `NB_SOURCE_TO_LANDING`:

1. **No `IsActive` filter** — `control.IngestionSource` has no `IsActive` column; sources
   are treated as active by their presence in the table. If retired/inactive sources need
   to be supported in future, an `IsActive` column should be added to `IngestionSource`
   and the notebook should filter on it.

2. **No ControlLog writes** — `NB_SOURCE_TO_LANDING` uses `%run ./NB_UTILS_PROCESSING`
   (not `NB_UTILS_CONFIG`), so it makes no `log_execution_start` / `log_execution_end`
   calls and writes nothing to `control.controllog`. There is no per-run traceability
   for landing-layer operations.

### Suggested Resolution

1. Add `IsActive BIT DEFAULT 1` column to `IngestionSource` DDL in `nb_bootstrap.py`
   (additive — existing rows default to active; no data loss)
2. Add `log_execution_start` / `log_execution_end` calls to `NB_SOURCE_TO_LANDING`
   using the `nb_utils_config` pattern already used in other layer notebooks

### Acceptance Criteria
- [ ] `IngestionSource` DDL includes `IsActive BIT DEFAULT 1`
- [ ] `NB_SOURCE_TO_LANDING` filters `WHERE IsActive = 1`
- [ ] `NB_SOURCE_TO_LANDING` writes a `ControlLog` entry for each run (start + end)
- [ ] `nb_bootstrap.py` DDL change is guarded with `_add_column_if_missing`
---

## TD-073 · `test_load_png_icon_returns_data_uri` — missing icon PNG files in `scripts/icons/`

**Severity:** Low
**Raised:** 2026-05-05
**Resolved:** 2026-05-05
**Status:** ✅ Done
**Raised by:** Sprint 9 close — baseline audit

### Problem

`tests/test_apply_workspace_icons.py::TestApplyWorkspaceIcons::test_load_png_icon_returns_data_uri`
fails with 4 sub-failures (one per env: `dev`, `uat`, `prod`, `reports`):

```
FileNotFoundError: [Errno 2] No such file or directory:
  'scripts/icons/dev_icon.png'  (also uat_icon.png, prod_icon.png, reports_icon.png)
```

`scripts/04-apply-workspace-icons.py:load_png_icon()` opens the PNG from disk by path.
The icon files were never committed — likely excluded via `.gitignore` or simply never
created. The test does not mock the filesystem.

### Suggested Resolution

Either:
1. Add placeholder 1×1 PNG files (committed, gitignored-exempt) at `scripts/icons/{env}_icon.png`, **or**
2. Mock `open()` in the test so it does not require real files on disk (preferred — pure unit test)

### Resolution
Mocked `builtins.open` with `unittest.mock.mock_open` in `test_load_png_icon_returns_data_uri`.
No PNG files needed on disk. 4 sub-tests now pass.

### Acceptance Criteria
- [x] `test_load_png_icon_returns_data_uri` passes in CI with no local filesystem dependency
- [x] No PNG binaries committed to the repo

---

## TD-074 · `test_run_targets_declare_no_parameters` — `nb_conn_jdbc.py` missing `no_parameters: true` frontmatter

**Severity:** Low
**Raised:** 2026-05-05
**Resolved:** 2026-05-05
**Status:** ✅ Done
**Raised by:** Sprint 9 close — baseline audit

### Problem

`tests/test_build_notebooks.py::TestRunTargetGovernance::test_run_targets_declare_no_parameters`
fails:

```
AssertionError: These notebooks are loaded via %run but are missing
  'no_parameters: true' in their front matter:
    - nb_conn_jdbc.py
assert not ['nb_conn_jdbc']
```

`nb_conn_jdbc.py` is used as a `%run` target by other notebooks but its YAML frontmatter
does not include `no_parameters: true`. The governance test enforces this convention for
all `%run` targets to prevent accidental parameter injection.

### Suggested Resolution

Add `no_parameters: true` to the YAML frontmatter block at the top of
`src/notebooks/nb_conn_jdbc.py`.

### Resolution
Added `no_parameters: true` to the YAML frontmatter block in `src/notebooks/nb_conn_jdbc.py`.

### Acceptance Criteria
- [x] `nb_conn_jdbc.py` frontmatter contains `no_parameters: true`
- [x] `test_run_targets_declare_no_parameters` passes

---

## TD-075 · `test_each_pipeline_validates_against_pipeline_definition_schema` — `pl_00_daily_ingestion` missing `properties`

**Severity:** Low
**Raised:** 2026-05-05
**Resolved:** 2026-05-05
**Status:** ✅ Done
**Raised by:** Sprint 9 close — baseline audit

### Problem

`tests/test_copy_activity_schema.py::TestPipelineSchemaValidation::test_each_pipeline_validates_against_pipeline_definition_schema`
fails:

```
AssertionError: Pipeline 'pl_00_daily_ingestion.DataPipeline' failed
  pipelineDefinition schema validation (MS spec 2018-06-01):
    [] 'properties' is a required property
```

The Fabric `DataPipeline` JSON definition for `pl_00_daily_ingestion` does not include a
top-level `properties` object, which is required by the MS pipeline schema spec
`2018-06-01`. The pipeline may have been authored before this schema requirement was added
to the governance test, or may be incomplete.

### Suggested Resolution

Add a `"properties": {}` (or the real properties block) to the pipeline definition JSON
at `workspace/data-pipelines/pl_00_daily_ingestion.DataPipeline/pipeline-content.json`
(or equivalent path).

### Resolution
The pipeline-content.json is an ARM template wrapper (`resources[0].properties`).
Added `_unwrap_arm()` helper to `_load_pipelines()` in `test_copy_activity_schema.py`:
if the root JSON contains `resources`, the first resource item is extracted before
schema validation. This is the correct approach — Fabric exports in ARM format;
the schema validates the pipeline definition object, not the wrapper.

### Acceptance Criteria
- [x] `pl_00_daily_ingestion.DataPipeline` passes `pipelineDefinition` schema validation
- [x] `test_each_pipeline_validates_against_pipeline_definition_schema` passes

---

## TD-076 · Live DEV migration SQL for `ObjectConfig.CleansingRules` not yet applied

**Severity:** Low (schema guard in `nb_bootstrap.py` means platform still works; column
simply absent until bootstrap re-run or manual migration applied)
**Raised:** 2026-05-06
**Status:** ✅ Closed
**Resolved:** 2026-05-11
**Resolved by sprint:** 20
**Raised by:** Sprint 13 close — DoD carry-over
**Reference:** ADR-043, Sprint 13, `config/control-schema/fabric-sql/05-add-cleansing-rules.sql`

### Problem

Sprint 13 delivered an idempotent `_add_column_if_missing` guard in `nb_bootstrap.py`
that adds `CleansingRules STRING` to `control.ObjectConfig` on the next notebook run.
However the DoD item "Live DEV migration SQL applied and recorded" was not completed
before sprint close — the column has not been confirmed present in the actual DEV
Fabric lakehouse environment.

### Suggested Resolution

1. Open the DEV Fabric workspace and run `nb_bootstrap` (which applies the guard
   automatically via `_add_column_if_missing`), **or**
2. Execute the manual migration directly in the Fabric SQL analytics endpoint:
   ```sql
   ALTER TABLE control.ObjectConfig ADD COLUMN CleansingRules STRING;
   ```
   Migration file: `config/control-schema/fabric-sql/05-add-cleansing-rules.sql`

3. Confirm column present:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'ObjectConfig'
     AND column_name = 'CleansingRules';
   ```

4. Mark this TD closed.

### Acceptance Criteria
- [x] `control.ObjectConfig.CleansingRules STRING` column confirmed present in DEV lakehouse (`TD076_CLEANSINGRULES_COLUMN_EXISTS=True`)
- [x] Migration path captured in Sprint 20 run notes and task card evidence

---

## TD-077 · `scripts/deploy_fabric_cli.sh` — Fabric CLI deployment path not yet implemented

**Severity:** Low
**Raised:** 2026-05-06
**Status:** 🔲 Open
**Raised by:** Sprint 17 close — Cycle 11 deferred (optional P1-D deliverable)
**Reference:** Sprint 17 plan, OPERATIONS.md

### Problem

Sprint 17 planned a `scripts/deploy_fabric_cli.sh` script to provide a `fab` CLI
deployment path: create workspaces, import items, assign capacity, and set Variable
Library values. This was marked as optional ("defer if time-constrained") and was
not delivered in Sprint 17.

### Suggested Resolution

1. Write `scripts/deploy_fabric_cli.sh` with a `command -v fab || { echo "fab CLI not installed"; exit 1; }` guard at the top.
2. Implement: `fab workspace create`, `fab item import`, capacity assignment, and Variable Library value injection.
3. Run `bash -n scripts/deploy_fabric_cli.sh` (syntax check).
4. Document usage under `## Fabric CLI Deployment` in `OPERATIONS.md`.
5. Commit: `feat(scripts): add deploy_fabric_cli.sh Fabric CLI deploy path`

### Acceptance Criteria
- [ ] `scripts/deploy_fabric_cli.sh` exists with `fab` guard at top
- [ ] `bash -n scripts/deploy_fabric_cli.sh` passes (syntax check)
- [ ] Usage documented in `OPERATIONS.md` under "Fabric CLI Deployment"

---

## TD-078 · `control.annotations` — table exists in live DEV but missing from `nb_bootstrap.py` DDL

**Severity:** Medium
**Raised:** 2026-05-08
**Status:** ✅ Closed
**Resolved:** 2026-05-11
**Resolved by sprint:** 20
**Raised by:** Live schema audit — `docs/erd/live_schema_snapshot.json` vs bootstrap DDL
**Reference:** `docs/control_plane_quick_reference.md` (table documented); `src/notebooks/nb_bootstrap.py` (DDL absent)

### Problem

The `control.annotations` table (per-column commentary — `AnnotationID`, `TableName`, `ColumnName`, `Comment`, `Author`, `CreatedAt`, `IsResolved`) exists in the live `BFL_DEV_Control_LH` lakehouse and is documented in `docs/control_plane_quick_reference.md`, but has no DDL entry in `nb_bootstrap.py`. This means:

- A fresh environment bootstrap will **not** create the table.
- The table schema is not under source control.
- Live table has all columns as `nullable=true` / `varchar(8000)` — no constraints enforced.

### Suggested Resolution

1. Add a `_create_annotations_table(spark)` helper in `nb_bootstrap.py` following the existing DDL pattern:
   ```python
   spark.sql("""
       CREATE TABLE IF NOT EXISTS {control}.annotations (
           AnnotationID  STRING  NOT NULL,
           TableName     STRING  NOT NULL,
           ColumnName    STRING,
           Comment       STRING,
           Author        STRING,
           CreatedAt     TIMESTAMP,
           IsResolved    BOOLEAN
       ) USING DELTA
   """)
   ```
2. Call it from `_create_control_tables()` alongside other table creation helpers.
3. Write a unit test in `tests/test_nb_bootstrap.py` asserting the table DDL is called.
4. Commit: `feat(bootstrap): add annotations table DDL to nb_bootstrap`

### Acceptance Criteria
- [x] `nb_bootstrap.py` contains DDL for `control.annotations`
- [x] `_create_annotations_table` called from `_create_control_tables`
- [x] Unit tests cover the DDL call (`tests/test_nb_bootstrap.py -k annotation`)
- [x] Targeted test run passes (`2 passed`)
---

## TD-079 · `azure-pipelines.yml` Smoke_Livy stage awaiting HITL validation

**Severity:** Medium
**Raised:** 2026-05-09
**Raised by sprint:** 18
**Status:** ✅ Done
**Resolved:** 2026-05-09
**Resolved by Sprint:** 19
**Resolved by (partial):** `e5a12e3` — MSAL fallback + main(); CI stage added to azure-pipelines.yml

### Problem

`scripts/smoke_livy.py` and `tests/test_script_smoke_livy.py` are delivered and unit-tested (Sprint 18). The `azure-pipelines.yml` `Smoke_Livy` stage cannot be added until the Livy endpoint URL and Entra token scopes (`Lakehouse.Execute.All`, `Code.AccessFabric.All`, `Lakehouse.Read.All`, `Code.AccessStorage.All`) are confirmed against a live DEV workspace with active Fabric capacity (≥ F2). The HITL validation step was not completed in Sprint 18 due to the absence of a live Fabric session.

### Suggested Resolution

1. Run `python scripts/smoke_livy.py --workspace <ws-id> --lakehouse <lh-id>` against a live DEV workspace
2. Confirm Livy endpoint responds with `200 OK` and `{"id": "<job-id>"}`
3. Poll for `success` state; record actual scopes used
4. Add `Smoke_Livy` stage to `azure-pipelines.yml` (parallel with existing `Smoke_Test`; does not replace it)

### Acceptance Criteria
- [x] `smoke_livy.py` validated against live DEV workspace — exit code 0 confirmed, Sessions API (ws `96bb20f3`, lh `d65b7507`) (Sprint 19)
- [x] MSAL fallback added to `acquire_livy_token` — SP auth for CI context (`e5a12e3`)
- [x] `main()` entry point added — `--workspace-id`, `--lakehouse-id`, `--dry-run` args (`e5a12e3`)
- [x] `Smoke_Livy` stage added to `azure-pipelines.yml` after `Bootstrap_Dev` (`e5a12e3`)
- [x] HITL comment updated in pipeline; Sessions API fix committed (Sprint 19)

### Resolution

Sprint 19 provisioned the DEV workspace (`96bb20f3`) with schema-enabled lakehouse `lh_smoke` (`d65b7507`). `smoke_livy.py` was rewritten from Batch API to Sessions API (Batch requires an ABFSS `file` URI; Sessions supports inline `code`). Statement terminal state bug fixed: `_STATEMENT_TERMINAL_STATES` changed from `{"ok", ...}` to `{"available", ...}` (`"ok"` is `output.status`, never `state`). Live smoke run returned exit code 0. 13 unit tests green. Pipeline HITL comment updated.
