---
description: Close a completed sprint — update the register, record carryover, close resolved TDs, raise new TDs for deferred items.
---

# Sprint Close

**Vibe Mode**: GATEKEEPER

Runs after `/run-sprint` has confirmed all quality gates pass. Updates every
tracking artefact so the next sprint starts with an accurate picture.

---

## Inputs

| Input | Description |
|---|---|
| `sprint-N` | Sprint number (e.g. `sprint-1`) |

---

## Step 1 — Read the sprint artefacts

Locate and read all three:
1. Sprint plan: `.agents/sprints/plans/sprint-0N-*.md`
2. Task card(s): `.agents/sprints/task-cards/task-{gap-id}.md` for every gap in the sprint
3. Sprint register: `.agents/SPRINT_REGISTER.md`

---

## Step 2 — DoD audit

For every deliverable in the sprint plan's **Definition of Done**, classify each item:

| Classification | Meaning | Action |
|---|---|---|
| ✅ Done | All criteria met, tests green, gate passed | Tick it |
| 🔁 Carryover | Partially done or blocked by external dependency | Record in carryover section |
| ❌ Dropped | Descoped — not relevant or superseded | Log reason, raise TD if still owed |
| 🆕 New TD | Discovered during sprint, not in original scope | Raise in `TECH_DEBT.md` |

---

## Step 3 — Update sprint plan status

In the sprint plan file frontmatter, update:

```yaml
status: complete
completed_date: YYYY-MM-DD
score_actual: NNN        # real score after sprint (may differ from estimate)
carryover: []            # list of items moved forward, or empty
tds_raised: []           # new TD refs raised this sprint
tds_closed: []           # existing TD refs resolved this sprint
```

---

## Step 4 — Update SPRINT_REGISTER.md

In `.agents/SPRINT_REGISTER.md`:

1. Change the sprint row `Status` → `COMPLETE`
2. Fill in `Completed` date
3. Fill in `Carryover` column — brief description of what moved forward
4. Update `Score Before → After` with the actual score if it differed from estimate
5. For the next sprint row: change its `Status` from `BLOCKED: Sprint N` → `READY` if its blocker is now resolved

---

## Step 5 — Carryover handling

For each carryover item, determine the correct destination:

**Option A — Add to next sprint**
If the item is a continuation of the same gap, add it to the next sprint plan's
deliverables section under `## Carryover from Sprint N`. Update the next sprint
plan file with the specific tasks that remain.

**Option B — Raise as tech debt**
If the item is standalone, optional, or will not be picked up in the immediate
next sprint, raise it as a TD item instead. Run `/tech-debt raise` with:
- TD title
- The sprint that deferred it
- Why it was deferred
- Suggested sprint to address it

Do not leave carryover items undocumented. Every deferral is either in a sprint
plan or in tech debt — never just "dropped".

---

## Step 6 — Tech debt lifecycle

### Close resolved TDs

For any TD in `TECH_DEBT.md` whose resolution was delivered in this sprint:
1. Set `**Resolved:** {date} ✅`
2. Set `**Status:** ✅ Done`
3. Add `**Resolved by Sprint:** N`
4. Add a brief resolution note under `### Resolution`

### Raise new TDs

For any item discovered or deferred during the sprint that is not carryover:
Use the standard format (see `.agents/workflows/tech-debt.md`). Minimum fields:

```markdown
## TD-NNN · {title}

**Severity:** Low | Medium | High
**Raised:** {date}
**Raised by sprint:** N
**Status:** 🔲 Open

### Problem
{one paragraph}

### Suggested resolution
{approach}

### Acceptance criteria
- [ ] {specific, testable criterion}
```

---

## Step 7 — Update task card(s) and archive story maps

For each task card in this sprint:
- Set `**Status**: COMPLETE`
- Tick all completed items in Ralph's Ledger
- Add a final iteration log entry:

```markdown
- **Sprint close {date}**: All DoD items ✅. Carryover: {none | list}. TDs raised: {none | refs}. TDs closed: {none | refs}.
```

Then archive story map artefacts for the same gap(s):
- Find `.mandala/inbox/__todo/*/story-map-{gap-id}.md`
- Find `.mandala/inbox/__todo/*/story-map-{gap-id}.html`
- Ensure `.agents/sprints/story-maps/` exists (create if missing)
- Move both files to `.agents/sprints/story-maps/` and keep the date prefix in the filename if there are naming collisions
- If a story map is missing, note that explicitly in the sprint close log instead of failing silently

---

## Step 8 — Lessons → Guardrails (Tidy Pass)

Run `/lessons-to-guardrails` to process any lessons written during the sprint:

1. Scan `.agents/LESSONS.md` for `PENDING` entries
2. Classify any unclassified lessons (A/B/C/D)
3. Apply tidyings that are < 30 min as separate `tidy: L-NNN` commits
4. Log anything > 30 min as a TD item
5. Run `py -m pytest tests/ -q --tb=no` to confirm tidyings did not break anything

Lessons without a committed guardrail or a TD item by sprint close are carry-over
debt. Do not close the sprint until all PENDING lessons have a Status update.

See `docs/lessons-to-guardrails.md` for the full classification guide.

---

## Step 8b — Unblock next sprint

Check `.agents/SPRINT_REGISTER.md`. If the sprint just completed was the blocker
for one or more future sprints, update those rows from `BLOCKED: Sprint N` → `READY`.

If the next sprint is now `READY` and its task card does not yet exist:
> Suggest running `/build-sprint {gap-id}` for its primary gap.

---

## Step 9 — Update and validate CHANGELOG.md

### 9a — Write the sprint entry

In `CHANGELOG.md` at the repo root:

1. Move the sprint's deliverables out of `[Unreleased]` (remove the `### Planned — Sprint N` block if one exists there).
2. Add a new dated section immediately below `[Unreleased]`:

```markdown
## [Sprint N] — YYYY-MM-DD

{one-line sprint title, e.g. "OpenMetadata integration (GAP-11). ADR-052."}

### Added
- {each new notebook, DDL column, config row, script, or doc — one bullet per item}

### Changed
- {each modification to existing behaviour}

### Fixed
- {each bug fix}

### Removed
- {each deletion of dead code, deprecated path, or superseded feature}
```

Rules:
- Only include sections (Added / Changed / Fixed / Removed) that have entries — omit empty ones.
- Source content from the task card's Ralph's Ledger `[x]` items — do not re-read the full diff.
- Keep bullets concise: function name + what it does, not how.
- Do not include internal refactors, noqa passes, or version bumps unless they affect observable behaviour.

### 9b — Validate: no missing entries

After writing the sprint entry, run a full consistency check between `CHANGELOG.md` and `SPRINT_REGISTER.md`.

**Check 1 — Every COMPLETE sprint has a CHANGELOG section**

Read `.agents/SPRINT_REGISTER.md`. For every row whose `Status` is `COMPLETE`, confirm that `CHANGELOG.md` contains a matching `## [Sprint N]` heading. List any that are absent.

**Check 2 — Every CHANGELOG sprint section has a SPRINT_REGISTER row**

For every `## [Sprint N]` heading in `CHANGELOG.md`, confirm a matching row exists in `SPRINT_REGISTER.md`. Flag any orphans (changelog entry with no register row).

**Check 3 — Task card coverage**

For every `[x]` line in the closing sprint's Ralph's Ledger, confirm there is at least one corresponding bullet in the new `## [Sprint N]` section. List any ledger items that have no CHANGELOG representation.

Carryover items (`🔁`) and internal-only items (linting passes, noqa, version bumps) are exempt from Check 3 — note them as explicitly excluded rather than missing.

**Check 4 — [Unreleased] hygiene**

Confirm the `[Unreleased]` section still exists and contains at least the next planned sprint block. If it is empty or the sprint that was just closed was the last planned entry, flag it so a new planned block can be added.

**Output format for validation**

Print a summary table:

| Check | Result | Detail |
|---|---|---|
| 1 — COMPLETE sprints have entries | ✅ / ❌ N missing | list sprint numbers |
| 2 — CHANGELOG entries have register rows | ✅ / ❌ N orphans | list sprint numbers |
| 3 — Task card items covered | ✅ / ❌ N uncovered | list ledger items |
| 4 — [Unreleased] has future content | ✅ / ⚠️ empty | — |

If any check is ❌, do not proceed to Step 10. Fix the gap first, then re-run the validation table.

---

## Step 10 — Refresh agent-guide snapshot

Before committing, refresh the tech debt snapshot in `__guides/agent-guide.html`:
- Parse `.agents/TECH_DEBT.md` open items (same Python snippet used at creation time)
- Rewrite the counts card (HIGH / MED / LOW / OPEN numbers)
- Rewrite the snapshot table (open items only, sorted by severity)
- Update the snapshot timestamp to the current date-time

---

## Step 11 — Commit

```bash
git add .agents/SPRINT_REGISTER.md \
        .agents/TECH_DEBT.md \
        .agents/sprints/task-cards/task-{gap-id}.md \
        .agents/sprints/story-maps/story-map-{gap-id}.md \
        .agents/sprints/story-maps/story-map-{gap-id}.html \
        .agents/sprints/plans/sprint-0N-*.md \
        CHANGELOG.md \
        __guides/agent-guide.html

git commit -m "chore: sprint N close — {title}; score {before} → {after}"
```

---

## Close summary output

At the end, print:

```
Sprint N — CLOSED
────────────────────────────────────
Score:     {before} → {actual} ({delta:+d} pts)
Delivered: {N} of {M} DoD items
Carryover: {list or "none"}
TDs raised: {list or "none"}
TDs closed: {list or "none"}
Next sprint: Sprint N+1 — {status}
ADRs committed: {list or "none"}
────────────────────────────────────
```

---

## Step 11 — Post-close context reset

**This step is mandatory. Do not start Sprint N+1 in the same session.**

All sprint artefacts are now in git. The task card, CHANGELOG entry, and commit
history do not need to ride along into the next session.

1. Run `/chat-handoff` — this generates the ready-to-paste handoff note with live
   values from git, the test baseline, and the sprint register.
2. Copy the output note.
3. Start Sprint N+1 in a fresh session and paste the note as the first message.

**Tool-specific:**
- **Claude Code**: `/compact` then start new session
- **VS Code Copilot**: open a new chat, paste handoff note
- **Gemini**: start a new conversation, paste handoff note
