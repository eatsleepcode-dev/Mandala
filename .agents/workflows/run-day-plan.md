---
name: run-day-plan
description: Execute the next task from today's day plan
vibe: HARDENING
triggers: []
---

# /run-day-plan

Execute the next pending task from today's structured day plan.

## Usage

```
/run-day-plan
/run-day-plan <task-id>   # jump to a specific task, e.g. A1 or B2
```

---

## Steps

### Step 0 — Locate today's plan

1. Calculate today's date as `YYYYMMDD`.
2. Read `.mandala/inbox/__todo/<YYYYMMDD>/__plan-for-the-day.md`.
   - If the file does not exist, stop and tell the user: "No day plan found at `.mandala/inbox/__todo/<YYYYMMDD>/__plan-for-the-day.md`. Run `/day-plan` first."
3. Parse all tasks in priority order: **A** (critical) → **B** (important) → **C** (nice-to-have).

### Step 1 — Select the target task

- If `<task-id>` argument was provided, select that task.
- Otherwise, select the **first** task that is still `⬜ TODO` (not `✅ DONE` or `⏭ SKIP`), respecting A→B→C order.
- If all tasks are done/skipped, tell the user: "All tasks in today's plan are complete. 🎉"

### Step 2 — Identify dispatch target

Read the task block for a `> **Invoke:**` annotation line, e.g.:

```markdown
> **Invoke:** /run-sprint GAP-08
> **Invoke:** /build-sprint GAP-09 sprint-8
> **Invoke:** /write-adr Bronze profiling strategy GAP-07
> **Invoke:** inline
```

- If `> **Invoke:**` is present and not `inline`, execute that slash command with any listed arguments.
- If `> **Invoke:** inline` or no annotation, execute the task description directly as instructions.

### Step 3 — Execute

Run the dispatched command or inline instructions. Agent operates in **HARDENING** mode:
- Execute freely within the task scope.
- **Stop** before crossing task boundaries, writing to shared state, or pushing.

### Step 4 — Auto-tick on completion

When the task is done:

1. In `__plan-for-the-day.md`:
   - Replace `⬜ TODO` → `✅ DONE (<sha>)` on the task header line, where `<sha>` is the current HEAD short SHA after the commit.
   - Replace `[ ]` → `[x]` on any sub-checklist items that were completed.

2. Commit the tick:
   ```
   git add .mandala/inbox/__todo/<YYYYMMDD>/__plan-for-the-day.md
   git commit -m "chore(plan): tick task <task-id> [skip ci]"
   ```

### Step 5 — HITL: continue?

Ask the user:

```
Task <task-id> complete ✅

Next task: <task-id+1> — <title>

Continue? [y / n / stop]
  y     → run next task immediately
  n     → stop here, you decide what to do next
  stop  → stop and run /chat-handoff
```

If the user responds `stop`, run `/chat-handoff` automatically.

---

## Rules

- Never skip a HITL gate that the dispatched workflow would normally require.
- Never mark a task DONE unless Step 3 actually completed without errors.
- If the dispatched command exits with an error or HITL block, leave the task as `⬜ TODO` and report the blocker.
- Do not auto-continue beyond the current task without explicit `y` confirmation.
