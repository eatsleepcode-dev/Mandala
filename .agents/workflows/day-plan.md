---
workflow: day-plan
trigger: "/day-plan | start of session | handoff note received"
scope: data-platform
output: ".mandala/inbox/__todo/YYYYMMDD/__plan-for-the-day.md"
---

# /day-plan — Daily Plan Workflow

> Generate today's day plan by gathering live repo state and instantiating the plan
> template below. Run at the start of every work session.
>
> **Trigger phrases:** `/day-plan`, "build today's plan", "what are we doing today",
> or when pasting a `/chat-handoff` note at session start.

---

## Step 1 — Gather live repo state

Run these commands and capture the output:

```powershell
# Branch + HEAD
git branch --show-current
git log --oneline -1

# Test baseline
py -m pytest tests/ -q --tb=no 2>&1 | Select-Object -Last 2

# Linting health (quick)
py -m ruff check src/ --quiet 2>&1 | Select-Object -Last 1
```

Expected captures:
| Variable | Source |
|---|---|
| `BRANCH` | `git branch --show-current` |
| `HEAD_SHA` | first 7 chars of `git log --oneline -1` |
| `HEAD_MSG` | rest of that line |
| `TEST_COUNT` | e.g. `1323 passed, 7 skipped` |
| `LINT_STATUS` | `All checks passed` or count of errors |

---

## Step 2 — Read sprint context

Read `.agents/SPRINT_REGISTER.md`:
- Find the **last** row in the Register table — that is the **current sprint**.
- Note its `Status` (READY / IN PROGRESS / COMPLETE), `Title`, and `Started` date.
- Scan the sprint detail section for its status and any open `[ ]` deliverables.
- If the sprint status is **READY** (not yet started): check whether a story map exists at
  `.mandala/inbox/__todo/*/story-map-{gap-id}.md`. If none, note it as a recommended first step
  (run `/user-story-map GAP-NN`) before `/build-sprint`, especially for larger or ambiguous gaps.

Read `.agents/TECH_DEBT.md`:
- Collect all items with status `Open` or `In Progress`.
- Group by severity: 🔴 High → 🟡 Medium → 🟢 Low.

---

## Step 2b — Inbox scan

Scan `.mandala/inbox/` for unprocessed items at depth 1 only. Two categories:

### 2b.1 — Loose files (depth 1)

```powershell
Get-ChildItem .mandala\inbox\ -File | Select-Object Name, Extension, LastWriteTime | Sort-Object LastWriteTime -Descending
```

### 2b.2 — Non-`__` prefixed subdirectories (dropped-in folders)

```powershell
Get-ChildItem .mandala\inbox\ -Directory | Where-Object { $_.Name -notlike '__*' } | Select-Object Name, LastWriteTime
```

These are folders someone has dropped into `.mandala/inbox/` for triage — e.g. a research dump, a reference package, or a set of spec docs.

### 2b.3 — Surface and confirm

For each item found, classify by extension/type and display:

```
Inbox scan found N items:

Loose files:
  • fabric-assessment-delaware.md    [research doc]
  • backup_azure.py                  [script]
  • prereqs.csv                      [data file]
  • BFL Data Platform.json           [config/data]

Dropped-in folders:
  • fabric_kit/                      [folder — N files]
  • code-first-fabric/               [folder — N files]

Action options per item:
  [move]   → move to .mandala/inbox/__todo/YYYYMMDD/
  [ref]    → move to __reference/
  [skip]   → leave in place (intentionally parked)
  [all-ref]→ move everything to __reference in one go

Awaiting your decision before proceeding.
```

**Rules:**
- `__` prefixed folders (`__errors/`, `__todo/`) — **always skip**, never surfaced
- `.mandala/inbox/__todo/*/` subfolders — **always skip**
- Files/folders the user marks `[skip]` — add a note under `## Inbox (parked)` in the day plan so they're not re-surfaced tomorrow
- Do **not** move anything without explicit confirmation — this is a mandatory HITL gate

---

## Step 3 — Read today's task folder

Check `.mandala/inbox/__todo/YYYYMMDD/` (today's date):
- If a `__plan-for-the-day.md` already exists → **do not overwrite**; summarise its state instead.
- If a `PLAN.md` or `*-scope.md` exists → read it; use it as the workstream source.
- List all other `.md` files in the folder — these are in-flight notes and research docs.

---

## Step 4 — Instantiate the plan

Fill the template below with live values, then save as:

```
.mandala/inbox/__todo/<YYYYMMDD>/__plan-for-the-day.md
```

Where `YYYYMMDD` is today's date in local time (UK, Europe/London).

---

## Template

```markdown
---
type: day-plan
date: "YYYY-MM-DD"
branch: "BRANCH"
sprint: SPRINT_NUMBER
sprint_status: "SPRINT_STATUS"        # READY | IN PROGRESS | COMPLETE
scope: "Peggy"
repos: ["data-platform"]
head_sha: "HEAD_SHA"
test_baseline: "TEST_COUNT"
lint_status: "LINT_STATUS"            # clean | N errors
task_card: "task-GAP-NN.md"           # driving task card, or null
carried_over: []                      # task IDs copied from yesterday's plan
inbox_actioned: []                    # items moved/refiled from inbox scan
open_tds: []                          # TD-NNN ids with status Open/In Progress
hitl_gates: []                        # list of gates requiring live workspace
---

# Day Plan — DD Month YYYY

> [!IMPORTANT]
> Branch: `BRANCH` · Sprint SPRINT_NUMBER **SPRINT_STATUS** · HEAD: `HEAD_SHA`

> [!NOTE]
> HEAD_MSG

---

## Handoff State

| Key | Value |
|---|---|
| Last sprint | Sprint PREV — PREV_TITLE — **PREV_STATUS** |
| HEAD | `HEAD_SHA` — HEAD_MSG |
| Test baseline | ✅ TEST_COUNT |
| Linting | LINT_STATUS |
| Branch push | PUSH_STATUS |
| Open TDs | TD_SUMMARY |

---

## Focus Areas

1. **Primary** — [highest-priority item from sprint or PLAN.md]
2. **Secondary** — [second item]
3. **Housekeeping** — [commits, diary, carryover]

---

## Workstream A — [Primary workstream name] `Priority: HIGH`

[Brief context paragraph — what this workstream addresses and why it is prioritised today.]

### Task A1 — [Task name] _(offline / requires live workspace)_

**Design**
- [ ] [Design step 1]
- [ ] [Design step 2]

**TDD — RED**
- [ ] [Write test file / test class]
- [ ] `py -m pytest tests/[test_file].py -v` → confirm RED

**TDD — GREEN**
- [ ] [Implement the function / notebook cell]
- [ ] `py -m pytest tests/[test_file].py -v` → GREEN

**Quality gates**
- [ ] `/sniff-test` — ruff, bandit, mypy on changed files
- [ ] `py -m pytest tests/ -q --tb=no` — confirm no new failures vs TEST_COUNT

> [!WARNING]
> **HITL checkpoint** [Describe what needs live workspace validation before wiring into CI.]

**Commit**
```powershell
git add [files]
git commit -m "[type(scope): description]"
```

---

## Workstream B — [Secondary workstream name] `Priority: [MEDIUM/HIGH]`

[Brief context.]

### Task B1 — [Task name]

**Design**
- [ ] ...

**TDD — RED / GREEN / Quality** _(same structure as Workstream A)_

**Commit**
```powershell
git add [files]
git commit -m "[type(scope): description]"
```

---

## Workstream C — Housekeeping `Priority: LOW`

- [ ] **C1 — Commit any uncommitted docs** from prior session
  ```powershell
  git status --short
  ```

- [ ] **C2 — Diary enrichment** _(requires AZURE_OPENAI_ENDPOINT)_
  ```powershell
  py scripts/diary/retrospective.py --since YYYY-MM-DD
  ```

- [ ] **C3 — Sprint status review** — verify sprint deliverables against `.agents/SPRINT_REGISTER.md`

---

## Blocked Items ⛔

> [!CAUTION]
> Items below require a live Fabric workspace with Workspace Admin rights.

| # | Item | Requires live workspace? | Status |
|---|---|:---:|---|
| B1 | [Blocked item description] | ✅ Yes | ⬜ Pending |

---

## Sequencing Recommendation

```
Morning   → [Workstream A task]  → quality gates → commit
Afternoon → [Workstream B task]  → quality gates → commit
End of day → housekeeping → sprint register update
Blocked   → [Items needing live workspace]
```

---

## Branch Housekeeping

- Current branch `BRANCH` is pushed to `origin/BRANCH`. [PR status note.]
- Sprint SPRINT_NUMBER will continue on `BRANCH` unless scope warrants a new feature branch.

---

## Open Tech Debt (reference)

| Severity | ID | Description |
|---|---|---|
| 🔴 High | TD-XXX | [Description] |
| 🟡 Medium | TD-XXX | [Description] |
| 🟢 Low | TD-XXX | [Description] |
```

---

## Step 5 — Save and confirm

After writing the file:
1. Report the full path of the saved plan file.
2. Print the **Focus Areas** section as a summary.
3. Call out any HITL checkpoints requiring live workspace access.
4. Note whether the sprint status changed since yesterday's plan.

---

## Notes for the agent

- **Never** overwrite an existing `__plan-for-the-day.md` — if one exists, read it and
  summarise its completion state instead.
- The test baseline count is **the number after the most recent green run** — do not
  invent it; always run pytest.
- HITL (Human-In-The-Loop) checkpoints must be preserved and surfaced prominently —
  they mark steps that require live Fabric workspace access or manual verification.
- UK English spelling throughout (initialise, optimise, colour, etc.).
- All shell commands use PowerShell syntax (`py`, not `python3`; no `&&`).
