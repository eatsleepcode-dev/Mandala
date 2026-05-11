---
description: Pre-Mortem — test planning assumptions before executing any complex change (complexity > 5).
---

# Pre-Mortem — data-platform

**When to run**: Before executing any multi-notebook schema change, new connector, or pipeline refactor.

---

## Steps

### 1. Imagine the Failure

> "It's one week from now. The change has shipped to DEV and it is broken. Pick your poison — which of these caused it?"

**A) Technical Mismatch**
- DDL was updated but a connector still SELECTs the old column name
- INSERT statement has wrong column count (positional VALUES mismatch)
- AST syntax check wasn't run — SyntaxError on first notebook execution
- Live DEV Delta table never had the ALTER TABLE run — schema mismatch at runtime

**B) Data Contract Break**
- Pydantic model accepts a value the connector rejects (e.g. empty LandingFileFormat)
- `_validate_with_fallback` and Pydantic path have diverged — different validation rules
- `PYDANTIC_AVAILABLE = False` path silently skips a required field check

**C) Integration Failure**
- `nb_bootstrap.py` not re-run after DDL change — old table definition still in place
- Connector ran before bootstrap — table missing
- Watermark advanced even though no rows were written — incremental load skips data forever
- `nb_landing_to_bronze.py` reads wrong `LandingFileFormat` because LIMIT 1 has no ORDER BY and returns wrong row

### 2. Pick the Most Likely Failure Mode

Ask yourself or the user: "Which of A, B, or C is most likely for this specific change?"

### 3. Update the Task Card

Add a `## Pre-Mortem Risks` section to the `task-init.md` card:

```markdown
## Pre-Mortem Risks

- **[Risk Category]**: [What breaks] → [Verification step to add]
```

### 4. Add Verification Steps

For each identified risk, add a specific `[ ]` check to the Gatekeeper phase of the task card.

---

## Quick Checklist

Before any schema change:

- [ ] Which notebooks SELECT the changed columns? (grep for column name)
- [ ] Which INSERTs are positional? (count VALUES vs column count)
- [ ] Does the view `vw_EntityIngestionConfig` need updating?
- [ ] Is there a live DEV migration SQL to run?
- [ ] Does `nb_bootstrap.py` need to run first?
- [ ] Will existing watermark records still be valid after the change?

```powershell
# Quick grep — find all references to a column name across notebooks
grep -r "FileFormat\|LandingFileFormat\|SourceFileFormat\|RelativeUrl" `
  src/notebooks/ notebooks/ --include="*.py" -n
```
