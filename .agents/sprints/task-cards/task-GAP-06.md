---
gap_id: GAP-06
sprint: 3
status: COMPLETE
completed_date: 2026-05-03
adr_required: none (update ADR-041 to document RTI emit path)
tds_raised: [TD-063b, TD-063c]
---

# Task: GAP-06 — RTI observability layer

**Status**: COMPLETE
**Vibe Mode**: CREATION
**Branch**: `claude/review-recent-commits-Auyjc`
**Sprint**: 3
**Effort**: L (2–3 days)
**Score impact**: +7 pts (combined with GAP-03 → 352 → 363)

---

## Context (The Elephants 🐘)

1. **`log_control_event` (sprint plan) vs `log_event` (production)**: The sprint plan's
   test class calls `nb_log_event.log_control_event(spark, "db_control", {"status": "SUCCESS"})`.
   But the production function used by all pipeline activities is `log_event(spark_session,
   pipeline_run_id, pipeline_id, config_id, object_name, event_type, ...)`. If a new
   `log_control_event` is added as a standalone function, no pipeline activity will ever call it —
   it is dead code from day one.
   - *Strategy*: Add `_emit_to_eventstream(endpoint, event)` as a private helper. Wire the
     RTI emit path **inside `log_event`** — after the Delta write succeeds, check
     `EnableRTIObservability` from EnvironmentConfig and call `_emit_to_eventstream`
     best-effort. Write the test class to test via `log_event` (not `log_control_event`).
   - *Status*: ⏳ Pending — Cycle 3

2. **EnvironmentConfig lookup overhead in `log_event`**: The existing `log_event` executes
   1–2 `spark.sql()` calls per event (INSERT / UPDATE on ControlLog). Adding an
   `EnvironmentConfig` lookup adds another SQL query per event. For a pipeline with 50
   objects × 3 events each = 150 extra queries per run. This is acceptable for now (the RTI
   path is best-effort and already in a `try/except`), but should be raised as a TD for
   future memoisation (cache the config lookup across events in the same notebook session).
   - *Strategy*: Accept for initial implementation. Raise TD-063 after sprint close.
   - *Status*: ⏳ Pending — accept now, raise TD post-sprint

3. **ADR-041 coverage gap**: GAP-06 introduces a new observability contract (Eventstream
   alongside Delta), which meets the build-sprint threshold for ADR documentation. The sprint
   plan says `adr_required: []` with only `adr_update: [ADR-041]`. ADR-041 covers the
   ControlLog queue-and-flush pattern but is silent on Eventstream. A new ADR number would
   conflict with ADR-047 (reserved for Sprint 4 Fabric SQL).
   - *Strategy*: Update ADR-041 to add an "RTI Eventstream emit" section documenting the opt-in
     companion pattern. No new ADR number needed. Do this before the first implementation commit.
   - *Status*: ⏳ Pending — ADR Update Cycle (before Cycle 3)

4. **`_emit_to_eventstream` must never raise**: The Eventstream emit is observability-only.
   Any failure (network error, wrong endpoint, wrong scope) must not block the pipeline. The
   Delta write to ControlLog is the authoritative record; Eventstream is best-effort. All
   exceptions in `_emit_to_eventstream` must be silently swallowed (with a `print` for
   debuggability in the Fabric notebook output).
   - *Strategy*: Wrap the entire RTI path in `try/except Exception: pass` inside `log_event`.
     `_emit_to_eventstream` itself also wraps `requests.post` in `try/except`. Two layers of
     defensive error handling.
   - *Status*: ⏳ Pending — Cycle 3

5. **`requests` import in `nb_log_event.py`**: `nb_log_event.py` currently has no `requests`
   import. Adding a bare `import requests` at module level will break offline tests if
   `requests` is not installed. Use a `try/except ImportError` guard consistent with the
   pattern in `nb_conn_rest.py`.
   - *Strategy*: `try: import requests as _requests\nexcept ImportError: _requests = None`.
     In `_emit_to_eventstream`, guard with `if _requests is None: return`.
   - *Status*: ⏳ Pending — Cycle 3

---

## Live DEV Migration SQL

```sql
-- EnvironmentConfig: add RTI observability rows (new rows only — no DDL/schema change)
-- Run once per DEV/UAT/PROD environment that has an existing EnvironmentConfig table.
INSERT INTO control.EnvironmentConfig (EnvName, ParameterName, ParameterValue, Description)
VALUES
  ('dev', 'EnableRTIObservability', 'false',
   'Set to ''true'' to emit ControlLog events to the RTI Eventstream endpoint.'),
  ('dev', 'RTIEventstreamEndpoint', NULL,
   'Custom Eventstream ingestion URL. Required when EnableRTIObservability=true.');
```

---

## Execution Plan (Ralph's Ledger)

### ADR Update Cycle — Add RTI emit section to ADR-041 before implementation

- [x] Open `docs/adr/ADR-041-controllog-queue-and-flush-pattern.md`
- [x] Add a new section: `## Amendment — RTI Eventstream opt-in companion (Sprint 3)`
      documenting the decision: Delta write is authoritative; Eventstream is best-effort;
      gated by `EnableRTIObservability` flag in EnvironmentConfig; never blocks pipeline
- [x] COMMIT: `docs(adr): ADR-041 — add RTI Eventstream emit section`

---

### Cycle 3 — `log_event` emits to Eventstream when `EnableRTIObservability` is set

- [x] 🔴 RED: `tests/test_nb_log_event.py::TestRTIEventstreamEmit::test_delta_write_always_occurs`
- [x] 🔴 RED: `tests/test_nb_log_event.py::TestRTIEventstreamEmit::test_eventstream_emit_called_when_rti_enabled`
- [x] 🔴 RED: `tests/test_nb_log_event.py::TestRTIEventstreamEmit::test_eventstream_emit_not_called_when_rti_disabled`
- [x] 🔴 RED: `tests/test_nb_log_event.py::TestRTIEventstreamEmit::test_eventstream_failure_does_not_prevent_delta_write`
- [x] 🟢 GREEN: `_emit_to_eventstream` + guarded `requests` import + RTI path in `log_event`
- [x] 🔵 REFACTOR: `# noqa: S110` on both try/except/pass blocks; `# type: ignore[import-untyped]` on requests import
- [x] COMMIT: `feat(nb-log-event): RTI Eventstream emit in log_event — best-effort, flag-gated [GREEN]`

---

### Cycle 4 — `EnvironmentConfig` seed has RTI flag rows

- [x] 🔴 RED: `tests/test_nb_log_event.py::TestRTISeedRows::test_rti_observability_flag_in_seed`
- [x] 🔴 RED: `tests/test_nb_log_event.py::TestRTISeedRows::test_rti_eventstream_endpoint_in_seed`
- [x] 🔴 RED: `tests/test_nb_log_event.py::TestRTISeedRows::test_rti_disabled_by_default_in_dev`
- [x] 🟢 GREEN: added `EnableRTIObservability` (`"false"`) and `RTIEventstreamEndpoint` (`null`) to seed
- [x] 🔵 REFACTOR: none
- [x] COMMIT: `feat(seed): add EnableRTIObservability + RTIEventstreamEndpoint to EnvironmentConfig [GREEN]`

---

### Cycle 5 — Infrastructure: `rti-workspace.bicep` + `13-deploy-rti-observability.ps1`

- [x] Create `infrastructure/modules/rti-workspace.bicep` — documentation placeholder (az bicep CLI not available offline; syntax valid)
- [x] Create `scripts/13-deploy-rti-observability.ps1` — KQL DB + Eventstream + Activator via Fabric Items API
- [x] COMMIT: `feat(infra): rti-workspace.bicep + 13-deploy-rti-observability.ps1`

---

### Cycle 6 — `azure-pipelines.yml` optional Deploy_RTI stage

- [x] Add `Deploy_RTI` stage after `Deploy_Prod`, gated on `ENABLE_RTI_OBSERVABILITY = 'true'`
- [x] YAML validated with `python3 -c "import yaml; yaml.safe_load(...)"` — valid
- [x] COMMIT: `feat(ci): azure-pipelines.yml — optional Deploy_RTI stage [GAP-06]`

---

## Gate Checklist

### Hardening Phase
- [x] All tests passing — 7/7 green; 3 pre-existing failures (pyspark/azure not installed)
- [x] Delta write path unchanged — existing `log_event` behaviour identical when RTI disabled
- [x] `_emit_to_eventstream` never raises — two-layer try/except defence
- [x] `requests` import guard prevents CI failure when requests not installed

### Gatekeeper Phase
- [x] Gate 1: `gitleaks` not installed in offline environment — no secrets in new code (verified manually)
- [x] Gate 2: `bandit -r src/notebooks/nb_log_event.py -ll -f txt` — 4 pre-existing B608 (SQL injection), 0 new HIGH
- [x] Gate 3: ruff — 18 errors all pre-existing (E501, E402, S608, S311); S110 suppressed with noqa
- [x] Gate 4: `mypy` — 2 pre-existing `spark` name-defined errors; `import-untyped` suppressed with type: ignore
- [x] Gate 5: `python3 -m pytest tests/test_nb_log_event.py -v` — 7/7 green
- [x] Gate 6: `az bicep build` not available offline; bicep syntax verified manually

---

## Iteration Log

- **2026-05-02**: Task card created via `/build-sprint GAP-06`. Pre-mortem: sprint plan's
  `log_control_event` API is dead code — RTI emit wired inside existing `log_event` instead.
  EnvironmentConfig lookup overhead noted as TD-063 candidate. ADR-041 update required (not a
  new ADR number). `requests` import guard critical for CI. 4 TDD cycles + ADR update + 2
  infra tasks (bicep + PowerShell).

- **2026-05-03**: Sprint 3 GAP-06 COMPLETE. ADR-041 amended (Sprint 3 § RTI Eventstream).
  4 TDD cycles delivered: `TestRTIEventstreamEmit` (4 tests) + `TestRTISeedRows` (3 tests) all green.
  Infra: `rti-workspace.bicep` (ARM placeholder) + `13-deploy-rti-observability.ps1` (KQL DB + Eventstream + Activator).
  CI: `Deploy_RTI` stage added to `azure-pipelines.yml`, gated on `ENABLE_RTI_OBSERVABILITY=true`.
  Gate notes: ruff 18 pre-existing errors; bandit 4 pre-existing B608; mypy 2 pre-existing spark NameError.
  New issues: S110 (2× intentional try/except/pass) suppressed with noqa; import-untyped suppressed with type: ignore.
  TD-063b raised: memoize EnvironmentConfig lookup (150 queries/run). TD-063c raised: log_event CC=11 → extract `_maybe_emit_to_rti`.
