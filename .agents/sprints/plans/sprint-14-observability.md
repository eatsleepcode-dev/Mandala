---
sprint: 14
title: "Observability — structured logging fields (Layer 1) + Hub plugin ControlLog backends (Layer 2)"
feature_plan_phase: 3
effort: M + M
status: complete
completed_date: 2026-05-06
score_actual: 8
carryover: []
tds_raised: []
tds_closed: []
adr_required: []
branch: vnext
pre_existing_closed_tds: "TD-036 (V-Order + CDF on Silver) ✅"
layer_split: "Layer 1 = structured logging DDL/nb_log_event; Layer 2 = Hub plugin ControlLog backends"
---

# Sprint 14 — Observability (FEATURE_PLAN Phase 3)

## Goals

Engineers can answer "what happened in last night's run?" in under 60 seconds without writing SQL.

**Architecture note (updated):** The platform has three layers. Display/dashboard work belongs in
Layer 2 (Hub plugins), not Layer 1 (notebooks). This sprint delivers:

- **Layer 1** — structured logging fields in `ControlLog` + `log_event` extension + connector
  integration (data side, prerequisite for Layer 2)
- **Layer 2** — `PipelineMonitorPlugin`, `DqRulesPlugin`, and `LogViewerPlugin` enhanced to use
  `ControlLog` as their backend instead of Fabric REST-only or Spark driver logs only

`nb_platform_health.py` and `nb_data_quality_scorecard.py` are **not** in scope — their
equivalent functionality is delivered in the Hub plugins.

| Item | Deliverable | Done when |
|---|---|---|
| P4-D | Structured logging fields in `nb_log_event.py` + `nb_bootstrap.py` | `DurationSeconds`, `SourceRowCount`, `SinkRowCount` in `ControlLog`; `nb_landing_to_bronze` logs events |
| P4-A | `PipelineMonitorPlugin` — ControlLog backend | Recent run stats (duration, row counts, error flag) render from `ControlLog`; WI token path wired |
| P4-B | `DqRulesPlugin` — historical scorecard tab | `EventType='DQCheck'` events from `ControlLog` render pass-rate trend; tab coexists with live rule runner |
| P4-C | `LogViewerPlugin` — ControlLog error tab | Structured `EventType='Error'` log from `ControlLog` shown alongside Spark driver log |

---

## Pre-flight notes

**TD-036** (V-Order + CDF on Silver) — already closed ✅. No action needed.

**RTI observability** — already delivered in Sprint 3 (GAP-06). `nb_log_event._emit_to_eventstream`
exists. Hub plugins read from `ControlLog` (Delta), not Eventstream.

**Hub plugin testing** — Hub plugins live in `Modules/Hub_Plugins/`. Tests go in
`tests/test_hub_plugins_observability.py`. Spark dependencies are mocked; ControlLog reads use
the existing SQLite stub from `conftest.py`.

**PipelineMonitorPlugin current state** — calls Fabric REST `/runs` endpoint; falls back to demo
data with `⚠️ Showing demo data (no API token available)`. WI token path not yet wired. Sprint 14
adds ControlLog as a richer data source, making the demo fallback unnecessary.

**DqRulesPlugin current state** — runs DQ rules on-demand; renders a live scorecard for a single
run. No historical trend. Sprint 14 adds a History tab pulling `EventType='DQCheck'` rows.

**LogViewerPlugin current state** — tails Spark driver log4j output and query plans. No link to
structured `ControlLog` error events. Sprint 14 adds a ControlLog Error Log tab.

---

## Delivery order

### Layer 1 — Structured logging (do first — Hub plugins depend on these fields)

1. **Cycle 1** — `DurationSeconds BIGINT`, `SourceRowCount BIGINT`, `SinkRowCount BIGINT`
   migration guards in `nb_bootstrap.py`; Fabric SQL `ALTER TABLE` in
   `config/control-schema/fabric-sql/05-add-logging-fields.sql`
2. **Cycle 2** — `log_event` signature extended: `source_row_count=None`, `sink_row_count=None`,
   `duration_seconds=None` (all optional, backward-compatible)
3. **Cycle 3** — `nb_landing_to_bronze`: add `log_event` call with row counts after each object write

### Layer 2 — PipelineMonitorPlugin ControlLog backend

4. **Cycle 4** — `_fetch_from_control_log(days_back)` helper; reads `ControlLog` via SparkSession;
   returns DataFrame of recent `PipelineID + EventType + DurationSeconds + SourceRowCount + SinkRowCount`
5. **Cycle 5** — `bind_handlers` updated: tries ControlLog first, falls back to Fabric REST `/runs`;
   adds WI token path via `_get_wi_token()`; drops demo data fallback
6. **Cycle 6** — React panel update: add Duration and RowCount columns to run table;
   error-flagged rows shown in red

### Layer 2 — DqRulesPlugin historical scorecard tab

7. **Cycle 7** — `_fetch_dq_history(table_name, days_back)` helper; reads
   `EventType='DQCheck'` rows from ControlLog; returns pass-rate per day
8. **Cycle 8** — React panel: add History tab alongside existing Scorecard tab; sparkline chart
   (pure CSS, no external chart lib); tab state persists per plugin session

### Layer 2 — LogViewerPlugin ControlLog error tab

9. **Cycle 9** — `_fetch_control_log_errors(hours_back)` helper; reads `EventType='Error'` or
   `EventLevel='ERROR'` rows from ControlLog; returns list of dicts
10. **Cycle 10** — React panel: add ControlLog Errors tab; toggle between Spark log tab and
    ControlLog Errors tab; auto-refresh every 30 s when tab active

---

## TDD summary

| Cycle | Test class | Key test methods |
|---|---|---|
| 1 | `TestControlLogDDL` | `test_duration_seconds_column_in_bootstrap`, `test_source_sink_row_count_columns` |
| 2 | `TestLogEvent` | `test_log_event_accepts_row_count_params`, `test_row_counts_written_to_control_log` |
| 3 | `TestLandingToBronzeLogging` | `test_log_event_called_after_object_write`, `test_row_count_passed_to_log_event` |
| 4 | `TestPipelineMonitorControlLog` | `test_fetch_from_control_log_returns_dataframe`, `test_schema_includes_duration` |
| 5 | `TestPipelineMonitorBackend` | `test_control_log_preferred_over_rest`, `test_wi_token_used_when_available` |
| 6 | `TestPipelineMonitorPanel` | `test_duration_column_in_rendered_output`, `test_error_rows_flagged` |
| 7 | `TestDqRulesHistory` | `test_fetch_dq_history_filters_by_event_type`, `test_pass_rate_computed_per_day` |
| 8 | `TestDqRulesHistoryTab` | `test_history_tab_renders_sparkline_data`, `test_tab_toggle_state` |
| 9 | `TestLogViewerControlLog` | `test_fetch_errors_filters_event_level`, `test_returns_list_of_dicts` |
| 10 | `TestLogViewerErrorTab` | `test_error_tab_renders_control_log_rows`, `test_auto_refresh_interval_set` |

---

## Key design decisions

- **ControlLog-first, Fabric REST fallback** — ControlLog is richer (structured fields, row counts,
  duration) and available offline (SQLite stub). Fabric REST remains the fallback for Fabric pipeline
  run IDs not captured in ControlLog.
- **No matplotlib, no pandas chart libs** — sparklines are pure CSS `linear-gradient` bars on
  percentage widths. No new JS dependencies.
- **Hub plugin tests use SQLite stub** — same `conftest.py` fixture as notebook tests. Spark mock
  returns the stub DataFrame. No Fabric workspace needed in CI.
- **Backward-compatible logging** — `log_event` new params are all `Optional[int]` defaulting to
  `None`. Existing callers unchanged.

---

## Control table / DDL changes

| Table | Change | Migration guard |
|---|---|---|
| `control.ControlLog` | Add `DurationSeconds BIGINT`, `SourceRowCount BIGINT`, `SinkRowCount BIGINT` | `ALTER TABLE IF NOT EXISTS COLUMN` in nb_bootstrap |
| Fabric SQL | `05-add-logging-fields.sql` | `ALTER TABLE IF NOT EXISTS COLUMN` T-SQL |

---

## Definition of Done

- [x] `pytest tests/test_nb_log_event.py -k "RowCount or Duration" -v` — all green
- [x] `pytest tests/test_nb_landing_to_bronze.py -k "Logging" -v` — all green
- [x] `pytest tests/test_hub_plugins_observability.py -v` — all green
- [x] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [x] `gitleaks detect --verbose` — clean
- [x] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [x] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [x] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [x] `ControlLog` DDL migration guards in `nb_bootstrap.py`
- [x] `config/control-schema/fabric-sql/05-add-logging-fields.sql` committed
- [x] `PipelineMonitorPlugin` renders from ControlLog; demo data fallback removed
- [x] `DqRulesPlugin` History tab renders pass-rate trend from ControlLog
- [x] `LogViewerPlugin` ControlLog Errors tab renders structured error events
- [x] Sprint register updated
