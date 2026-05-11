---
description: Quick smell check before committing any data-platform code change.
---

# Sniff Test — data-platform

**When to run**: Before finalising any code changes or creating a PR.

---

## Checklist

Go through each category. Document findings at the end.

### Structure & Design
- [ ] Functions have a single clear responsibility
- [ ] No function longer than ~60 lines without a very good reason
- [ ] No nested functions that make testing impossible
- [ ] No copy-paste duplication — if same logic appears twice, extract it

### Readability
- [ ] No commented-out code blocks (delete, don't comment)
- [ ] No debug `print()` statements left in
- [ ] Variable names describe what the value is (not `x`, `tmp`, `data`)
- [ ] SQL strings use named variables, not inline `.replace()` chains

### Complexity
- [ ] No deeply nested `if/else` chains — use guard clauses
- [ ] No Boolean-blind truthy checks on values that could be `0`, `[]`, or `False`
- [ ] No `except: pass` that silently swallows real errors
- [ ] Watermark comparisons use explicit operators, not implicit truthiness

### Data & API Smells
- [ ] `LandingFileFormat` defaults to `"parquet"` — guard is `(val or "parquet").strip().lower() or "parquet"`
- [ ] `RelativeUrl` defaults to empty string — guard is `(val or "").strip()`
- [ ] `DataKey` defaults to empty string `""` — not `None`, not `"args"`, not `"data"`
- [ ] All pagination modes validated against: `{"NONE", "SINGLE", "CURSOR", "OFFSET", "LINK_HEADER", "PAGE"}`
- [ ] `auth_mode` validated against: `{"BEARER", "BASIC", "APIKEY", "NONE"}`
- [ ] No hardcoded file format strings like `"JSON"` or `"csv"` replacing a config value

### Security Smells
- [ ] No raw string variable interpolation into Spark SQL — `.replace(chr(39), chr(39)*2)` for all string values
- [ ] No `int(source_id)` missing — raw string ID in SQL is injection surface
- [ ] No secrets or tokens in code, comments, or test fixtures
- [ ] No `eval()`, `exec()`, `pickle.loads()`
- [ ] KeyVault secret names validated as alphanumeric+hyphens only

### AI / LLM Coding Issues
- [ ] Column name drift: `CreatedDate` (not `CreatedAt`), `SourceFileFormat` (not `FileFormat`)
- [ ] Ordering bug: `data_key_sql` computed **after** `data_key` widget is read
- [ ] Positional INSERT column count matches DDL (IngestionConfig = 13, ConnectionConfig = 11, IngestionSource = 4)
- [ ] No "LLM placeholder" values left in: `"your-keyvault"`, `"example.com"`, `"TODO"`
- [ ] `PYDANTIC_AVAILABLE` fallback mirrors Pydantic validation exactly

### Environment & Configuration
- [ ] No hardcoded lakehouse names — passed as parameters
- [ ] No hardcoded workspace IDs or environment-specific URLs
- [ ] `%pip install` lines at top of notebook, not inline

### Repo Hygiene
- [ ] No `tmp_*.py` or debug scripts committed to `src/`
- [ ] No `.ipynb` checkpoints committed
- [ ] `__pycache__` in `.gitignore`

### Tool Gates (run these, don't just eyeball)

```bash
# Ruff — bugbear, security, complexity
ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607

# Bandit — security scan (must be clean at -ll severity)
bandit -r src/ -ll -f text

# mypy — type check changed files
mypy src/notebooks/<changed-file>.py --ignore-missing-imports --no-strict-optional

# Coverage — confirm new code is exercised (must not drop below 80%)
pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80

# AST — confirm no syntax errors in notebooks
python -c "
import ast, re, pathlib
for f in pathlib.Path('src/notebooks').rglob('*.py'):
    src = re.sub(r'^%.*$', '', f.read_text(), flags=re.MULTILINE)
    try: ast.parse(src); print('OK  ' + f.name)
    except SyntaxError as e: print(f'ERR {f.name} L{e.lineno}: {e.msg}')
"
```

**Coverage drop is a blocker.** If new code is not covered, the RED test did not exercise it — revisit the test before proceeding to REFACTOR.

### Pre-existing failure check

Before your changeset, record the baseline failure count:

```powershell
py -m pytest tests/ -q --tb=no 2>&1 | Select-Object -Last 3
```

When the full suite runs after your changeset:

- [ ] Failures present in baseline AND in files outside `git diff --name-only HEAD` → **pre-existing** (note in gate result, raise TD if needed)
- [ ] Any NEW failure not in baseline → **regression you introduced** — fix before committing
- [ ] After fixing pre-existing failures in a separate commit, rerun the full suite to confirm no interactions introduced
- [ ] Document: "✅ No new test regressions — [N] pre-existing failures noted (TD-NNN)"

See `quality-gates.md` Pre-existing Failure Triage Protocol for the full workflow.

---

## Document Findings

> **Sniff Test Results**
>
> - **Status**: PASS / PASS WITH NOTES / FAIL
> - **Issues Found**: [list]
> - **Recommendations**: [fixes needed]

- **PASS** → Proceed to commit
- **PASS WITH NOTES** → Document tech debt in `.agents/TECH_DEBT.md`, proceed
- **FAIL** → Fix issues before committing
