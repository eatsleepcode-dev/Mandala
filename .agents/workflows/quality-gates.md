---
description: Run the 7-Gate Quality Model checks on a data-platform PR or schema change.
---

# 7-Gate Quality Check — data-platform

Run these gates before merging any change to `src/notebooks/` or `notebooks/`.

**⚠️ CRITICAL**: All MUST-Have gates are mandatory. Document results for each gate before proceeding.

---

## Pre-existing Failure Triage Protocol

When gate failures are found, follow this protocol **before touching any code**:

### Step 1 — Establish a baseline (before any edit)

```powershell
# Record the failure count on the current HEAD before your changeset
py -m pytest tests/ -q --tb=no 2>&1 | Select-Object -Last 3
```

Save this as "baseline failures". Any failures present here are **candidates** for pre-existing status.

### Step 2 — Verify a failure is truly pre-existing

A failure is pre-existing **only if all three are true**:

1. It appears in the baseline run (before your first edit on this branch)
2. It does NOT touch any file in your current changeset (`git diff --name-only HEAD`)
3. It can be reproduced on `main`/`vnext` without your changes (optional but conclusive)

**If a failure does NOT appear in the baseline — it is a regression you introduced. Fix it before committing.**

### Step 3 — Commit your changeset first

Commit your passing tests and new code **before** fixing pre-existing failures.
This keeps the fix history clean: your feature commit is self-contained.

```
feat(x): implement Y [RED/GREEN] [GAP-NN]   ← your work, pre-existing failures noted
fix(tests): fix pre-existing failures in TestFoo [DEBT]  ← separate commit
```

### Step 4 — Fix pre-existing failures in a separate commit

After your changeset is committed:

1. Isolate each pre-existing failure: `py -m pytest tests/test_foo.py::TestBar -v`
2. Confirm it fails on the current HEAD (before your fix)
3. Fix it
4. Run the **full suite** (not just the affected file) to catch any interactions:
   ```powershell
   py -m pytest tests/ -q --ignore=tests/test_nb_json_admin.py --ignore=tests/test_preflight_notebook_cell.py
   ```
5. Commit: `fix(tests): resolve pre-existing failures in TestFoo [DEBT]`

### Step 5 — Document if not fixing now

If a pre-existing failure is **out of scope** for this sprint:

- Add or update a Tech Debt entry: `/tech-debt raise`
- Note it explicitly in the gate checklist result: `⚠️ Pre-existing: TestFoo (test_bar) — TD-NNN raised`
- Do **not** count it as a new regression

---

## MUST-Have Gates (Critical)

### Gate 1: Security Scan ⚠️ MANDATORY

**Checklist**:
- [ ] Run `gitleaks detect --verbose` — No secrets detected (run this first)
- [ ] Run `bandit -r src/ -ll -f text` — No Medium/High severity issues
- [ ] Run `ruff check src/ tests/ scripts/ --select=S --ignore=S101,S603,S607` — No security rule findings
- [ ] Manual check: no `eval()`, `exec()`, `pickle.loads()` in notebooks
- [ ] SQL injection check: all `source_name`, `object_name`, `base_url`, `data_key` values escaped with `.replace(chr(39), chr(39)*2)` before f-string SQL interpolation
- [ ] Integer IDs cast with `int()` before SQL interpolation
- [ ] Document: "✅ Security scan PASSED — [summary]"

**Enforcement**: Do NOT proceed if Medium/High severity issues found.

### Gate 1b: Lint & Type Check ⚠️ MANDATORY

```bash
# Full lint — bugbear, security, complexity
ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607

# Type check — zero error: lines permitted
mypy src/notebooks/ --ignore-missing-imports --no-strict-optional
```

- [ ] Zero `E`, `W`, `B`, `S` ruff findings
- [ ] `C90` violations logged to `TECH_DEBT.md` if pre-existing; new functions must be ≤ complexity 10
- [ ] Zero `error:` mypy lines
- [ ] Document: "✅ Lint/type check PASSED"

---

### Gate 2: Contract Testing ⚠️ MANDATORY

**Checklist**:
- [ ] `rest_setup_contracts.py` Pydantic models cover all widget inputs
- [ ] `PYDANTIC_AVAILABLE` fallback path (`_validate_with_fallback`) mirrors Pydantic logic
- [ ] Run `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — all tests pass, coverage ≥ 80%
- [ ] IngestionConfig DDL in `nb_bootstrap.py` matches 13-column schema:
  `ConfigID, SourceID, ObjectName, WatermarkColumn, SyncType, SourcePath, SourceFileFormat, LandingFileFormat, RelativeUrl, Method, PaginationRules, CustomQuery, RequiresNotebook`
- [ ] ConnectionConfig DDL matches 11-column schema:
  `ConnectionID, SourceID, KeyVaultSecretName, ConnectionString, FabricConnectionId, PaginationMode, DataKey, JdbcDriver, AbfssPath, BaseUrl, AuthMode`
- [ ] IngestionSource DDL matches 4 columns: `SourceID, SourceName, SourceType, CreatedDate`
- [ ] Document: "✅ Contract testing PASSED — [number of contracts verified]"

**Enforcement**: Do NOT merge if DDL column counts or names drift.

### Gate 3: Edge Case Coverage ⚠️ MANDATORY

**Checklist**:
- [ ] Test with NULL/empty `LandingFileFormat` → should fall back to `"parquet"`
- [ ] Test with NULL/empty `RelativeUrl` → should use `ObjectName` as URL path
- [ ] Test with NULL/empty `DataKey` + pagination mode `NONE`/`SINGLE` → should not raise
- [ ] Test with NULL/empty `DataKey` + pagination mode `CURSOR`/`OFFSET`/`LINK_HEADER`/`PAGE` → must raise `ValueError`
- [ ] Test with `auth_mode = "NONE"` → no KV secret required, no KV check performed
- [ ] Test `ObjectName` and `source_name` with single-quote chars in SQL → escaping must hold
- [ ] Test `source_id` with non-integer string → `int()` cast must raise, not silently corrupt
- [ ] Document: "✅ Edge case coverage PASSED — [scenarios covered]"

**Enforcement**: Do NOT merge if unhandled exceptions found in critical SQL paths.

---

## SHOULD-Have Gates (Recommended)

### Gate 4: AST Syntax Check

> `ast.parse()` is a **syntax-only compile step** — it catches `SyntaxError` without executing any code. Notebook magic lines (`%run`, `%%configure`) are stripped first since they are not valid Python. This catches mismatched brackets, bad f-strings, missing colons, etc. before they surface at Fabric runtime.

```powershell
& "C:\Users\scottm\.local\bin\python3.12.exe" -c @'
import ast, re
files = [
    r"src\notebooks\nb_bootstrap.py",
    r"src\notebooks\nb_conn_rest.py",
    r"src\notebooks\nb_conn_file.py",
    r"src\notebooks\nb_landing_to_bronze.py",
    r"notebooks\rest_setup_contracts.py",
    r"notebooks\rest_setup_functions.py",
    r"notebooks\rest_setup_widgets.py",
    r"notebooks\rest_setup_config.py",
]
for f in files:
    src = open(f, encoding="utf-8").read()
    src_clean = re.sub(r"^%.*$", "", src, flags=re.MULTILINE)
    try:
        ast.parse(src_clean)
        print("OK  " + f.split("\\")[-1])
    except SyntaxError as e:
        print("ERR " + f.split("\\")[-1] + " line " + str(e.lineno) + ": " + str(e.msg))
'@
```

All 8 files must print `OK`. **Block merge on any `ERR`.**

### Gate 5: Schema Drift Check

If changing `IngestionConfig`, `ConnectionConfig`, or `IngestionSource`:

- [ ] DDL in `nb_bootstrap.py` updated
- [ ] View `vw_EntityIngestionConfig` in `nb_bootstrap.py` updated
- [ ] All SELECTs in `nb_conn_file.py`, `nb_conn_rest.py`, `nb_landing_to_bronze.py` updated
- [ ] `rest_setup_functions.py` INSERT column counts updated
- [ ] Live DEV migration SQL written and documented

### Gate 6: Notebook Execution Order

- [ ] `nb_bootstrap.py` (creates tables) runs before connectors
- [ ] `nb_conn_rest.py` / `nb_conn_file.py` (write landing) run before `nb_landing_to_bronze.py`
- [ ] `nb_landing_to_bronze.py` watermark state never modified by connector notebooks
- [ ] No circular dependencies between notebooks

---

## COULD-Have Gates (Excellence)

### Gate 7: Observability

- [ ] `log_execution_start` / `log_execution_end` called in every top-level function
- [ ] Errors written to `ExecutionLog` delta table with `Status = "FAILED"` and message
- [ ] Schema drift detected events logged with quarantine path

---

## Final Checklist ⚠️ MANDATORY

- [ ] Gates 1–3 PASSED and documented
- [ ] Gate 4 AST check all OK
- [ ] Gate 5 schema drift check complete (if applicable)
- [ ] All findings documented in PR description
- [ ] Document: "✅ Quality gates COMPLETE — [date]"
