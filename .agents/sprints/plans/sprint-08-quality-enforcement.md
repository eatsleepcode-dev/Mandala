---
sprint: 9
title: "Quality enforcement — TableContracts via Pandera (GAP-09)"
gaps: [GAP-09]
effort: M
status: PLANNED
score_before: TBD
score_after_estimate: TBD
adr_required: [ADR-050]
branch: claude/new-session-Jgqbi
---

# Sprint 8 — Quality enforcement (Pandera contracts)

## Goals

| Gap | Deliverable | Done when |
|-----|-------------|-----------|
| GAP-09 | ADR-050 — DQ framework selection (Pandera vs GE vs PyDeequ) | File committed before first implementation commit |
| GAP-09 | `nb_data_quality_contracts.py` — `build_schema` + `validate_dataframe`; `_quarantine` write | Tests green; null/range/isin checks all tested |
| GAP-09 | `control.TableContracts` DDL confirmed in `nb_bootstrap.py` with `IsEnabled` column | DDL present; Live DEV Migration SQL applied |
| GAP-09 | `nb_bronze_to_silver._validate_with_contracts` integration | Called after each Silver write; skip when no contracts; quarantine best-effort |

---

## TD Pre-flight

**TD-064 (High)** — live Fabric SQL commissioning — **open, out of scope for Sprint 8**.
Pre-existing carryover from Sprint 6. Pandera contracts are pure Python; offline test coverage
via SQLite stub for control table reads. No dependency on live Fabric SQL commissioning.

No other High TDs are targeted at Sprint 8.

---

## ADR pre-flight

ADR-050 must be written and committed before any implementation commits in this sprint.

| ADR | Topic | Status |
|-----|-------|--------|
| ADR-050 | DQ framework selection (Pandera vs Great Expectations vs PyDeequ) | MISSING — write first |

---

## GAP-09 — TableContracts enforcement via Pandera

### Notebook delivery order

1. **ADR-050** — committed first
2. **Tidy Cycle** — `process_object` CC=23 in `nb_bronze_to_silver.py` → extract `_validate_with_contracts` stub
3. **Cycle 1** — `control.TableContracts` DDL confirmed with `IsEnabled` column
4. **Cycle 2** — Dynamic Pandera schema builder (not_null, range, isin, null CheckParam guard)
5. **Cycle 3** — `validate_dataframe` with quarantine write + graceful error handling
6. **Cycle 4** — `nb_bronze_to_silver._validate_with_contracts` integration

### Key design decisions (pre-empt ADR-050 authoring)

- **Pandera rationale**: pure Python, no JAR, no standalone server. `%pip install pandera` works
  in a standard Fabric session. Dynamic schema from `TableContracts` rows avoids static YAML
  config surface area. Offline pytest uses pandas-backed `pandera.DataFrameSchema` (not PySpark).
- **Great Expectations**: rejected — heavy runtime dependency, standalone expectation store,
  large YAML config surface area, no native Fabric integration.
- **PyDeequ**: rejected — requires JVM JAR on Spark classpath; Fabric Spark compatibility
  uncertain; no `%pip install` path.
- **Quarantine pattern**: failure_cases written to `{schema}_{table}_quarantine` table.
  Best-effort: try/except wraps the write; ControlLog records any quarantine write failure.
  Silver write is never rolled back (it already succeeded).
- **`IsEnabled` column**: contracts can be disabled per-row without deletion. Useful for
  temporary bypass during migrations.

### Pandera install strategy

```python
# %% [markdown]
# ## Setup
# %% 
%pip install pandera
# Fabric: restart kernel or run as child notebook via notebookutils.notebook.run()
```

For offline pytest: `pandera.DataFrameSchema` (pandas-backed). Avoids PySpark dependency in tests.
`pandera.pyspark.DataFrameSchema` used in Fabric sessions only; guarded by `importorskip` or
`os.environ` flag in tests.

### TDD summary

| Cycle | Test class | Test methods |
|-------|-----------|--------------|
| Tidy | — | structural only |
| 1 | `TestTableContractsDDL` | `test_table_contracts_has_is_enabled_column` |
| 2 | `TestSchemaBuilder` | `test_not_null_check_built_from_contract_row`, `test_range_check_built_from_contract_row`, `test_isin_check_built_from_contract_row`, `test_null_check_param_does_not_raise` |
| 3 | `TestValidateDataframe` | `test_failure_cases_written_to_quarantine`, `test_quarantine_write_failure_does_not_raise`, `test_clean_dataframe_writes_zero_quarantine_rows` |
| 4 | `TestContractValidationIntegration` | `test_validate_called_after_silver_write`, `test_validation_skip_when_no_contracts_exist` |

---

## Definition of Done

- [ ] `pytest tests/test_nb_data_quality_contracts.py -v` — all green
- [ ] `pytest tests/test_nb_bronze_to_silver.py -k "ContractValidationIntegration" -v` — all green
- [ ] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [ ] `gitleaks detect --verbose` — clean
- [ ] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [ ] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [ ] ADR-050 committed before first implementation commit
- [ ] `control.TableContracts` DDL in `nb_bootstrap.py` includes `IsEnabled` column
- [ ] `process_object` in `nb_bronze_to_silver.py` CC reduced by tidy cycle extraction
- [ ] `CheckParam=NULL` guard confirmed by test
- [ ] Quarantine-write failure graceful handling confirmed by test
- [ ] Sprint register updated
