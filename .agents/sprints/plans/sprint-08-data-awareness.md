---
sprint: 8
title: "Data awareness — Bronze profiling (GAP-07) + PII auto-discovery (GAP-08)"
gaps: [GAP-07, GAP-08]
effort: M + M
status: COMPLETE
score_before: 381
score_after: 381
started: 2026-05-03
completed: 2026-05-04
adr_required: [ADR-048, ADR-049]
branch: claude/new-session-Jgqbi
pre_existing_open_high_td: "TD-064 — live Fabric SQL commissioning (requires live workspace) — out of scope for this sprint programme"
---

# Sprint 8 — Data awareness (Bronze profiling + PII auto-discovery)

## Goals

| Gap | Deliverable | Done when |
|-----|-------------|-----------|
| GAP-07 | `nb_bronze_profiling.py` — `log_profile` + `drift_check`; `ColumnStats` gains `DistributionHistogram` column | Tests green; seed row `BronzeProfilingDriftThreshold` exists; `nb_landing_to_bronze` calls profiler |
| GAP-07 | ADR-048 — Bronze profiling observability contract (whylogs) | File committed before first implementation commit |
| GAP-08 | `nb_pii_scanner.py` — `PATTERN_REGISTRY` + `scan_dataframe`; `profiling.PiiCandidates` DDL | Tests green; email/phone/NI/DOB/postcode patterns all tested |
| GAP-08 | `nb_catalog_sync.py` — `_apply_pii_auto_flag` integration | High-confidence PII auto-flags `RequiresMasking=True`; `ReviewedBy='auto'` |
| GAP-08 | ADR-049 — PII auto-discovery strategy (regex heuristics vs Purview classifiers) | File committed before first implementation commit |

---

## TD Pre-flight

**TD-064 (High)** — live Fabric SQL commissioning (requires live Fabric workspace) — **open, out of
scope for Sprint 8**. This TD is a carryover from Sprint 6 and requires a live Fabric workspace.
Sprint 8 features (profiling, PII) are new Python notebooks with no dependency on the live Fabric
SQL commissioning path. The SQLite stub fully covers offline test coverage for control table reads.

No other High TDs are targeted at Sprint 8.

---

## ADR pre-flight

Both ADRs must be written and committed before any implementation commits in this sprint.

| ADR | Topic | Status |
|-----|-------|--------|
| ADR-048 | Bronze profiling observability contract (whylogs) | MISSING — write first |
| ADR-049 | PII auto-discovery strategy (regex heuristics vs Purview classifiers) | MISSING — write first |

---

## GAP-07 — Bronze profiling via whylogs

### Notebook delivery order

1. **ADR-048** — committed first
2. **Tidy Cycle** — `run_landing_to_bronze` CC=20 → extract `_call_bronze_profiling` stub
3. **Cycle 1** — `ColumnStats` DDL update (`DistributionHistogram` column)
4. **Cycle 2** — `nb_bronze_profiling.log_profile` upserts whylogs stats
5. **Cycle 3** — `nb_bronze_profiling.drift_check` with threshold + first-run guard
6. **Cycle 4** — `BronzeProfilingDriftThreshold` seed row
7. **Cycle 5** — `nb_landing_to_bronze._call_bronze_profiling` integration

### Key design decisions (pre-empt ADR-048 authoring)

- **Install strategy**: `%pip install whylogs` as first cell of `nb_bronze_profiling.py`. The
  notebook runs as a child session via `notebookutils.notebook.run()` — not imported as a
  module in the parent. This isolates the package install from the parent session.
- **Drift alert routing**: `drift_check` writes to `control.ControlLog` with
  `EventType='BronzeDriftAlert'`. RTI Eventstream picks up the ControlLog write via the
  existing `_emit_to_eventstream` path (GAP-06). No direct Eventstream call needed.
- **First-run guard**: `drift_check` returns `None` (no alert) when no previous profile row
  exists for `ObjectName + ColumnName`. Explicitly tested.

### TDD summary

| Cycle | Test class | Test methods |
|-------|-----------|--------------|
| Tidy | — | structural only |
| 1 | `TestColumnStatsDDL` | `test_column_stats_has_distribution_histogram` |
| 2 | `TestLogProfile` | `test_upsert_shape_matches_column_stats_schema`, `test_log_profile_writes_one_row_per_column` |
| 3 | `TestDriftCheck` | `test_no_alert_on_first_run`, `test_alert_emitted_when_mean_drift_exceeds_threshold`, `test_no_alert_when_drift_within_threshold` |
| 4 | `TestSeedIntegrity` | `test_seed_dev_has_drift_threshold_row` |
| 5 | `TestBronzeProfilingIntegration` | `test_bronze_profiling_called_after_write`, `test_profiling_not_called_when_zero_rows_written` |

---

## GAP-08 — PII auto-discovery

### Notebook delivery order

1. **ADR-049** — committed first
2. **Tidy Cycle** — `infer_natural_key` CC=15 in `nb_catalog_sync.py` → extract `_apply_pii_auto_flag` stub
3. **Cycle 1** — `profiling.PiiCandidates` DDL in `nb_bootstrap.py`
4. **Cycle 2** — PII regex pattern registry with confidence scoring
5. **Cycle 3** — `scan_dataframe` writes candidates to `profiling.PiiCandidates`
6. **Cycle 4** — `PiiScanConfidenceThreshold` seed row
7. **Cycle 5** — `nb_catalog_sync._apply_pii_auto_flag` integration

### Key design decisions (pre-empt ADR-049 authoring)

- **Regex-first**: heuristic scan is the discovery layer; Purview sensitivity labels are the
  governance confirmation layer (P8, deferred). The two layers are complementary, not competing.
- **Confidence scoring**: base match rate + context hint boost from column name. NI/postcode
  patterns require column-name hint to reach auto-confirm threshold (0.9). Avoids false positives.
- **Audit trail**: `ReviewedBy='auto'` for programmatic auto-confirm; `Confirmed=True`. Human
  reviewers set their own identity. `NULL` = unreviewed.

### TDD summary

| Cycle | Test class | Test methods |
|-------|-----------|--------------|
| Tidy | — | structural only |
| 1 | `TestPiiCandidatesDDL` | `test_pii_candidates_table_in_bootstrap_source` |
| 2 | `TestPiiPatterns` | `test_email_pattern_detected`, `test_phone_pattern_detected`, `test_ni_number_detected_with_column_hint`, `test_low_confidence_not_auto_confirmed` |
| 3 | `TestScanDataframe` | `test_scan_writes_candidates_for_detected_columns`, `test_scan_skips_columns_below_minimum_confidence` |
| 4 | `TestSeedIntegrity` | `test_seed_has_pii_confidence_threshold` |
| 5 | `TestPiiAutoFlag` | `test_high_confidence_sets_requires_masking`, `test_auto_confirmed_reviewer_is_auto`, `test_low_confidence_not_auto_flagged` |

---

## Definition of Done

- [x] `pytest tests/test_nb_bronze_profiling.py -v` — all green
- [x] `pytest tests/test_nb_pii_scanner.py -v` — all green
- [x] `pytest tests/test_nb_catalog_sync.py -k "PiiAutoFlag" -v` — all green
- [x] `pytest tests/test_nb_landing_to_bronze.py -k "BronzeProfilingIntegration" -v` — all green
- [x] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [x] `gitleaks detect --verbose` — clean
- [x] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [x] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [x] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [x] ADR-048 committed before first GAP-07 implementation commit
- [x] ADR-049 committed before first GAP-08 implementation commit
- [x] `profiling.ColumnStats` has `DistributionHistogram` column in `nb_bootstrap.py` DDL
- [x] `profiling.PiiCandidates` DDL in `nb_bootstrap.py`
- [x] `BronzeProfilingDriftThreshold` row in `config/seed-dev.json`
- [x] `PiiScanConfidenceThreshold` row in `config/seed-dev.json`
- [x] Sprint register updated
