---
description: Pre-PR code review checklist for data-platform notebooks and utilities.
---

# Code Review Checklist — data-platform

**When to use**: After completing a feature. Before merging to `main`. After self-review.

---

## 1. Tests

- [ ] All tests pass: `pytest tests/ -v`
- [ ] New tests added for new functions
- [ ] Tests cover the happy path AND at least 3 edge cases
- [ ] No tests that can never fail (tautology tests)
- [ ] AST syntax check passes for all 8 notebooks

## 2. Code Quality

- [ ] Functions are focused — one responsibility each
- [ ] No commented-out code
- [ ] No debug `print()` statements
- [ ] Meaningful variable names (no `x`, `tmp`, `data2`)
- [ ] Guard clauses used instead of nested `if/else`
- [ ] No bare `except: pass` swallowing real errors

## 3. Schema & DDL Consistency

For any change touching `IngestionConfig`, `ConnectionConfig`, or `IngestionSource`:

- [ ] DDL in `nb_bootstrap.py` updated
- [ ] View `vw_EntityIngestionConfig` in `nb_bootstrap.py` updated
- [ ] All SELECTs across connectors updated:
  - `nb_conn_file.py` — `SourceFileFormat`
  - `nb_conn_rest.py` — `LandingFileFormat`, `RelativeUrl`
  - `nb_landing_to_bronze.py` — `LandingFileFormat`
- [ ] All INSERTs have correct positional column counts:
  - `IngestionConfig`: 13 values
  - `ConnectionConfig`: 11 values
  - `IngestionSource`: 4 values
- [ ] Live DEV migration SQL documented

## 4. Security

- [ ] All string values escaped before Spark SQL interpolation: `.replace(chr(39), chr(39)*2)`
- [ ] All integer IDs cast: `int(source_id)`
- [ ] No secrets, tokens, or API keys in code
- [ ] KV secret names validated as `^[a-zA-Z0-9-]+$` only
- [ ] No `eval()`, `exec()`, `pickle.loads()`
- [ ] `bandit -r src/ -ll -f text` — no medium/high findings
- [ ] `gitleaks detect --verbose` — no secrets detected

## 5. Connector-Specific (nb_conn_rest.py)

- [ ] `RelativeUrl` fallback to `ObjectName` for URL path
- [ ] `LandingFileFormat` fallback to `"parquet"` (triple guard)
- [ ] `DataKey` guard: raises `ValueError` for CURSOR/OFFSET/LINK_HEADER/PAGE with empty key
- [ ] `auth_mode = "NONE"` path: no KV lookup, no auth header
- [ ] `PaginationMode = "NONE"` treated as valid (same as SINGLE for single-page responses)

## 6. Runtime Safety (Fabric Notebooks)

- [ ] `%pip install` at notebook start, not inside functions
- [ ] `PYDANTIC_AVAILABLE` flag gates Pydantic imports
- [ ] Fallback `_validate_with_fallback` mirrors Pydantic validation rules
- [ ] No hardcoded lakehouse names — all passed as parameters
- [ ] `log_execution_start` / `log_execution_end` called in top-level functions

## 7. Documentation

- [ ] Docstring updated if function signature changed
- [ ] Notebook cell headers updated if new fields added
- [ ] `JUNIOR_DEV_GUIDE.md` or `README.md` updated if user-facing behaviour changed

---

## PR Description Template

```markdown
## What changed
[One paragraph: what was changed and why]

## Schema changes
- [ ] None
- [ ] DDL: [describe]
- [ ] Live migration SQL:
  ```sql
  -- paste here
  ```

## Testing
- [ ] `pytest tests/ -v` — all pass
- [ ] `pytest tests/ --cov=src/notebooks --cov-fail-under=80` — coverage ≥ 80%
- [ ] AST check — all changed notebooks OK
- [ ] Roast session completed (fresh context)

## Quality gates
- [ ] `gitleaks detect` — no secrets
- [ ] `bandit -r src/ -ll -f text` — no findings
- [ ] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — no errors
- [ ] Coverage ≥ 80% (see Testing above)
- [ ] Schema drift check: `grep -rn "UseWorkspaceIdentity\|WorkspaceGuid" src/notebooks/` — all references intentional
```
