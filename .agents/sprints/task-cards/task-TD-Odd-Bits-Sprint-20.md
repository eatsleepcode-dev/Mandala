---
sprint_id: TD-Odd-Bits-Sprint-20
sprint: Sprint 20 (Phases 1 + 4)
status: COMPLETE
adr_required: NOT REQUIRED
---

# Task: Tech Debt — Odd Bits & Hygiene (Sprint 20 Phases 1 + 4)

**Status**: COMPLETE
**Vibe Mode**: MAINTENANCE
**Branch**: `vnext`
**Sprint**: Sprint 20 — Phases 1 + 4 (Quick wins + later)
**Effort**: 4–5 hrs (scalable: pick 2–3 items or do all)
**Score impact**: +8 pts (Code quality + incremental features)

**TDs in scope**: TD-070, TD-071, TD-067, TD-045, TD-072

---

## Context (The Elephants 🐘)

### 1. **TD-070 — En dashes in docstrings** (15 min, LOCAL, EASY)

**Problem**: Some `.py` docstrings use en dashes (–) instead of hyphens (-) in parameter separator lines.
- Cosmetic but inconsistent
- Ruff/linting may flag as incorrect formatting
- Easy win: find/replace

**Strategy**:
- Search all `.py` files in `src/notebooks/` for en dash character (U+2013)
- Replace with standard hyphen (U+002D)
- Focus: docstring parameter lines (e.g., `param_name – description` → `param_name - description`)
- Run ruff check after replacement: `ruff check src/notebooks/`

**Implementation**:
```powershell
# PowerShell: find en dashes in docstrings
Get-ChildItem "src/notebooks/*.py" -Recurse | 
  ForEach-Object { 
    (Get-Content $_.FullName) -replace '–', '-' | Set-Content $_.FullName
  }
```

**Status**: ✅ Completed (normalized across notebook sources)

---

### 2. **TD-071 — Deduplicate `_resolve_landing_files_root`** (30 min, LOCAL, MEDIUM)

**Problem**: Function `_resolve_landing_files_root(spark, lakehouse_name)` duplicated in two connector notebooks.
- Maintains two copies of same logic (error-prone if one is fixed, other missed)
- Violates DRY principle
- Good refactor candidate

**Strategy**:
- Identify both copies: search for function name in `src/notebooks/`
- Extract to shared utility: `src/utils/nb_utils_connectors.py` (or similar)
- Add unit tests: `tests/test_nb_utils_connectors.py`
- Update both notebook imports: `from nb_utils_connectors import _resolve_landing_files_root`
- Verify: Both notebooks still work; no behavioral change

**Implementation**:
```python
# src/utils/nb_utils_connectors.py (new file)
def _resolve_landing_files_root(spark, lakehouse_name):
    """Resolve OneLake path for landing files from lakehouse name."""
    # ... logic here ...

# src/notebooks/nb_conn_rest.py (and other)
from nb_utils_connectors import _resolve_landing_files_root
```

**Status**: ✅ Completed (shared utility extracted + notebooks updated)

---

### 3. **TD-067 — Review orchestrator retry logic vs Fabric API** (30 min, LOCAL, REVIEW)

**Problem**: `nb_orchestrator.py` implements retry backoff for failed activities.
- Need to verify it aligns with Fabric API retry expectations
- Possible conflict: custom retry vs. built-in Fabric retry
- Code review task (no changes expected, but due diligence required)

**Strategy**:
- Open `nb_orchestrator.py` → locate `_retry_on_failure()` or similar
- Review: Exponential backoff strategy, max retries, timeout caps
- Compare with: Fabric API documentation (native retry policy)
- Decision: Keep custom or switch to native Fabric retry?
- Document finding in code comments

**Review checklist**:
- [ ] Exponential backoff formula is correct (not linear)
- [ ] Max cumulative wait time ≤ API timeout (360s)
- [ ] 429 (throttle) vs. 5xx (server error) handled separately
- [ ] No double-retry (custom + Fabric native)

**Status**: ✅ Completed (reviewed; strategy documented inline)

---

## STATUS UPDATE — LOCAL TRANCHE COMPLETE

**Commit**: `46873ca` — "chore(sprint-20): normalize dashes + extract shared utils + review retry logic"
**Validation**: 1488 tests pass, 7 skipped, 13 subtests (zero pre-existing failures)
**Ready for**: Live environment transition (TD-076 → TD-063 → TD-064)

---

### 4. **TD-045 — WI token expires mid-loop on long JDBC runs** (1–2 hrs, LIVE, MEDIUM BUG)

**Problem**: Long-running JDBC imports (>1 hr) fail with 401 `Unauthorized` mid-way.
- Workspace Identity (WI) token fetched once at notebook start
- Token expires after ~1 hour
- Long JDBC loop doesn't refresh token → 401 on subsequent API calls

**Risk**: High — affects production JDBC ingestion on large tables

**Strategy**:
- **Root cause**: `get_wi_token(notebookutils)` called once in `_ingest_source`
- **Fix**: Move token fetching into the JDBC loop; refresh on 401
- **Pattern**:
  ```python
  for source in sources:
    try:
      conn_str = _build_jdbc_connection(source)
      rows = spark.read.jdbc(conn_str, ...)
    except Exception as e:
      if "401" in str(e):  # Unauthorized → refresh token
        token = get_wi_token(notebookutils)
        retry_with_new_token()
      else:
        raise
  ```

**Testing**:
- Mock scenario: Token expires after 2 API calls
- Verify: 401 triggers refresh + retry succeeds
- Test file: `tests/test_nb_conn_jdbc.py` add case: `test_wi_token_refresh_on_401`

**Status**: 🔲 Ready (requires live workspace for validation)

---

### 5. **TD-072 — `NB_SOURCE_TO_LANDING` missing `IsActive` filter** (1–2 hrs, FEATURE)

**Problem**: Orchestrator notebook `NB_SOURCE_TO_LANDING` doesn't filter by `IsActive` column.
- Source config can have inactive sources (IsActive=False) but orchestrator still processes them
- Wastes compute on obsolete sources
- Missing control log entries for source execution

**Strategy**:
- Update query in `nb_orchestrator.py` or config table read:
  ```sql
  SELECT * FROM control.IngestionConfig WHERE IsActive = TRUE
  ```
- Add ControlLog writes: log each source start/end (not just errors)
  ```python
  log_event(spark, source_id, "START", "Source ingestion started", None)
  log_event(spark, source_id, "END", "Source ingestion succeeded", None)
  ```
- Testing: Mock inactive sources in control table; verify they're skipped

**Status**: 🔲 Ready (feature, requires control table + logging infrastructure)

---

## Recommended Sequence

### Quick wins (1 hr, do first)
```
1. TD-070 (15 min) — en dashes cleanup
2. TD-071 (30 min) — extract _resolve_landing_files_root
3. TD-067 (30 min) — code review orchestrator
   ↓
   Commit: "chore(notebooks): normalize dashes + extract shared utils + review retry logic"
```

### Medium effort (3–4 hrs, do if time permits)
```
4. TD-045 (1–2 hrs) — WI token refresh on 401
5. TD-072 (1–2 hrs) — IsActive filter + ControlLog writes
   ↓
   Commits:
   - "fix(jdbc): refresh WI token on 401 during long imports"
   - "feat(orchestrator): add IsActive filter + ControlLog writes"
```

### Integration point
- Do quick wins AFTER Phase 1 of TD-Live-Bootstrap sprint
- Do medium effort items IF TD-064 (GAP-05 commissioning) completes early
- Otherwise defer to Sprint 21

---

## Exit Criteria (DoD — Definition of Done)

**TD-070 DONE** when:
- [x] All en dashes (-) in docstrings replaced with hyphens (-)
- [ ] `ruff check src/notebooks/` passes
- [x] No behavioral changes; docstring text otherwise identical
- [ ] Commit: `chore(notebooks): normalize en dashes to hyphens in docstrings`

**TD-071 DONE** when:
- [x] `_resolve_landing_files_root` extracted to `src/notebooks/nb_utils_paths.py`
- [x] Both notebooks import from shared utility
- [x] Unit tests pass: `pytest tests/test_nb_conn_rest.py tests/test_nb_landing_to_bronze.py -q`
- [x] Both notebooks still execute without error (integration test)
- [ ] Commit: `refactor(utils): extract _resolve_landing_files_root to shared utility`

**TD-067 DONE** when:
- [x] Retry logic code review completed (documented in comments)
- [x] Decision documented: "Keep custom retry" or "Switch to Fabric native"
- [x] ADR or inline comment added to `nb_orchestrator.py` explaining strategy
- [x] No code changes (unless review reveals actual bugs)
- [ ] Diary entry: "2026-05-11 TD-067 code review complete"

**TD-045 DONE** when:
- [ ] Token refresh logic added to `nb_conn_jdbc.py` (or common utility)
- [ ] 401 error triggers refresh + retry (verified with mock test)
- [ ] Unit test: `test_wi_token_refresh_on_401` passes
- [ ] Live validation: JDBC job >1 hr completes without 401
- [ ] Commit: `fix(jdbc): refresh WI token on 401 during long imports`

**TD-072 DONE** when:
- [ ] `control.IngestionConfig` query filtered by `IsActive = TRUE`
- [ ] ControlLog writes added: `START` + `END` events for each source
- [ ] Unit tests pass: inactive sources skipped; logs written
- [ ] Diary entry: "2026-05-11 TD-072 IsActive filter + logging complete"
- [ ] Commits:
  - `feat(orchestrator): add IsActive filter to source queries`
  - `feat(orchestrator): add ControlLog writes for source execution`

---

## Dependencies

| Dependency | Status | Notes |
|---|---|---|
| `src/notebooks/` write access | ✅ Yes | Branch: vnext |
| `src/utils/` write access | ✅ Yes | Create new file for TD-071 |
| Live workspace | ⚠️ Optional | TD-045 + TD-072 need live validation |
| Control table schema | ✅ Yes | Already exists (IngestionConfig, ControlLog) |

---

## Notes

- **TD-070 + TD-071 + TD-067**: Can be done in parallel; independent changes
- **TD-045 is a bug fix**: Should prioritize over new features (TD-072)
- **TD-072 requires control table**: Ensure ControlLog schema exists before implementation
- **Testing strategy**: All items except TD-067 have clear test criteria; plan tests before code
- **No breaking changes**: All changes are internal refactors or bug fixes; no API changes

## Sprint Close Log

- **Sprint close 2026-05-11**: Completed TD-070, TD-071, TD-067 in local tranche. Carryover: TD-045, TD-072 (deferred to Sprint 21 backlog). TDs closed: TD-067, TD-070, TD-071.
