---
description: Convert retrospective lessons into structural guardrails using Kent Beck's Tidy First pattern. Classify each lesson (A/B/C/D), apply < 30-min tidyings as separate commits, defer larger fixes as tech debt items.
triggers:
  - "lessons to guardrails"
  - "tidy pass"
  - "apply lessons"
  - "tidy first"
  - "lessons learned"
  - "guardrail"
---

# Lessons → Guardrails

Run this at the end of every sprint, before the sprint is marked closed.

Full reference: `docs/lessons-to-guardrails.md`

---

## Step 1 — Scan for PENDING lessons

```powershell
Select-String -Path .agents/LESSONS.md -Pattern "PENDING"
```

---

## Step 2 — Classify any unclassified lessons

Every lesson must have `Guardrail-type` set. If missing, fill it now:

| Type | When |
|---|---|
| **A — Code** | Fix is a code/config/hook/test change |
| **B — Template** | Fix is updating a template, scaffold, or prompt |
| **C — Checklist** | Fix is adding a step to a process gate or DoD |
| **D — Knowledge** | Cannot be automated — accept and record |

---

## Step 3 — Triage each PENDING lesson (30-minute rule)

For each PENDING A, B, or C lesson:

```
< 30 min? → Apply as tidy commit NOW
            git commit -m "tidy: L-NNN <short description>"
            Update Status: ✅ APPLIED: <SHA>

> 30 min? → Create TD item
            Update Status: 📋 TD-NNN
```

Type D lessons: mark `✅ APPLIED: added to knowledge base` — no code change needed.

---

## Step 4 — Commit tidyings separately from features

```
CORRECT:
  git commit -m "tidy: L-101 add load_module() to conftest"
  git commit -m "feat: new notebook"

WRONG:
  git commit -m "feat: new notebook + conftest fix"
```

---

## Step 5 — Verify

Run the full test suite after all tidyings. A tidy that breaks a test is a bug — revert.

```powershell
py -m pytest tests/ -q --tb=no --timeout=60 2>&1 | Select-Object -Last 3
```

---

## Integration point in sprint close

This step belongs between "Lessons Learned" (Step 8) and "Tech Debt" (Step 9)
in `.agents/workflows/sprint-close.md`.

See `docs/lessons-to-guardrails.md` for the full classification guide, lesson
format template, examples, and the economic argument.
