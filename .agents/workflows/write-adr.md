---
description: Scaffold a new Architecture Decision Record with the correct next number, standard structure, and status gate. Run this before /build-sprint when an ADR is required.
---

# Write ADR

**Vibe Mode**: CREATION (documentation only — no implementation code)

Produces `docs/adr/ADR-0NN-{slug}.md` and updates `docs/adr/README.md`.
An ADR must have status `Accepted` before the first implementation commit of the sprint that requires it.

---

## Inputs

| Input | Description |
|---|---|
| `title` | Short human-readable decision title (e.g. "Bronze profiling strategy using whylogs") |
| `gap-id` | The gap this ADR gates (e.g. `GAP-07`) — used to link back to the task card |

---

## Step 1 — Determine the next ADR number

```powershell
Get-ChildItem docs/adr/ADR-0*.md | Sort-Object Name | Select-Object -Last 1
```

Read the highest existing number (e.g. `ADR-053`). The new ADR number is that + 1 (e.g. `ADR-054`).

Cross-check `docs/adr/README.md` table — the last row's number must match the highest file.
If they diverge, use the higher of the two.

---

## Step 2 — Choose a filename slug

Slug rules:
- Lowercase, hyphens only, no special chars
- 3–7 words, specific enough to identify the decision
- Example: `adr-054-bronze-profiling-whylogs-contract.md`

Full path: `docs/adr/ADR-0NN-{slug}.md`

---

## Step 3 — Scaffold the ADR file

Create `docs/adr/ADR-0NN-{slug}.md` with this exact structure:

```markdown
# ADR-0NN — {Title}

**Status**: Proposed
**Date**: {YYYY-MM-DD}
**Deciders**: Data Platform Team
**Gap**: {gap-id}

---

## Context

{2–4 sentences describing the problem, constraint, or decision point.
What existing code or architecture is this decision about?
What alternatives are on the table?}

---

## Decision

{1–3 sentences. State the decision clearly and unambiguously.
"We will use X because Y."}

---

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **{Chosen option}** | {pros} | {cons} |
| {Alternative 1} | {pros} | {cons} |
| {Alternative 2} | {pros} | {cons} |

---

## Consequences

**Positive:**
- {bullet}

**Negative / trade-offs:**
- {bullet}

**Neutral:**
- {bullet}

---

## Implementation Notes

{Optional: specific files, functions, or config keys affected.
Reference the task card or sprint plan if relevant.}
```

---

## Step 4 — Add to README catalog

Open `docs/adr/README.md` and append a new row to the catalog table:

```markdown
| [ADR-0NN](ADR-0NN-{slug}.md) | {Title} | **Proposed** |
```

Keep the table sorted by ADR number.

---

## Step 5 — Update the task card

If a task card exists for the gating gap (e.g. `.mandala/inbox/__todo/{date}/task-{gap-id}.md`):
- Update the `adr_required` frontmatter field from `STATUS: MISSING` to the actual file path
- The ADR Cycle checklist in the task card body should reference the new file path

---

## Step 6 — Commit

```bash
git add docs/adr/ADR-0NN-{slug}.md docs/adr/README.md
git commit -m "docs(adr): ADR-0NN — {title}"
```

Commit message format: `docs(adr): ADR-0NN — {exact title from H1}`

---

## Step 7 — Promote to Accepted

After team review (or immediately if the decision is unambiguous and uncontested):

1. Change `**Status**: Proposed` → `**Status**: Accepted` in the ADR file
2. Change `**Proposed**` → `**Accepted**` in the `docs/adr/README.md` row
3. Commit: `docs(adr): ADR-0NN accepted`

**An ADR must be `Accepted` before `/build-sprint` will proceed with implementation cycles.**

---

## Gate: verify before /build-sprint

Before running `/build-sprint` for any gap with `adr_required`:

```powershell
# Verify the ADR file exists
Test-Path "docs/adr/ADR-0NN-{slug}.md"

# Verify it is Accepted (not Proposed)
Select-String "Status.*Accepted" "docs/adr/ADR-0NN-{slug}.md"
```

If either check fails: the ADR is not ready. Do not start implementation.
