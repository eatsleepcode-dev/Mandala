---
description: Execute a sprint — TDD cycles, gates, and close — against a task card produced by build-sprint.
---

# Run Sprint

**Vibe Mode**: CREATION → HARDENING → GATEKEEPER

Executes the task card for a gap end-to-end: RED → GREEN → REFACTOR per cycle, then gates, then close.

---

## Inputs

| Input | Description |
|---|---|
| `gap-id` | Gap reference (`GAP-01`, `GAP-02`, ...) matching an existing task card |

---

## Step 0 — Task card check (prerequisite gate)

Resolve the task card path — check active location first, then completed:
```
__inbox/__todo/*/task-{gap-id}.md
.agents/sprints/task-cards/task-{gap-id}.md
```

**If no task card is found:**
> Stop. Run `/build-sprint {gap-id}` now. Do not proceed until the task card exists and its Status is `IN PROGRESS`.
> 
> Invoke: `/build-sprint {gap-id}`

**If a task card is found but Status is `TODO`:**
> The card exists but the pre-mortem has not been signed off. Run `/build-sprint {gap-id}` to complete it before proceeding.

**If a task card is found but Status is `COMPLETE`:**
> This gap is already closed. Confirm with the developer before re-opening.

**If a task card is found and Status is `IN PROGRESS`:**
> Proceed. Read the full card — elephants, migration SQL, and all planned TDD cycles — before writing any code.

### ADR pre-flight check

After reading the task card, check for an `adr_required` field:

**If `adr_required` lists one or more ADRs:**
For each listed ADR, check whether the file exists:
```bash
ls docs/adr/ADR-0NN-*.md
```
- **File exists** → confirm it is `Status: Accepted` or `Status: Proposed`. Note the path. Continue.
- **File missing and status is `MISSING`** → **Stop.** The ADR must be written before any implementation commit.
  Write the ADR now, add it to `docs/adr/README.md`, commit it, then continue to Step 1.
  Commit message: `docs(adr): ADR-0NN — {title}`

**If `adr_required` is absent or explicitly "NOT REQUIRED":** continue to Step 1.

---

## Step 1 — Apply migration SQL (if any)

Read the **Live DEV Migration SQL** section of the task card.

If it contains an `ALTER TABLE` or DDL statement (not `-- No schema change required`):
- Run it against the DEV control lakehouse before touching any source file
- Confirm the column or table exists before writing any test that references it
- Log: `Migration SQL applied — {table} {change}`

---

## Step 1b — Tidy opportunity check

Before entering the TDD loop, scan the target notebook(s) for structural debt that would make the RED/GREEN cycles harder:

```bash
radon cc src/notebooks/{notebook}.py -nc
```

**If the task card has a Tidy Cycle as the first entry in Ralph's Ledger:** execute it now.
- Apply the specified structural move (one move only)
- Confirm no behaviour change: run `pytest tests/ -v` — all tests must still pass
- Commit: `tidy({notebook}): {description}`
- Tick the tidy cycle checkbox before starting the first RED cycle

**If the task card has no Tidy Cycle but radon shows CC > 10 on a function you are about to change:**
- Pause. Apply the economics filter from `/tidy-first`:
  - Is this function changing in this sprint? (If no — skip)
  - Is the tidy proportionate to the change? (If no — skip)
  - Are we near the sprint deadline? (If yes — skip, raise a TD instead)
- If all checks pass: do a single tidy commit before the first RED, and note it in the task card iteration log

**If CC ≤ 10 across all functions in scope:** skip — proceed directly to Step 2.

---

## Step 2 — TDD execution loop

For each cycle in Ralph's Ledger, in order:

### 2a — RED
1. Write the failing test exactly as specified in the task card — use fixtures from `tests/conftest.py` (`mock_notebookutils`, `conn_config_jdbc_wi`, etc.) rather than re-declaring mocks inline
2. Run it: `pytest {test_path}::{TestClass}::{method} -v`
3. Confirm it **FAILS** — if it passes without implementation, the test is a tautology; fix it before continuing
4. Check coverage on the target function to confirm the test is actually reaching the new code path:
   ```bash
   pytest {test_path}::{TestClass}::{method} --cov=src/notebooks/{notebook} --cov-report=term-missing
   ```
   If the new lines don't appear as uncovered (missing), the test is not exercising them — fix the test
5. Commit: `git commit -m "feat({notebook}): {description} [RED]"`

### 2b — GREEN
1. Write the minimal implementation to pass the test — nothing more
2. Run: `pytest {test_path}::{TestClass}::{method} -v`
3. Confirm it **PASSES**
4. Run the AST check across all changed notebooks:
   ```bash
   python -c "
   import ast, re, pathlib
   for f in pathlib.Path('src/notebooks').rglob('*.py'):
       src = re.sub(r'^%.*$', '', f.read_text(), flags=re.MULTILINE)
       try: ast.parse(src); print('OK  ' + f.name)
       except SyntaxError as e: print(f'ERR {f.name} L{e.lineno}: {e.msg}')
   "
   ```
5. Run ruff on the changed file:
   ```bash
   ruff check src/notebooks/{notebook}.py --select=E,W,B,S,C90 --ignore=S101,S603,S607
   ```
6. Confirm no `ERR` lines and no ruff errors before committing
7. Commit: `git commit -m "feat({notebook}): {description} [GREEN]"`

### 2c — REFACTOR
- If the task card specifies a refactor target: apply it, re-run the full test file, confirm all pass
- If "none required": skip — do not refactor speculatively
- Commit if any change was made: `git commit -m "refactor({notebook}): {description} [REFACTOR]"`

### 2d — Emergent ADR check (after each GREEN commit)

After each GREEN commit, ask: **did the implementation just make an architectural decision?**

Flag it as an emergent ADR if the implementation:
- Chose a new auth pattern not covered by an existing ADR (e.g. token scope, fallback order)
- Introduced a new public API contract on an `nb_utils_*` module
- Changed a data boundary (e.g. what goes in Landing vs Bronze)
- Added a dependency on a new Fabric primitive (Eventstream, Mirroring, Fabric SQL)
- Deviated from an approach described in an existing ADR

**If any of the above apply:**
> Pause the TDD loop. Draft a one-paragraph decision statement. Check the ADR catalog
> (`docs/adr/README.md`) for the next number. Add `adr_required: [ADR-0NN — EMERGENT]`
> to the task card and write the ADR before the next RED cycle.

If the decision is minor or fully consistent with existing ADRs: continue without an ADR.
Document the reasoning in the task card iteration log either way.

### 2e — Two-failure rule
If a test fails **twice in a row** after fixes:
> Stop. Do not push further. Run `/pre-mortem` and re-evaluate the approach before the next attempt.

---

## Step 3 — Regression check

After all cycles are green, run the full test suite for every file touched:

```bash
pytest tests/ -v
```

All tests must pass before proceeding to gates. Any regression is a blocker — fix it in a new commit before moving on.

---

## Step 4 — Quality gates (GATEKEEPER phase)

All gates are mandatory. Document pass/fail in the task card iteration log.
Full command reference: `.agents/workflows/quality-gates.md`

```bash
# Gate 1: Security — bandit (no -ll findings permitted)
bandit -r src/ -ll -f text

# Gate 2: Secret scan — gitleaks
gitleaks detect

# Gate 3: Lint — ruff with full rule set
ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607

# Gate 4: Type check — mypy on changed notebooks
mypy src/notebooks/ --ignore-missing-imports --no-strict-optional

# Gate 5: Coverage — must not drop below 80%
pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80

# Gate 6: Schema drift (adapt to the gap being worked)
grep -rn "UseWorkspaceIdentity\|WorkspaceGuid\|MirroredDbId" src/notebooks/ --include="*.py"
```

**If any gate fails:** fix the issue in a new commit. Do not skip or suppress gate output.

---

## Step 5 — Sniff test

Run the `/sniff-test` checklist against every source file changed in this sprint.

Pay specific attention to:
- Single-responsibility: no function doing credential acquisition + string assembly + validation in one body
- No `except: pass` silently swallowing errors
- No hardcoded workspace IDs, lakehouse names, or environment strings
- `UseWorkspaceIdentity` flag read with `.get("UseWorkspaceIdentity", False)` — never bare key access

Document result in task card: `Sniff test: PASS / PASS WITH NOTES / FAIL`

---

## Step 6 — Roast (fresh context)

Open a **new chat session** and run `/roast` against the most complex function changed in this sprint.

Do not skip this step. The model that wrote the implementation will defend it; a clean context will not.

Copy the roast findings back into the task card iteration log:
```
Roast complete — {N} issues found, {M} fixed, {K} deferred to TECH_DEBT.md
```

Apply all critical fixes in a new commit before marking gates complete.

---

## Step 7 — Close

> **Delegate to `/sprint-close sprint-N`** for the full close procedure.
> The steps below are a summary — `/sprint-close` is the authoritative workflow.

1. **ADR close check** — before marking anything complete:
   - Re-read `adr_required` in the task card
   - For every listed ADR (planned or emergent): confirm the file exists in `docs/adr/` and is in the catalog (`docs/adr/README.md`)
   - If any ADR is still missing: write it now. Do not close the sprint with an undocumented architectural decision.
   - If an ADR written during this sprint supersedes an older one: update the older ADR's `**Status:**` to `Superseded by ADR-0NN` and add a `**Superseded by:**` line

2. Update task card **Status → COMPLETE**
3. Tick every completed item in Ralph's Ledger
4. Run `/sprint-close sprint-N` — this handles:
   - DoD audit (done / carryover / dropped / new TD)
   - Updating `.agents/SPRINT_REGISTER.md`
   - Adding carryover to the next sprint plan
   - Raising new TD items in `.agents/TECH_DEBT.md`
   - Closing resolved TD items
   - Unblocking the next sprint in the register
5. Push to the feature branch

---

## Quick reference — commit sequence for one TDD cycle

```
feat(nb-conn-jdbc): workspace identity token path [RED]
feat(nb-conn-jdbc): implement UseWorkspaceIdentity branch [GREEN]
refactor(nb-conn-jdbc): extract _acquire_token_wi [REFACTOR]
```

Never combine RED + GREEN + REFACTOR in one commit.
