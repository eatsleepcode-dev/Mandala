---
description: Build a Jeff Patton story map for a gap or feature area, with Toyota Kata framing for each activity. Produces story-map-{gap-id}.md and story-map-{gap-id}.html, then seeds the walking skeleton into /build-sprint.
---

# User Story Map

**Vibe Mode**: CREATION (discovery and planning only — no implementation code)

Produces two artefacts in `.mandala/inbox/__todo/{YYYYMMDD}/`:
- `story-map-{gap-id}.md` — narrative document (actors, stories, acceptance criteria, Toyota Kata)
- `story-map-{gap-id}.html` — interactive visual board for stakeholder review (Jeff Patton grid layout)

The story map is an input to `/build-sprint` — it answers WHO needs this and WHY before WHAT is built.

---

## Conceptual framework

### Jeff Patton — Story Mapping

A story map organises work as a two-dimensional grid:

```
Horizontal (Backbone) → Activities (what users DO, in narrative order)
    ↓ Tasks           → Steps within each activity
        ↓ Stories     → Specific, testable slices of behaviour
            ↓ Details → Edge cases, variations, error paths
```

**Key discipline**: the backbone is written from the user's perspective, not the system's. Activities are verbs the USER performs ("Configure test infrastructure", "Review a failure"), not what the system does internally.

**Walking skeleton**: the thinnest horizontal slice through ALL activities that delivers end-to-end value. Identifies the first sprint's scope. Below the skeleton: enhancements in priority order.

### Toyota Kata — Scientific Thinking

Every gap is framed as a scientific experiment, not a feature delivery:

| Kata element | Question | Where it appears |
|---|---|---|
| **Challenge** | Where do we want to be long-term? (hard, aspirational) | Gap header |
| **Current Condition** | Where are we now? (measurable facts, not opinions) | Before each sprint |
| **Target Condition** | Where do we want to be after this sprint? (measurable, achievable, time-boxed) | Task card header |
| **Obstacles** | What is preventing us from reaching the TC? | Pre-mortem / elephants |
| **Experiment** | Next step + hypothesis + expected result | Each TDD cycle |

The Target Condition is NOT the Challenge. It is the next measurable step on the path.

---

## Inputs

| Input | Description |
|---|---|
| `gap-id` | Gap reference (`GAP-NN`) or feature area name |
| `source` (optional) | Research file, ADR, or conversation to draw from |

---

## Step 0 — Sprint register check

Before doing anything else, check `.agents/SPRINT_REGISTER.md` (or `TECH_DEBT.md`) for the gap:

- **If the gap is COMPLETE**: note this; story map is retrospective only — confirm with the user before proceeding.
- **If the gap is IN PROGRESS**: a task card already exists. Confirm with the user whether this story map is supplementary or intended to replace the existing plan.
- **If the gap is BACKLOG / not found**: proceed.

This prevents producing a story map that conflicts with work already underway.

---

## Step 1 — State the Challenge (Toyota Kata)

First, locate the gap definition. Read sources in this order:

1. `.agents/ROADMAP.md` — gap items and one-line descriptions
2. `docs/adr/ADR-NNN-*.md` — if an ADR exists for this gap (listed in ROADMAP)
3. `.mandala/inbox/` research files — if referenced in the ADR (`**Source**:` field)
4. `.mandala/inbox/__todo/` sprint plans — for any prior framing

Then write a single sentence capturing the long-term aspiration for this gap area. It should be:
- Ambitious — not achievable in one sprint
- Outcome-oriented — describes a world state, not a system feature
- Testable in principle — you could eventually measure it

Example: *"Zero broken Power BI reports reach production; all DAX measure logic is independently validated against the Gold Lakehouse SQL source of truth before any report is published."*

---

## Step 1.5 — Context health check

This workflow is long (10 steps, reads multiple files, produces 400+ lines of output). Before continuing:

- If context is near capacity (>80% token budget), pause and summarise what has been gathered so far. Ask the user whether to continue in a new session or proceed with a compressed approach.
- If any source file was not found (ADR missing, ROADMAP entry absent), note it explicitly rather than proceeding on assumptions.

---

## Step 2 — Grasp the Current Condition (Toyota Kata)

Document the measurable state RIGHT NOW, before any work begins. Use facts, not feelings.

Format:
```
Current Condition — {gap-id} — {date}
- [Metric]: [value]    e.g. "Visual tests automated: 0 of N"
- [Metric]: [value]    e.g. "Test method: manual QA only"
- [Metric]: [value]    e.g. "Failure detection lag: reported by users"
- [Pain]: [observable symptom]
```

Avoid: "testing is poor", "quality is low". Write what you can count or observe.

---

## Step 3 — Identify the Actors

List every human role that interacts with the system this gap builds. For each actor, write one sentence: what they need to accomplish, and what currently frustrates them.

Format:
```
**{Role}**: {what they do} — currently frustrated by {specific pain}.
```

Example actors for a QA framework:
- Data Engineer (builds pipelines, runs tests)
- Power BI Developer (builds reports, fixes DAX)
- Platform Engineer (monitors, governs, costs)
- IT Consultant / Reviewer (approves fixes, reviews audit logs)

---

## Step 4 — Build the Backbone (Activities)

Write the narrative of what USERS DO, in time order, from left to right. Each activity is a verb phrase from the user's perspective.

Rules:
- 5–9 activities maximum — if more, collapse or split the gap
- Activities are user actions, not system steps ("Configure test infrastructure" not "System parses PBIP files")
- Time order matters — the backbone tells a story when read left to right

Format:
```
A1: [Activity Name]
A2: [Activity Name]
...
```

---

## Step 5 — Map Tasks under each Activity

Under each Activity, list the specific TASKS a user performs. Tasks are more granular than activities — they are the steps within the activity.

Format:
```
A1: [Activity]
  T1.1: [Task]
  T1.2: [Task]
  T1.3: [Task]
```

---

## Step 6 — Write User Stories

Under each Task, write 1–3 User Stories as observable, testable slices. Each story:

**Format:**
```
US-NNN: As a {actor}, I want to {action} so that {outcome — the WHY}.
  Acceptance criteria:
  - [ ] {observable, binary outcome — passes or fails, no ambiguity}
  - [ ] {observable, binary outcome}
  Toyota Kata: Experiment hypothesis — if we implement this, we expect {measurable result}.
```

**Story writing rules (Patton discipline):**
- The "so that" clause is mandatory — it states the WHY and prevents building the wrong thing
- Acceptance criteria must be observable without running the system in your head ("the QA_Test_Executions table contains a row" not "the test runs correctly")
- Prefer small stories — if a story has >3 acceptance criteria, split it

**Toyota Kata discipline per story:**
- Each story is one experiment toward the Target Condition
- State the hypothesis explicitly: "if we build this, the current condition changes from X to Y"
- This prevents building stories that don't move the measurable needle

---

## Step 7 — Identify the Walking Skeleton

Select the minimum set of stories — one from each activity — that delivers end-to-end value. The walking skeleton:
- Touches every activity at least once
- Delivers something a real user can observe end-to-end
- Is the scope of the FIRST sprint; everything below it is prioritised enhancement

Mark each skeleton story with `🦴 SKELETON`.

**The skeleton must include one story from EVERY activity in the backbone** — if an activity has no skeleton story, add the thinnest possible slice (even if it is just a stdout print or a stub function) before proceeding.

The walking skeleton is the first Target Condition for Toyota Kata purposes.

---

## Step 8 — Set the Target Condition for Sprint 1

Using Toyota Kata framing, write the measurable state the system will be in when the walking skeleton stories are complete:

```
Target Condition — Sprint N — {date}
- [Metric]: [target value]    e.g. "Visual tests automated: ≥1 baseline test end-to-end"
- [Metric]: [target value]    e.g. "Test result destination: QA_Test_Executions Delta table"
- [Observable]: [what a user can see/do that they cannot today]
- Threshold: if variance |V_ui − V_sql| > ε (default 0.01), test is FAILED
```

The Target Condition is the input to `/build-sprint` — Step 0.5 (Mom Test) in that workflow maps directly onto these measurable outcomes.

---

## Step 8.5 — Idempotency check

Before writing the document, check whether `.mandala/inbox/__todo/*/story-map-{gap-id}.md` already exists:

- **If it does not exist**: proceed to Step 9.
- **If it already exists**: read the existing file, then ask the user:
  - "Update in place" — overwrite with the new version
  - "Append" — add a dated revision section at the bottom
  - "Cancel" — stop; no file is written

Do not silently overwrite an existing story map.

---

## Step 9 — Write the story map document

Create:
```
.mandala/inbox/__todo/{YYYYMMDD}/story-map-{gap-id}.md
```

Document structure:

```markdown
# Story Map — {gap-id}: {title}
**Date**: {YYYY-MM-DD}
**ADR**: {ADR-NNN if applicable}
**Actors**: {comma-separated list}

## Actors
{one sentence per actor — what they do and what frustrates them}

## Challenge (Toyota Kata)
{one sentence — long-term aspiration}

## Current Condition — {gap-id} — {date}
{bulleted measurable facts}

## Target Condition — Sprint N
{bulleted measurable outcomes — walking skeleton complete}

## Story Map

### Backbone
| A1 | A2 | A3 | ... |
|---|---|---|---|

### Stories by Activity

#### A1: {Activity Name}
{tasks and stories}

...

## Walking Skeleton
| Story | Activity | Actor | Hypothesis |
|---|---|---|---|
| US-NNN 🦴 | A1 | {actor} | {experiment hypothesis} |
...

## Backlog (below the skeleton — prioritised)
{remaining stories in priority order}
```

---

## Step 9.5 — Generate the HTML visualisation

After the `.md` document is written, generate a companion HTML story map in the **same directory**:

```
.mandala/inbox/__todo/{YYYYMMDD}/story-map-{gap-id}.html
```

The HTML file is the primary visual artefact — it is opened in the browser to review the story map with stakeholders and to show as a status board.

### HTML structure

```
header          — title, ADR ref, sprint scope, baseline test count
actors-bar      — actor pills (colour-coded)
legend          — card type swatches + 🦴 / cycle badge key
map-container
  backbone       — 7 activity columns (dark navy headers)
  skeleton-stripe — walking skeleton stories (green)
  sprint-stripe   — non-skeleton sprint stories (blue)
  backlog-stripe  — future sprint stories (grey), deferred stories (red)
kata-box        — Toyota Kata challenge + current→target condition
footer          — generated date, ADR, rev, story count
```

### Card types and CSS classes

| Class | Colour | When to use |
|---|---|---|
| `card-skeleton` | Green (`#d4eddf`) | Story in the walking skeleton AND in the current sprint |
| `card-sprint` | Blue (`#dbeaf8`) | In the current sprint but not the skeleton |
| `card-backlog` | Grey (`#ebebf0`) | Future sprints |
| `card-deferred` | Red (`#fde8e6`) | Blocked by unprovisioned infrastructure (label with 🚫 reason) |

**Unblocked**: when a previously-deferred dependency is resolved (e.g. Foundry provisioned), convert the card from `card-deferred` to `card-backlog` with a green left border (`border-left:3px solid #27ae60`) and a ✅ badge in the `card-id`. Update the footer rev number.

### Card anatomy

```html
<div class="card card-skeleton">
  <div class="card-id">US-NNN <span class="bone">🦴</span>
    <span class="cycle-badge skeleton-badge">C1</span>
  </div>
  <div class="card-title">Short action title</div>
  <div class="card-actor">Actor Name</div>
</div>
```

- `card-id` — US number, optional 🦴 bone emoji, optional cycle badge
- `card-title` — one short phrase (5–8 words)
- `card-actor` — actor role name

### Skeleton stripe rules

The skeleton stripe (`skeleton-stripe`) must have **one card per activity column**. If a skeleton story is deferred (dependency unprovisioned), show it as `card-backlog` with `✅ Foundry` or similar label — it is unblocked for future sprints but not in the current cycle; do **not** show it as `card-deferred` (the resource is available, just not in this sprint's scope).

### Sprint stripe rules

Non-skeleton sprint stories appear in the `sprint-stripe`. Empty columns (`<div class="col"></div>`) are valid where an activity has no non-skeleton sprint stories.

### Backlog stripe rules

Group all remaining stories by activity column. Deferred stories (genuinely blocked by missing infrastructure) appear here as `card-deferred` with a 🚫 label explaining the blocker.

### Footer

```html
<div style="padding:16px 32px;font-size:0.72rem;color:#888;">
  Generated {YYYY-MM-DD} · Data Platform · {ADR-NNN} · Story map rev N
  · {N} user stories total ({N} in Sprint {S}, {N} backlog)
  [· ✅ {dependency} provisioned {YYYY-MM-DD}: {resource} / {model} / {sdk}]
</div>
```

Increment `rev N` each time the HTML is regenerated. Append a ✅ note for each dependency resolved since the first generation.

### Reference implementation

The canonical example for this workflow is:

```
.mandala/inbox/__todo/20260509/pbi-qa-story-map.html   ← PBI-QA (ADR-061, Sprint 20)
```

Study this file when generating HTML for a new gap — copy the CSS block verbatim; only the card content and stripe contents change.

---

## Step 10 — Hand off to /build-sprint

After the story map is written and reviewed (HITL), pass the walking skeleton stories as the Ralph's Ledger input to `/build-sprint {gap-id}`.

In the task card, the **Target Condition** section (from Step 8) replaces the generic "scope" description. Each TDD cycle maps to one story's acceptance criteria.

The pre-mortem in `/build-sprint` Step 2 maps to Toyota Kata **Obstacles** — what is preventing us from reaching the Target Condition?

**Archiving**: both the `.md` and `.html` story map files remain in `.mandala/inbox/__todo/{YYYYMMDD}/` until the sprint closes. On `/sprint-close`, if the task card is archived to `.agents/sprints/task-cards/`, archive both files to `.agents/sprints/story-maps/` at the same time. If no corresponding directory exists, create it.
