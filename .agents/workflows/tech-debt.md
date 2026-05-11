---
description: Raise, close, or query tech debt items in TECH_DEBT.md.
---

# Tech Debt Workflow

Manages the lifecycle of tech debt items: raising new ones, closing resolved ones,
and querying open items by severity or sprint.

---

## Actions

| Action | When to use |
|---|---|
| `raise` | A sprint deferred something; a roast or sniff test found a systemic issue; a known limitation is accepted deliberately |
| `close` | A sprint delivered the fix; a TD is no longer relevant |
| `query` | "What tech debt is open?" / "What's blocking sprint N?" |

---

## Action: raise

### When to raise a TD (not everything is tech debt)

Raise a TD when:
- A sprint explicitly deferred an improvement (carryover that won't be in the next sprint)
- A roast or sniff test found a structural problem that is out of scope for the current sprint
- A known limitation is accepted deliberately (e.g. N+1 query, no retry on a best-effort path)
- A `C90` ruff complexity violation exists in a pre-existing function changed by the sprint
- An ADR describes a known trade-off with a mitigation that has not yet been implemented

Do **not** raise a TD for:
- Things that will be fixed in the current sprint's REFACTOR cycle
- Normal code review comments that should be a PR comment, not permanent debt
- Vague "we should improve this someday" notes without a concrete problem statement

### Raising format

Determine the next TD number:
```bash
grep "^## TD-" .agents/TECH_DEBT.md | tail -1
```

Add at the bottom of `.agents/TECH_DEBT.md`:

```markdown
## TD-NNN · {short imperative title}

**Severity:** Low | Medium | High
**Raised:** {YYYY-MM-DD}
**Raised by sprint:** {N} | manual
**Status:** 🔲 Open
**Suggested sprint:** {N or "backlog"}

### Problem
{One paragraph: what breaks, what's fragile, or what the limitation is.
Be specific — name the function, the table, the API surface.}

### Suggested resolution
{Concrete approach. Name the file and function that would change.}

### Acceptance criteria
- [ ] {Specific, testable criterion — something that can be ticked when done}
- [ ] {Add more if needed}
```

After adding:

1. Refresh the agent-guide snapshot — parse `TECH_DEBT.md` open items and update the counts + table in `__guides/agent-guide.html` (section id `tech-debt-ref`). Update the snapshot timestamp to current date-time.

2. Commit everything together:
```bash
git add .agents/TECH_DEBT.md __guides/agent-guide.html
git commit -m "chore(td): raise TD-NNN — {title}"
```

---

## Action: close

### When to close

Close a TD when:
- The sprint's DoD includes it and all acceptance criteria are met
- The underlying problem no longer exists (architecture changed, feature removed)
- The item was superseded by a broader change that resolved it as a side effect

### Closing steps

1. Find the TD entry in `.agents/TECH_DEBT.md`
2. Add below the `**Status:**` line:

```markdown
**Resolved:** {YYYY-MM-DD} ✅
**Status:** ✅ Done
**Resolved by sprint:** {N}
```

3. Add a `### Resolution` section after `### Acceptance criteria`:

```markdown
### Resolution
{One paragraph: what was done and where. Name the commit or PR if helpful.}
```

4. Tick all acceptance criteria checkboxes: `- [x]`

5. Refresh the agent-guide snapshot:

   Run the snapshot refresh command:
   ```bash
   py scripts/refresh_td_snapshot.py
   ```
   If that script does not exist yet, the agent should update the tech debt section of `__guides/agent-guide.html` directly using the same Python snippet used to generate it (parse `TECH_DEBT.md` open items and rewrite the counts + table in the HTML).

6. Commit everything together:
```bash
git add .agents/TECH_DEBT.md __guides/agent-guide.html
git commit -m "chore(td): close TD-NNN — {title}"
```

---

## Action: query

### Open items

```bash
grep -A4 "^## TD-" .agents/TECH_DEBT.md | grep -v "✅ Done" | grep "^## TD-\|Status"
```

### Open by severity

```bash
grep -B1 "🔲 Open" .agents/TECH_DEBT.md | grep "Severity\|TD-"
```

### Items suggested for a specific sprint

Replace `N` with the sprint number (e.g. `4`):

```bash
python3 -c "
import re
text = open('.agents/TECH_DEBT.md').read()
blocks = re.split(r'(?=^## TD-)', text, flags=re.MULTILINE)
sprint_n = 'N'
for b in blocks:
    if f'**Suggested sprint:** {sprint_n}' in b and '🔲 Open' in b:
        hdr = re.match(r'(## TD-[^\n]+)', b)
        sev = re.search(r'\*\*Severity:\*\* (\S+)', b)
        if hdr:
            print(f'{hdr.group(1)}  [{sev.group(1) if sev else \"?\"}]')
"
```

### All items (open and closed) summary

```bash
grep "^## TD-\|^\*\*Status" .agents/TECH_DEBT.md
```

---

## Severity guide

| Severity | Meaning | Typical suggested sprint |
|---|---|---|
| **High** | Causes silent data loss, security exposure, or production outage risk | Next sprint |
| **Medium** | Causes test fragility, performance degradation, or operational pain | Within 2 sprints |
| **Low** | Code quality, observability improvement, or nice-to-have hardening | Backlog |
