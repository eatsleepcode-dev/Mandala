---
description: Build a sprint task card — pre-mortem, elephant register, migration SQL, and execution checklist — before any code is written.
---

# Build Sprint

**Vibe Mode**: CREATION (planning only — no implementation in this skill)

Produces a task card at `.mandala/inbox/__todo/{YYYYMMDD}/task-{gap-id}.md` (active work location).
Sprint-close moves it to `.agents/sprints/task-cards/` on completion.
The card is the only artefact — no code is written here.

---

## Phase 0 — VALIDATE ⚠️ MANDATORY BEFORE ANY PLANNING

> All five checks must be evaluated and documented before the task card is written.
> Any ❌ blocker **stops** the workflow — resolve it, then re-run `/build-sprint`.

---

### 0.1 Previous Sprint Closure Check

Read `.agents/SPRINT_REGISTER.md` and identify the sprint immediately before the one being planned.

```powershell
# Find the last non-COMPLETE sprint
Select-String -Path ".agents/SPRINT_REGISTER.md" -Pattern "IN PROGRESS|PLANNED" | Select-Object -First 5
```

- Is the previous sprint marked `COMPLETE`?
- If `IN PROGRESS`: does a task card exist in `.mandala/inbox/__todo/` or `.agents/sprints/task-cards/`?
- If the task card exists but the sprint register row still says `IN PROGRESS`: run `/sprint-close` before continuing.

**Gate outcome:**
- ✅ Previous sprint is `COMPLETE` in register — proceed
- ⚠️ Previous sprint is `IN PROGRESS` but work is code-complete (tests green, artefacts pushed) — run `/sprint-close` first, then return here
- ❌ BLOCKED: previous sprint is `IN PROGRESS` with open cycles — do not plan a new sprint until it closes

---

### 0.2 Tech Debt Pre-Scan

Determine which sprint number the new gap will occupy (from the register), then scan for High-severity TD items targeting it:

```powershell
python3 -c "
import re
text = open('.agents/TECH_DEBT.md').read()
blocks = re.split(r'(?=^## TD-)', text, flags=re.MULTILINE)
for b in blocks:
    if 'HIGH' in b.upper() and '🔲 Open' in b:
        hdr = re.match(r'(## TD-[^\n]+)', b)
        sev = re.search(r'\*\*Severity:\*\* (\S+)', b)
        sprint = re.search(r'\*\*Suggested sprint:\*\* (\S+)', b)
        if hdr:
            print(f'{hdr.group(1)}  [{sev.group(1) if sev else \"?\"}]  sprint={sprint.group(1) if sprint else \"?\"}')
"
```

- Any HIGH TDs targeting the planned sprint number? → must be resolved or explicitly descoped before proceeding
- Medium/Low TDs → list them under `## Pre-existing Tech Debt` in the task card; decide cycle vs defer

**Gate outcome:**
- ✅ No HIGH TDs targeting this sprint — proceed
- ⚠️ Medium/Low TDs found — acknowledge; list in task card
- ❌ BLOCKED: HIGH TDs unresolved — fix or descope first

---

### 0.3 ADR Pre-Check

Decide whether the gap introduces a new architectural decision **before** writing the task card (Step 1b will handle the full ADR workflow — this check answers whether to expect that gate to fire).

An ADR is likely required if the gap involves:
- A new auth mechanism, credential pattern, or workspace identity path
- A new connector type or ingestion protocol not in `src/notebooks/`
- A new control store schema change that affects cross-notebook contracts
- A change that supersedes or partially contradicts an existing ADR in `docs/adr/`

```powershell
# Check highest existing ADR number
Get-ChildItem docs/adr/ADR-0*.md | Sort-Object Name | Select-Object -Last 1
```

**Gate outcome:**
- ✅ No new ADR required — note it, proceed (Step 1b will confirm)
- ⚠️ ADR likely required — confirm the ADR exists and is `Accepted` before reaching Step 1b; if missing, plan to run `/write-adr` first

---

### 0.4 Scope Sanity Check

- Does the gap description map to ≤5 concrete, independently-testable cycles?
- Does each cycle have an observable outcome (not "improve" or "enhance")?
- Are there any dependencies on Fabric runtime behaviour that need a mock strategy?

If scope feels unbounded, split the gap into a `{GAP-NN}a` / `{GAP-NN}b` pair and plan only one here.

**Gate outcome:**
- ✅ ≤5 cycles, each testable offline — proceed
- ⚠️ 6–8 cycles — flag in task card, consider split
- ❌ >8 cycles or untestable outcomes — split the gap before continuing

---

### 0.5 Mom Test + Toyota Kata Target Condition

**Mom Test (Jeff Patton discipline):**
For each planned cycle, confirm:
1. **Who is the actor?** — which human role benefits from this cycle being done? If the answer is "nobody directly", the cycle is infrastructure — label it explicitly and minimise it.
2. **What changes for a real user when this cycle is done?** (not "the test passes" — what can they DO or SEE that they couldn't before?)
3. **How will the acceptance test catch a regression?** (specific observable assertion, not "it works")

If any cycle cannot be answered concretely, rework it or drop it.

**Toyota Kata — Target Condition:**
Before writing any cycles, state the measurable condition the system will be in when this sprint is complete. This is NOT the long-term challenge — it is the next observable step on the path.

Format (copy into the task card header):
```
Target Condition — Sprint N — {date}
- [Metric]: [target value]   e.g. "Tests automated: ≥N baseline cycles green"
- [Metric]: [target value]   e.g. "Coverage: all changed notebooks ≥80%"
- [Observable]: [what a user can see/do that they cannot today]
- Experiment threshold: test is FAILED if {measurable condition}
```

If a story map exists for this gap (`.mandala/inbox/__todo/*/story-map-{gap-id}.md`), copy the Target Condition from it directly. If no story map exists, write the TC now before ordering cycles.

**Walking Skeleton check (Jeff Patton):**
If multiple cycles are planned, identify which cycle delivers the thinnest end-to-end slice of value. Order Ralph's Ledger skeleton-first — a user should be able to observe value after the first GREEN, not only after all cycles are complete.

**Gate outcome:**
- ✅ Every cycle has a named actor, a concrete observable outcome, and a named assertion — proceed to Step 1
- ✅ Target Condition is written and measurable — proceed to Step 1
- ⚠️ No story map exists — write TC inline in task card header before continuing

---

### 0.6 Gate Decision

| Result | Action |
|---|---|
| ✅ All checks pass | Proceed to Step 1 — Locate the item |
| ⚠️ Minor issues (TD acknowledged, ADR flagged) | Proceed with documented caveats in task card |
| ❌ Any blocker | **STOP** — resolve before planning |

**Document the gate result** at the top of the task card iteration log:
```
VALIDATE gate: ✅ [date] — [brief summary of findings, or "clean"]
```

### 0.7 Context health check

Before writing the task card, verify the session is starting clean.
Run `/token-budget` if any of the following are true:

- The previous sprint's artefacts (task card content, CHANGELOG section, commit
  log) are still visible in the current conversation context
- The current session has 10+ tool calls already
- The always-loaded instruction files (`CLAUDE.md`, `copilot-instructions.md`)
  have grown since the last review

If clean, note: `Context health: ✅ clean session` in the task card.
If compacted / reset, note: `Context health: ✅ compacted after Sprint N`.

---

## Inputs

| Input | Description |
|---|---|
| `gap-id` | Gap reference (`GAP-01`, `GAP-02`, ...) or tech debt ref (`TD-032`, ...) |

---

## Step 1 — Locate the item and check register

Search in order:
1. `.agents/SPRINT_REGISTER.md` — check the sprint register first:
   - Is this gap already assigned to a sprint that is `IN PROGRESS` or `COMPLETE`?
   - Is there a `Carryover` entry for this gap from a previous sprint?
   - If carryover exists: read the previous sprint's plan and task card to understand
     exactly what remains — do not re-plan what is already done
2. `.agents/ROADMAP.md` — gap items and FMD comparison candidates
3. `.agents/TECH_DEBT.md` — open TD items tagged with this gap or sprint
4. `.agents/sprints/task-cards/` and `.mandala/inbox/__todo/` — any existing completed or in-progress task cards for the same gap
   - Sprint plans use YAML frontmatter with `adr_required: [ADR-045, ...]` — note any listed ADRs

If carryover from a prior sprint is found, the task card must include a
`## Carryover from Sprint N` section listing the specific uncompleted items,
so Ralph's Ledger starts from the right place.

If the item is not found in any source, stop and ask the user to clarify before continuing.

---

## Step 1b — ADR assessment

Before writing the task card, determine whether this gap requires an ADR.

**An ADR is required if the gap involves any of:**
- A new auth mechanism or credential pattern (e.g. Workspace Identity, SCC, device-code flow)
- A new connector type or ingestion protocol not previously in the codebase
- A new control store technology (e.g. Fabric SQL DB replacing Delta)
- A change to the medallion layer boundary or lakehouse topology
- A decision that supersedes or partially contradicts an existing ADR
- A new CI/CD deployment pattern or environment promotion model
- A new observability or logging contract (e.g. Eventstream alongside Delta)

**An ADR is not required for:**
- A parameter added to an existing function
- A new test class or fixture
- A seed file row addition
- A script that automates an already-decided pattern

**If an ADR is required:**
1. Check `docs/adr/` — does it already exist?
   - `ls docs/adr/ADR-0*.md` and grep for the decision topic
2. If it exists: note the file path in the task card under `adr_required`
3. If it does not exist: **STOP — do not write the task card yet.**
   Run `/write-adr {title} {gap-id}` first.
   The ADR file must exist at `docs/adr/ADR-0NN-{slug}.md` with status `Accepted`
   before this workflow proceeds past Step 1b.
   Once the ADR exists and is `Accepted`, return here and continue from Step 1c.

   If the ADR exists but has status `Proposed` (not yet `Accepted`):
   **STOP — run `/write-adr` Step 7 to promote it to Accepted first.**

   Record the ADR path in the task card frontmatter as:
   `adr_required: "ADR-0NN — {title}"`
   and include an ADR Cycle as the first checklist item:
   ```
   ### ADR Cycle — confirm ADR-0NN is Accepted
   - [ ] Verify docs/adr/ADR-0NN-{slug}.md status is `Accepted`
   - [ ] ADR linked in task card frontmatter
   ```
   ADR must be `Accepted` **before** the first implementation commit for this gap.

---

## Step 1c — Tech debt pre-flight check

Before writing the task card, determine which sprint number this gap belongs to
(from the sprint register row). Then run:

```bash
python3 -c "
import re
text = open('.agents/TECH_DEBT.md').read()
blocks = re.split(r'(?=^## TD-)', text, flags=re.MULTILINE)
sprint_n = 'N'   # replace N with the actual sprint number
for b in blocks:
    if f'**Suggested sprint:** {sprint_n}' in b and '🔲 Open' in b:
        hdr = re.match(r'(## TD-[^\n]+)', b)
        sev = re.search(r'\*\*Severity:\*\* (\S+)', b)
        if hdr:
            print(f'{hdr.group(1)}  [{sev.group(1) if sev else \"?\"}]')
"
```

**If the output contains any High-severity TDs:**
> Stop. These must be resolved before the new sprint task card is written.
> For each High TD: either fix it now (run `/run-sprint TD-NNN` if it has a task card,
> or fix inline), or explicitly descope it and change its `Suggested sprint` to a later sprint.
> Do not write new feature code on top of known High debt targeting this sprint.

**If the output contains only Medium or Low TDs:**
> List them in the task card under a `## Pre-existing Tech Debt` section.
> Decide for each: include it in Ralph's Ledger as a dedicated cycle, or leave it
> for a later sprint and note it explicitly. Do not silently ignore them.

**If the output is empty:**
> No targeted debt — proceed directly to Step 2.

---

## Step 2 — Pre-mortem / Obstacles (Toyota Kata + imagine the failure)

This step has two lenses on the same question: *what is standing between the current condition and the target condition?*

**Toyota Kata — Obstacles:**
List every obstacle that could prevent reaching the Target Condition. An obstacle is a specific, concrete blocker — not a vague concern. For each obstacle, write: what it is, why it matters, and the planned countermeasure (or "investigate" if unknown).

Format (copy into task card Elephants section):
```
Obstacle: {specific thing blocking TC}
Impact: {what happens if not addressed}
Countermeasure: {planned action or "investigate in Cycle N"}
```

**Pre-mortem (imagine the failure):**
Answer these three questions about the gap:

**A) What is the most likely technical mismatch?**
- DDL change with no matching ALTER TABLE?
- Connector reads a column that won't exist yet?
- New parameter that an existing pipeline JSON doesn't pass?

**B) What is the most likely data contract break?**
- A new flag that defaults to `None` where `False` is required?
- A new table column that existing INSERT statements don't include (positional count drift)?
- A `get()` call with the wrong fallback for a column that's been renamed?

**C) What is the most likely integration failure?**
- A notebook that must run before another but has no dependency declared?
- A test that passes offline but fails on Fabric because it calls `notebookutils` without a mock?
- A watermark that advances even when 0 rows were written?

Document each identified risk as an elephant in the task card. Every elephant is an obstacle in Toyota Kata terms.

---

## Step 3 — Write the task card

Create the file at:
```
.mandala/inbox/__todo/{YYYYMMDD}/task-{gap-id}.md
```

Use `task-init.md` as the template. Fill in every section:

- **Status**: `IN PROGRESS`
- **Vibe Mode**: appropriate phase (`CREATION` for new features, `HARDENING` for fixes)
- **Context (The Elephants)**: one entry per risk identified in Step 2, with strategy and status
- **Execution Plan (Ralph's Ledger)**: tick-box list of every TDD cycle planned, with test class and method name pre-written
- **Live DEV Migration SQL**: write the exact `ALTER TABLE` or DDL change needed before any code is touched. If no schema change, write `-- No schema change required` explicitly.

### Tidy opportunity check (before writing cycles)

Run radon on every notebook the gap will touch:

```bash
radon cc src/notebooks/{notebook}.py -nc
```

**If any function in scope has CC > 10:**
Add a tidy cycle as the **first** entry in Ralph's Ledger, before any RED cycle:

```markdown
### Tidy Cycle — {function} (CC={N}, structural only — no behaviour change)
- [ ] Run `/tidy-first src/notebooks/{notebook}.py`
- [ ] Apply one structural move (extract helper / guard clause / explaining variable)
- [ ] COMMIT: `tidy({notebook}): [description]`
```

Economics filter — only add the tidy cycle if **all three** hold:
- The function will definitely change in this sprint
- The tidy reduces the risk or complexity of the RED/GREEN cycles
- We are not near the sprint deadline

If none of the functions in scope exceed CC 10, skip this — do not add a speculative tidy cycle.

### Execution Plan format

Each cycle is a Toyota Kata experiment. State the hypothesis before writing the test — this makes it clear what you expect to learn, not just what you expect to build.

```markdown
### Cycle N — [behaviour being tested]
**Actor**: {who benefits when this cycle is done}
**Hypothesis**: if we implement {function}, then {observable outcome} — measured by {assertion}
- [ ] 🔴 RED: `tests/test_{notebook}.py::Test{Class}::{method}` — [one-line description of what it asserts]
- [ ] 🟢 GREEN: implement `{function}` in `src/notebooks/{notebook}.py`
- [ ] 🔵 REFACTOR: [specific refactor target, or "none required"]
- [ ] COMMIT: `feat({notebook}): [description] [RED/GREEN/REFACTOR]`
**Learning**: [filled in after GREEN — did the hypothesis hold? what changed?]
```

Mark the walking-skeleton cycle with `🦴` — it must be Cycle 1 or the earliest cycle that delivers end-to-end observable value.

---

## Step 4 — Confirm and surface

Output:
1. The path to the created task card
2. A one-paragraph summary of the elephants found
3. The migration SQL block (or explicit "no schema change")
4. A count of planned TDD cycles
5. ADR status: **EXISTING** (file path) | **REQUIRED — NOT YET WRITTEN** (next number + title) | **NOT REQUIRED**

If an ADR is required but missing, state this explicitly:
> ⚠️ ADR-0NN must be written and committed before the first implementation commit.
> Run `/run-sprint {gap-id}` — it will check for the ADR before allowing code to be written.

**Do not proceed to any implementation.** Hand off to `/run-sprint` when the developer is ready to execute.
