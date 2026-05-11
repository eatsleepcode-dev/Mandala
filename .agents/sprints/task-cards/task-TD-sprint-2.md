---
gap_id: TD-sprint-2
sprint: TD-2
status: COMPLETE
adr_required: NOT REQUIRED
---

# Task: TD Sprint 2 — Offline-actionable tech debt

**Status**: COMPLETE
**Vibe Mode**: HARDENING
**Branch**: `claude/review-recent-commits-Auyjc`
**Sprint**: TD-2
**Effort**: M (half-day)
**Score impact**: 0 pts (quality / test health; no new feature gaps)

TDs in scope: TD-051 (High), TD-046, TD-054, TD-056, TD-041

---

## Context (The Elephants 🐘)

1. **`create_secret` CC=24 refactor risk** (TD-051): Extracting sub-functions from
   `create_secret` in `nb_utils_fabric.py` may silently change error-handling observable
   behaviour if the complex conditional tree has hidden early-returns. Every branch must
   be covered before refactoring.
   - *Strategy*: Format + noqa pass first (pure cosmetic). Refactor CC only if existing
     tests cover `create_secret` call sites. Accept CC≤10 target but do not introduce
     behaviour change.
   - *Status*: ⏳ Pending

2. **`build_dag` CC=27 tidy obligation** (TD-046): `build_dag` is rated D (CC=27). TD-046
   asks for three specific defensive guards (MEDIUM-02, -04, -05) inside this function.
   Adding guards to a D-rated function makes it harder to test — tidy first is required.
   - *Strategy*: Extract the three natural sub-sections of `build_dag` (source resolution,
     args construction, activity assembly) into helpers before adding the guards.
   - *Status*: ⏳ Pending

3. **S113 timeout in LRO polling loops** (TD-054): Some of the 30 remaining calls are
   inside poll loops (e.g., `nb_platform_bootstrapper.py` Fabric LRO). A blanket
   `timeout=30` will spuriously fail long-running capacity operations.
   - *Strategy*: Use `timeout=30` for single-shot API calls; use `timeout=120` for
     known LRO polling loops with an inline comment. Never leave a call without a timeout.
   - *Status*: ⏳ Pending

4. **Missing source modules for 4 test files** (TD-041): `fabric_semantic_model`,
   `fabric_shortcuts`, `deploy_notebook_ipynb`, `fabric_orchestrator` are imported by
   test files but do not exist anywhere in the codebase. These appear to be tests written
   ahead of implementation. Creating full stubs may mask future breakage.
   - *Strategy*: Add `pytest.importorskip()` at the top of each affected test file so
     the tests are skipped cleanly rather than erroring. Do NOT create stub implementations.
     Fix sys.path for `Hub_Plugins` (module exists at `Modules/Hub_Plugins/` but conftest
     doesn't include `Modules/` on `sys.path`). Skip `playwright` and broken `azure` (env
     constraint — annotate explicitly).
   - *Status*: ⏳ Pending

5. **pyspark mock missing in `test_populated_tables_are_written`** (TD-056): The
   `createDataFrame` + `write.format("delta").mode().saveAsTable()` chain must be fully
   mocked. A partially-mocked MagicMock will pass `AttributeError` silently via the chain
   if `write` returns the wrong object type.
   - *Strategy*: Use the same `write_chain` pattern from existing tests (see conftest
     `mock_spark` fixture). Verify the mock matches the exact call sequence in
     `seed_control_db_local`.
   - *Status*: ⏳ Pending

---

## Live DEV Migration SQL

```sql
-- No schema change required.
-- All changes are: code refactors, lint fixes, test infrastructure, timeout parameters.
```

---

## Execution Plan (Ralph's Ledger)

### Tidy Cycle A — `nb_utils_fabric.py` format pass (TD-051 — cosmetic only)
- [x] Run `ruff format src/notebooks/nb_utils_fabric.py`
- [x] Run `ruff check src/notebooks/nb_utils_fabric.py --select=E501 --ignore=S101,S603,S607` and add `# noqa: E501` on unavoidable long lines (Fabric API call chains)
- [x] Verify `create_secret` CC still readable (do not refactor yet)
- [x] COMMIT: `tidy(nb_utils_fabric): ruff format + E501 noqa — clear 147 cosmetic violations`

### Tidy Cycle B — `build_dag` extract sub-functions (TD-046 prerequisite)
- [x] Extract `_resolve_fan_out_source(step, control_lh, spark)` from `build_dag`
- [x] Extract `_build_base_args(pipeline_id, control_lh, landing_lh, workspace_guid)` if not already present
- [x] Confirm CC drops below 20 after extraction; no behaviour change
- [x] COMMIT: `tidy(nb_orchestrator): extract build_dag sub-functions — CC 27→<20`

### Cycle 1 — `create_secret` sub-function extraction (TD-051)
- [x] 🔴 RED: `tests/test_nb_utils_fabric.py::TestCreateSecret::test_creates_secret_in_keyvault` — baseline assertion on happy path (if test file doesn't exist, write it)
- [x] 🟢 GREEN: Extract `_build_secret_payload`, `_post_secret`, `_handle_secret_response` from `create_secret` to reduce CC from 24 to ≤10
- [x] 🔵 REFACTOR: Confirm `ruff check --select=C90` shows ≤10 for all functions; keep helpers private (`_`)
- [x] COMMIT: `fix(nb_utils_fabric): extract create_secret helpers — CC 24→≤10 (TD-051)`

### Cycle 2 — `build_dag` defensive guards (TD-046)
- [x] 🔴 RED: `tests/test_nb_orchestrator.py::TestBuildDag::test_none_notebook_name_raises` — asserts ValueError when `NotebookName` is None
- [x] 🔴 RED: `tests/test_nb_orchestrator.py::TestBuildDag::test_non_dict_step_args_raises` — asserts ValueError when `StepArgs` is a JSON array not a dict
- [x] 🔴 RED: `tests/test_nb_orchestrator.py::TestBuildDag::test_landing_lh_present_when_empty_string` — asserts `_base_args` output always has `LandingLakehouse` key
- [x] 🟢 GREEN: Add MEDIUM-02, MEDIUM-04, MEDIUM-05 guards to `build_dag` / `_build_base_args`
- [x] 🔵 REFACTOR: none required
- [x] COMMIT: `fix(nb_orchestrator): MEDIUM-02/04/05 defensive guards — null notebook, bad step_args, LandingLakehouse (TD-046)`

### Cycle 3 — HTTP timeout pass (TD-054)
- [x] 🔴 RED: `tests/test_nb_platform_bootstrapper.py::TestHttpTimeouts::test_all_requests_have_timeout` — scan AST for requests calls lacking timeout kwarg (or use ruff S113 gate)
- [x] 🟢 GREEN: Add `timeout=30` to all 30 remaining S113 violations; use `timeout=120` for LRO poll calls with inline comment
- [x] 🔵 REFACTOR: `ruff check src/notebooks/ --select=S113` → 0 violations
- [x] COMMIT: `fix(notebooks): add timeout to all 30 remaining HTTP calls — S113 clear (TD-054)`

### Cycle 4 — `test_nb_utils_config.py` pyspark guard (TD-056)
- [x] 🔴 RED: Confirm `pytest tests/test_nb_utils_config.py` currently fails on `test_populated_tables_are_written`
- [x] 🟢 GREEN: Mock the pyspark `createDataFrame` + `write` chain in `test_populated_tables_are_written` using the `write_chain` pattern
- [x] 🔵 REFACTOR: none required
- [x] COMMIT: `fix(tests): mock pyspark write chain in test_populated_tables_are_written (TD-056)`

### Cycle 5 — Test collection errors (TD-041)
- [x] 🔴 RED: Confirm `pytest tests/ --collect-only` shows 10 collection errors
- [x] 🟢 GREEN:
  - Add `sys.path.insert(0, os.path.abspath("Modules"))` to `conftest.py` → fixes `Hub_Plugins` in `test_azure_deployment.py` and `test_preflight_notebook_cell.py`
  - Add `pytest.importorskip("fabric_semantic_model")` guard to `test_fabric_semantic_model.py`
  - Add `pytest.importorskip("fabric_shortcuts")` guard to `test_fabric_shortcuts.py`
  - Add `pytest.importorskip("deploy_notebook_ipynb")` guard to `test_deploy_notebook_ipynb.py`
  - Add `pytest.importorskip("fabric_orchestrator")` guard to `test_orchestration.py`
  - Fix `test_fabric_pipeline_deployer.py` sys.path to use `src.utils` correctly
  - Fix `test_manage_fabric_capacity.py` importlib call to use script path directly
- [x] 🔵 REFACTOR: `pytest tests/ --collect-only -q` → 0 collection errors (env-broken `playwright`/`azure` native acceptable as skip, not error)
- [x] COMMIT: `fix(tests): resolve 10 collection errors — importorskip guards + sys.path (TD-041)`

---

## DoD Gates

```bash
ruff check src/notebooks/nb_utils_fabric.py --select=E,W,B,S,C90 --ignore=S101,S603,S607
radon cc src/notebooks/nb_utils_fabric.py -nc   # no D-rated functions
ruff check src/notebooks/ --select=S113         # 0 violations
pytest tests/ --collect-only -q                 # 0 collection errors
pytest tests/test_nb_utils_config.py -v         # all pass
pytest tests/test_nb_orchestrator.py -v         # all pass
pytest tests/ --tb=short -q --ignore=... -v    # ≥ 701 pass, no regressions
```
