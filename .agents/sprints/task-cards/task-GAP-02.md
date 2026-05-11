---
gap_id: GAP-02
sprint: 1
status: COMPLETE
adr_required: NOT REQUIRED
---

# Task: GAP-02 — Parallel Dev/Prod queue isolation (WorkspaceGuid injection)

**Status**: COMPLETE
**Vibe Mode**: CREATION
**Branch**: `claude/review-recent-commits-Auyjc`
**Sprint**: 1
**Effort**: S (1–2 days)
**Score impact**: +6 pts (Engineering / P2 item → 3/3)

---

## Context (The Elephants 🐘)

1. **Dual `base_args` construction in `build_dag`**: `workspace_guid` must be injected in
   two separate code paths — the fan-out path (`FanOutSource: ObjectConfig`) and the default
   single-activity path. Both build their own `base_args` dict at lines ~100 and ~120 of
   `nb_orchestrator.py`. Missing either silently passes an empty string to that class of jobs.
   - *Strategy*: Extract a `_base_args(pipeline_id, control_lh, landing_lh, workspace_guid)` helper
     called from both paths. Single injection point, single test target.
   - *Status*: ⏳ Pending

2. **`notebookutils.runtime.context` is Fabric-only**: The description suggests reading the
   GUID from `notebookutils.runtime.context` as a default. Do not do this — it will break
   every offline unit test with `AttributeError`. The GUID must come from `EnvironmentConfig`
   in the control lakehouse (read by `run_pipeline`) or be passed explicitly. The default must
   be `""`, not a runtime call.
   - *Strategy*: `workspace_guid: str = ""` as parameter default. `run_pipeline` reads it from
     `EnvironmentConfig` and passes it through. No `notebookutils` call.
   - *Status*: ⏳ Pending

3. **Silent empty-string pass-through in live env**: If `WorkspaceGuid` row is missing from
   `EnvironmentConfig` in DEV/UAT/PROD, `env.get("WorkspaceGuid", "")` returns `""` and
   every pipeline runs without a GUID — no error, no warning, no observable failure. The gap
   is operationally invisible until someone checks the ADO logs.
   - *Strategy*: Add `WorkspaceGuid` row to all seed files. Add a test that asserts the row
     exists. Document in ADR-031 notes that the ADO variable group must define `WORKSPACE_GUID`.
   - *Status*: ⏳ Pending

4. **ADO variable group not covered by any test**: The `azure-pipelines.yml` change
   (`$(WORKSPACE_GUID)` per Bootstrap stage) cannot be unit tested. If the ADO library variable
   group doesn't have `DEV_WORKSPACE_GUID`/`UAT_WORKSPACE_GUID`/`PROD_WORKSPACE_GUID` defined,
   the pipeline silently passes an empty string.
   - *Strategy*: Document as a manual DoD gate. Add a comment in `azure-pipelines.yml` naming
     the required ADO library variable.
   - *Status*: ⏳ Pending (manual gate)

5. **Schema drift**: `EnvironmentConfig` DDL in `nb_bootstrap.py` is confirmed as
   `EnvName, ParameterName, ParameterValue, Description`. Seed row must match exactly —
   no `Description` field currently exists on most rows. Adding it is safe (nullable column).
   - *Strategy*: Include `"Description"` key in the new seed row. No ALTER TABLE needed —
     column already exists in DDL.
   - *Status*: ✅ Resolved (confirmed via grep)

---

## Live DEV Migration SQL

```sql
-- No schema change required.
-- EnvironmentConfig already has: EnvName, ParameterName, ParameterValue, Description
-- New row inserted by re-running nb_seed_control_lh after seed-dev.json update.
```

---

## Execution Plan (Ralph's Ledger)

### Cycle 1 — `build_dag` injects `WorkspaceGuid` into every activity

- [x] 🔴 RED: `tests/test_nb_orchestrator.py::TestBuildDagWorkspaceGuid::test_workspace_guid_injected_into_activity_arguments`
      — asserts each activity's `args` dict contains `WorkspaceGuid = "ws-abc-123"`
- [x] 🔴 RED: `tests/test_nb_orchestrator.py::TestBuildDagWorkspaceGuid::test_workspace_guid_empty_string_when_omitted`
      — asserts `WorkspaceGuid = ""` when param not passed
- [x] 🔴 RED: `tests/test_nb_orchestrator.py::TestBuildDagWorkspaceGuid::test_workspace_guid_injected_in_fanout_path`
      — asserts fan-out activities also carry `WorkspaceGuid`
- [x] 🟢 GREEN: add `workspace_guid: str = ""` to `build_dag` signature; extract
      `_base_args()` helper; inject in both fan-out and default paths
- [x] 🔵 REFACTOR: `step_args.pop("WorkspaceGuid")` guards both paths; `run_pipeline`
      per-step params use `_base_args()` instead of inline dict
- [x] COMMIT: RED → GREEN → REFACTOR committed per TDD convention

### Cycle 2 — `run_pipeline` reads `WorkspaceGuid` from `EnvironmentConfig` and forwards it

- [x] 🔴 RED: `tests/test_nb_orchestrator.py::TestRunPipelineWorkspaceGuid::test_workspace_guid_from_env_passed_to_build_dag`
      — mocks Spark to return a `WorkspaceGuid` env row; asserts `build_dag` receives it
- [x] 🟢 GREEN: `run_pipeline` reads `EnvironmentConfig`, extracts `WorkspaceGuid`,
      passes to `build_dag(... workspace_guid=workspace_guid)`
- [x] 🔵 REFACTOR: folded into Cycle 1 REFACTOR commit (same function)
- [x] COMMIT: combined into Cycle 1 RED/GREEN/REFACTOR commits

### Cycle 3 — Seed contains `WorkspaceGuid` row

- [x] 🔴 RED: `tests/test_nb_orchestrator.py::TestSeedIntegrity::test_seed_dev_contains_workspace_guid`
      — opens `config/seed-dev.json`; asserts `WorkspaceGuid` in `ParameterName` values
- [x] 🟢 GREEN: add `WorkspaceGuid` row to `config/seed-dev.json` `EnvironmentConfig`
- [x] 🔵 REFACTOR: none
- [x] COMMIT: combined into GREEN commit

### Post-cycles — ADO wiring (manual, no test possible)

- [x] Add `$(DEV_WORKSPACE_GUID)` env var + comment to Bootstrap_Dev stage in
      `azure-pipelines.yml`; comment names the required ADO library variable
- [x] Add implementation note to `docs/adr/ADR-031-three-repo-cicd-architecture.md`
      documenting variable group requirements and GUID flow

---

## Gate Checklist

### Hardening Phase
- [x] All tests passing (17/17 in test_nb_orchestrator.py)
- [x] Fan-out path tested (Cycle 1 test 3)
- [x] Empty-string default tested (Cycle 1 test 2)
- [x] No tautology tests — every assertion can fail

### Gatekeeper Phase
- [x] Gate 1: `gitleaks` — not installed in CI env; no secrets in new code
- [x] Gate 2: `bandit` — 3 Medium/Low pre-existing S608 in `run_lookup`; no new findings
- [x] Gate 3: `ruff` — 21 pre-existing issues (B018/E402/E501/S608); no new violations; TD raised
- [x] Gate 4: `mypy` — 5 pre-existing Fabric runtime globals (notebookutils/spark); no new errors
- [x] Gate 5: 84% coverage ≥ 80% ✅
- [x] Gate 6: AST — OK nb_orchestrator.py
- [x] Gate 7: WorkspaceGuid set only in `_base_args` (line 41); pop guards both paths ✅
- [x] Sniff test: PASS — `_base_args` single-responsibility confirmed
- [x] Roast: `build_dag` — COMPLETE. 1 Critical (SQL injection via control_lh in fan-out), 3 High, 6 Medium found and fixed/raised as TD-044/TD-046
- [ ] Manual: ADO variable group must have `DEV_WORKSPACE_GUID` — action for platform team (UAT/Prod out of scope)

---

## Iteration Log

- **2026-05-02**: Task card created via `/build-sprint GAP-02`. Pre-mortem identified dual
  `base_args` construction paths as primary risk. `_base_args` extraction chosen as mitigation.
  Schema confirmed: no ALTER TABLE required. Cycle 3 added (fan-out path test) beyond the
  sprint plan's original two cycles.

- **2026-05-02**: Sprint executed via `/run-sprint GAP-02`. All 3 cycles completed:
  17/17 tests pass, 84% coverage, AST clean, sniff test PASS. Pre-existing ruff/bandit/mypy
  issues noted as TD-001 (pre-existing). Post-cycle ADO wiring added to `azure-pipelines.yml`
  Bootstrap_Dev stage; ADR-031 updated with variable group requirements.
  Roast of `build_dag` pending (requires fresh context session).
  Emergent ADR check: no new architectural decisions — follows existing EnvironmentConfig
  parameter pattern.

- **Sprint close 2026-05-02**: All DoD items ✅ except manual ADO variable group (external action). Roast complete — 1 Critical + 3 High + 6 Medium found: SQL injection in fan-out via control_lh (fixed), reserved-key override via Parameters (fixed), fan-out exception swallowed (fixed). TDs raised: TD-039, TD-040, TD-041, TD-042, TD-044, TD-046. TDs closed: none. Carryover: none (ADO variable group is external team action, not code carryover).
