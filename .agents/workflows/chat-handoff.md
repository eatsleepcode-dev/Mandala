---
description: Generate a chat handoff note — ready to paste as the first message of a new AI session. Gathers live values from git, tests, and sprint register. Run at end of any session before closing.
triggers:
  - "chat handoff"
  - "chat handover"
  - "handoff note"
  - "new session"
  - "start fresh"
  - "reset session"
---

# Chat Handoff

Generates a self-contained handoff note to paste as the first message in a new
chat session. The note must be sufficient to resume work without reading any
files — the receiving session should be able to run `/build-sprint` or
`/run-sprint` immediately.

---

## Step 1 — Gather live values

Run the following commands to collect the values needed for the handoff note.

```powershell
# Branch and HEAD
git branch --show-current
git log --oneline -1

# Test baseline (last clean run — do not re-run if already clean this session)
py -m pytest tests/ -q --tb=no --timeout=60 2>&1 | Select-Object -Last 3

# Open HIGH tech debt
Select-String -Path .agents/TECH_DEBT.md -Pattern "HIGH" | Measure-Object | Select-Object -ExpandProperty Count

# Last closed sprint (number + title)
Select-String -Path .agents/SPRINT_REGISTER.md -Pattern "COMPLETE" | Select-Object -Last 1

# Next planned sprint
Select-String -Path .agents/SPRINT_REGISTER.md -Pattern "PLANNED" | Select-Object -First 1
```

---

## Step 2 — Identify what was done this session

Summarise in 1–4 bullets. Source from:
- `git log --oneline` since the session start commit
- Completed todo items from this session
- Any gate results that were run

Keep each bullet to one line: `{notebook/file} — {what changed}`.

---

## Step 3 — Identify open items

Check for anything that was started but not committed, or explicitly deferred:
- Uncommitted changes: `git status --short`
- Deferred scope from task card iteration log
- Any gate that was skipped or flagged

---

## Step 4 — Output the handoff note

Print the following block, with all `{placeholders}` filled in from Steps 1–3.
The note must be self-contained — no file reads required to interpret it.

```
Branch: {branch} | HEAD: {hash} | {date}

## Handoff — Sprint {N} {CLOSED|IN PROGRESS}

**Repo:** {absolute path to repo root}
**Last sprint:** Sprint {N} — {title} — {COMPLETE|IN PROGRESS}
**Commits this session:** {first hash}..{HEAD hash}

## Baseline
- Tests: {N} passed, {N} skipped
- Ruff: {clean|N violations}
- mypy: {clean|N errors}
- gitleaks/bandit: {clean|flagged}

## Delivered this session
- {bullet 1}
- {bullet 2}
...

## Open items
- {any deferred scope, uncommitted work, or skipped gates — or "none"}

## Next task
{Sprint N+1 title and gap-id if known}
Run `/build-sprint {gap-id}` to generate the task card.
```

---

## Step 5 — Verify completeness

Before presenting the note, check:

- [ ] HEAD hash is current (matches `git log --oneline -1`)
- [ ] Test count is from a clean run this session (not a stale number)
- [ ] "Next task" is specific — not just "Sprint 13" but the actual title and command
- [ ] "Open items" is honest — do not write "none" if there is uncommitted work

---

## Step 6 — Write the handoff to file

After presenting the note to the user, write it to `.agents/handoffs/`.
This creates a persistent history trail and allows the next session to
read the last handoff without any user input.

```powershell
# Filename: YYYY-MM-DD_HHMMSS_<branch>_<shorthash>.md
$ts  = Get-Date -Format "yyyy-MM-dd_HHmmss"
$br  = git branch --show-current
$sha = git log --oneline -1 --format="%h"
New-Item -ItemType Directory -Force -Path .agents/handoffs | Out-Null
$path = ".agents/handoffs/${ts}_${br}_${sha}.md"
# Write the handoff note (the block from Step 4) to $path
Set-Content -Path $path -Value $handoffNote
git add $path
git commit -m "chore(handoff): session handoff ${sha} [skip ci]"
```

**Reading the last handoff** (use at the start of a new session):

```powershell
Get-ChildItem .agents/handoffs/ | Sort-Object Name | Select-Object -Last 1 | Get-Content
```

---

## Notes

**Minimum viable handoff** (when session was short / single task):
```
Branch: {branch} | HEAD: {hash} | {date}
Did: {one line}
Next: {one line}
Tests: {N} passed
```

**Do not include in the handoff note:**
- Full file contents or diffs
- Long gate output
- Conversation history summaries
- Content already committed to git (the receiving session can read it)

The receiving session has access to the full git history and all files.
The handoff note is orientation, not documentation.
