---
gap_id: GAP-09
sprint: 9
status: COMPLETE
completed: 2026-05-05
adr_required: "ADR-050 — DQ framework selection (Pandera vs Great Expectations vs PyDeequ) — STATUS: Accepted"
---

# Task: GAP-09 — TableContracts enforcement via Pandera

**Status**: COMPLETE ✅
**Vibe Mode**: CREATION
**Branch**: `vnext`
**Sprint**: 9
**Effort**: M (2–3 days)
**Score impact**: TBD (new DQ enforcement pattern — not yet scored against framework)

---

## Context (The Elephants 🐘)

1. **`%pip install pandera[pyspark]` in Fabric session — `[pyspark]` extras require Java**:
   `pandera[pyspark]` requires `pyspark` as a dependency. In a standard Fabric session,
   `pyspark` is provided by the runtime but the extras install may pull in a conflicting
   standalone PySpark version. This can cause `ClassNotFoundException` at runtime.
   - *Strategy*: Install as `%pip install pandera` (base) and import `pandera.pyspark` only
     after the session has been established. Confirm in ADR-050 that `pandera[pyspark]` installs
     clean in Fabric F64 sessions (note as known risk if untested). For offline pytest, use
     `pandas`-backed Pandera (`pandera.DataFrameSchema`) to avoid PySpark dependency in tests.
   - *Status*: ✅ Done — `pandera` (base) installed; pandas-backed schema in tests; ADR-050 confirms safe

2. **`control.TableContracts` schema must exist before dynamic schema builder is called**:
   The `nb_data_quality_contracts.py` notebook reads `control.TableContracts` rows at runtime
   to build the Pandera schema. If the table is missing or its columns don't match what the
   builder expects (e.g. `CheckType`, `CheckParam`, `IsEnabled` columns), the builder raises
   an unhandled exception. The table DDL must be confirmed/added to `nb_bootstrap.py` before
   any notebook code.
   - *Strategy*: Confirm `control.TableContracts` DDL exists in `nb_bootstrap.py` and has the
     expected columns. If `IsEnabled` column is missing, write a Live DEV Migration SQL
     `ALTER TABLE` before writing the builder. Test: parse `nb_bootstrap.py` source for
     `TableContracts` DDL presence.
   - *Status*: ✅ Done — DDL confirmed in `nb_bootstrap.py` lines 446–456 with `IsEnabled BOOLEAN NOT NULL DEFAULT true`

3. **`process_object` in `nb_bronze_to_silver.py` CC=23 — tidy required before adding
   contract validation call**: `process_object` has CC=23 (grade D), which is the highest
   CC in the codebase. Adding a validation step inside it without first extracting a helper
   will make the function unmaintainable. Economics filter applies: this function will
   definitely change in this sprint, tidy reduces risk, not near deadline.
   - *Strategy*: Tidy cycle before RED — extract `_validate_with_contracts(spark, df,
     schema_name, table_name, control_lh)` as a no-op stub inside `process_object` after
     the Silver write. This is a structural move only (no behaviour change). The RED cycle
     then tests the stub's implementation.
   - *Status*: ✅ Done — `_validate_with_contracts` extracted at lines 467–482; CC=23 reduced

4. **Quarantine write must not break the Silver write on validation failure**: If Pandera
   validation produces failure cases, they must be written to `{schema}_{table}_quarantine`
   (following the existing quarantine pattern) and the pipeline must continue — not raise.
   The Silver write has already succeeded at this point; quarantine is best-effort. A
   failed quarantine write (e.g. storage permission error) must be logged to `ControlLog`
   but not propagate to the caller.
   - *Strategy*: Wrap quarantine write in `try/except`; emit `ControlLog` row on exception.
     Test: mock storage write failure; assert Silver write is not rolled back; assert
     `ControlLog` is written with `EventType='QuarantineWriteError'`.
   - *Status*: ✅ Done — quarantine write in `try/except`; non-fatal; `ControlLog` written on error

5. **Dynamic Pandera schema builder must handle `null` `CheckParam` gracefully**: Some
   `TableContracts` rows may have `CheckParam=NULL` (e.g. a `not_null` check requires no
   parameter, while a `range` check requires `min,max`). If the builder calls
   `check_param.split(",")` on `NULL`, it raises `AttributeError`. Guard must cover both
   `NULL` and empty-string `CheckParam`.
   - *Strategy*: `_parse_check_param(row)` helper normalises `NULL` and `""` to `None`;
     check builder dispatches on `CheckType` with appropriate None-safe handling.
     Test: `TableContracts` row with `CheckType='not_null'` and `CheckParam=NULL` → builder
     produces valid `Check.not_null()` without error.
   - *Status*: ✅ Done — `_parse_check_param(row)` handles `NULL` and `""` → `None`

---

## Pre-existing Tech Debt

TD-064 (High) — live Fabric SQL commissioning — **out of scope for Sprint 9**. Pre-existing
carryover from Sprint 6. Does not block Pandera contracts (pure Python, no Fabric SQL dependency
in tests via SQLite stub).

No Medium/Low TDs targeted at Sprint 9.

---

## ADR Required

**ADR-050 — DQ framework selection (Pandera vs Great Expectations vs PyDeequ)** — STATUS: MISSING

### ADR Cycle — Write ADR-050 before implementation

- [x] Write `docs/adr/ADR-050-dq-framework-pandera-vs-ge-vs-pydeequ.md`
- [x] Add to `docs/adr/README.md` catalog
- [x] COMMIT: `docs(adr): ADR-050 — DQ framework selection (Pandera vs Great Expectations vs PyDeequ)` — committed `c3021df`

ADR must address: why Pandera (pure Python, no JAR, dynamic schema from control table rows);
Great Expectations (heavy runtime, standalone store, config YAML surface area);
PyDeequ (JVM dependency, Fabric Spark compatibility risk); quarantine pattern integration;
offline pytest compatibility strategy (pandas-backed schema for tests).

---

## Live DEV Migration SQL

```sql
-- Confirm control.TableContracts DDL in nb_bootstrap.py before applying.
-- Expected columns: SchemaName, TableName, ColumnName, CheckType, CheckParam, IsEnabled, CreatedDate
-- If IsEnabled column is missing:
ALTER TABLE control.TableContracts
ADD COLUMN IF NOT EXISTS IsEnabled BOOLEAN NOT NULL DEFAULT true
    COMMENT 'When false, contract row is skipped by nb_data_quality_contracts';

-- If TableContracts does not exist at all (create):
CREATE TABLE IF NOT EXISTS control.TableContracts (
    SchemaName   STRING  NOT NULL,
    TableName    STRING  NOT NULL,
    ColumnName   STRING  NOT NULL,
    CheckType    STRING  NOT NULL,  -- 'not_null' | 'range' | 'isin' | 'regex'
    CheckParam   STRING,            -- NULL for not_null; 'min,max' for range; 'a,b,c' for isin
    IsEnabled    BOOLEAN NOT NULL DEFAULT true,
    CreatedDate  TIMESTAMP NOT NULL DEFAULT current_timestamp()
) USING DELTA;
```

---

## Execution Plan (Ralph's Ledger)

### ADR Cycle — Write ADR-050 before implementation

- [ ] Write `docs/adr/ADR-050-dq-framework-pandera-vs-ge-vs-pydeequ.md`
- [ ] Add to `docs/adr/README.md` catalog
- [ ] COMMIT: `docs(adr): ADR-050 — DQ framework selection (Pandera vs Great Expectations vs PyDeequ)`

---

### Tidy Cycle — `process_object` in `nb_bronze_to_silver.py` (CC=23, structural only — no behaviour change)

- [ ] Run `/tidy-first src/notebooks/nb_bronze_to_silver.py`
- [ ] Extract `_validate_with_contracts(spark, df, schema_name, table_name, control_lh)` as a no-op stub inside `process_object` after the Silver write
- [ ] COMMIT: `tidy(nb_bronze_to_silver): extract _validate_with_contracts stub`

---

### Cycle 1 — `control.TableContracts` DDL confirmed in `nb_bootstrap.py`

- [ ] 🔴 RED: `tests/test_nb_bootstrap.py::TestTableContractsDDL::test_table_contracts_has_is_enabled_column` — reads `nb_bootstrap.py` source; asserts `TableContracts` and `IsEnabled` column present in DDL
- [ ] 🟢 GREEN: add/update `control.TableContracts` DDL in `nb_bootstrap.py`; apply Migration SQL above in DEV
- [ ] 🔵 REFACTOR: confirm column order matches the Live DEV Migration SQL
- [ ] COMMIT: `feat(nb_bootstrap): confirm TableContracts DDL with IsEnabled column [RED/GREEN/REFACTOR]`

---

### Cycle 2 — Dynamic Pandera schema builder handles all check types and null params

- [ ] 🔴 RED: `tests/test_nb_data_quality_contracts.py::TestSchemaBuilder::test_not_null_check_built_from_contract_row` — `TableContracts` row with `CheckType='not_null'`, `CheckParam=None`; asserts `pandera.Check.not_null()` in schema
- [ ] 🔴 RED: `tests/test_nb_data_quality_contracts.py::TestSchemaBuilder::test_range_check_built_from_contract_row` — `CheckType='range'`, `CheckParam='0,100'`; asserts `pandera.Check.in_range(0, 100)` in schema
- [ ] 🔴 RED: `tests/test_nb_data_quality_contracts.py::TestSchemaBuilder::test_isin_check_built_from_contract_row` — `CheckType='isin'`, `CheckParam='A,B,C'`; asserts `pandera.Check.isin(['A','B','C'])` in schema
- [ ] 🔴 RED: `tests/test_nb_data_quality_contracts.py::TestSchemaBuilder::test_null_check_param_does_not_raise` — `CheckType='not_null'`, `CheckParam=None`; asserts no `AttributeError` raised
- [ ] 🟢 GREEN: implement `build_schema(contract_rows)` and `_parse_check_param(row)` in `src/notebooks/nb_data_quality_contracts.py`; add `%pip install pandera` as first cell
- [ ] 🔵 REFACTOR: extract `_build_column_check(check_type, param)` dispatcher
- [ ] COMMIT: `feat(nb_data_quality_contracts): dynamic schema builder for all check types [RED/GREEN/REFACTOR]`

---

### Cycle 3 — `validate_dataframe` writes failure cases to quarantine table

- [ ] 🔴 RED: `tests/test_nb_data_quality_contracts.py::TestValidateDataframe::test_failure_cases_written_to_quarantine` — 5-row pandas DataFrame with 2 null violations; asserts quarantine write called with 2-row failure_cases shape
- [ ] 🔴 RED: `tests/test_nb_data_quality_contracts.py::TestValidateDataframe::test_quarantine_write_failure_does_not_raise` — mock storage write raises; asserts `ControlLog` written with `EventType='QuarantineWriteError'`; asserts no exception propagated
- [ ] 🔴 RED: `tests/test_nb_data_quality_contracts.py::TestValidateDataframe::test_clean_dataframe_writes_zero_quarantine_rows` — all rows pass; asserts quarantine write NOT called
- [ ] 🟢 GREEN: implement `validate_dataframe(spark, df, schema_name, table_name, control_lh)` in `nb_data_quality_contracts.py`
- [ ] 🔵 REFACTOR: extract `_write_quarantine(spark, failure_cases, schema_name, table_name, control_lh)` with try/except + ControlLog fallback
- [ ] COMMIT: `feat(nb_data_quality_contracts): validate_dataframe with quarantine write [RED/GREEN/REFACTOR]`

---

### Cycle 4 — `nb_bronze_to_silver` calls `_validate_with_contracts` after each Silver write

- [ ] 🔴 RED: `tests/test_nb_bronze_to_silver.py::TestContractValidationIntegration::test_validate_called_after_silver_write` — mocks `nb_data_quality_contracts.validate_dataframe`; asserts called once after Silver write with correct `schema_name` + `table_name`
- [ ] 🔴 RED: `tests/test_nb_bronze_to_silver.py::TestContractValidationIntegration::test_validation_skip_when_no_contracts_exist` — empty `TableContracts` for this table; asserts `validate_dataframe` NOT called (guard against empty schema)
- [ ] 🟢 GREEN: implement `_validate_with_contracts` in `nb_bronze_to_silver.py` (replace stub from Tidy Cycle); call via `notebookutils.notebook.run("nb_data_quality_contracts", ...)`
- [ ] 🔵 REFACTOR: wrap call in try/except — validation failure must not block Silver write (it already succeeded)
- [ ] COMMIT: `feat(nb_bronze_to_silver): call _validate_with_contracts after Silver write [RED/GREEN/REFACTOR]`

---

## Gate Checklist

### Hardening Phase
- [x] All new tests passing — 31 GAP-09 tests green (22 contract builder + 3 bronze_to_silver integration + others)
- [x] `CheckParam=NULL` guard tested (Cycle 2 test 4)
- [x] Quarantine-write failure tested (Cycle 3 test 2)
- [x] Empty-contracts skip tested (Cycle 4 test 2)
- [x] No tautology tests — every assertion can fail

### Gatekeeper Phase
- [x] Gate 1: `gitleaks detect --verbose` — clean
- [x] Gate 2: `bandit -r src/ -ll -f text` — no new Medium/High findings
- [x] Gate 3: `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [x] Gate 4: `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [x] Gate 5: full suite 995 passing, 8 pre-existing failures only; cov ≥80%
- [x] ADR-050 committed before first implementation commit

---

## Iteration Log

- **2026-05-05**: Sprint close via `/sprint-close sprint-9`. All DoD items ✅. Full suite 995 passing, 8 pre-existing failures (unchanged). Carryover: none. TDs raised: none. TDs closed: none. Score: 381 → 381 (beyond original 390-point framework).
- **2026-05-03**: Task card created via `/build-sprint GAP-09`. Pre-mortem identified 5 elephants:
  `pandera[pyspark]` JVM extras risk, `TableContracts` DDL prerequisite, `process_object` CC=23
  (highest in codebase) tidy required, quarantine best-effort pattern, `NULL` CheckParam guard.
  Radon confirms CC=23 for `process_object` in `nb_bronze_to_silver.py` — tidy cycle is mandatory
  before any RED cycle. ADR-050 required (DQ framework selection decision).
  Migration SQL: confirm/add `control.TableContracts` with `IsEnabled` column.
