---
description: Task card template — use for every schema change, new connector, or notebook feature.
gap_id: GAP-NN
sprint: N
status: TODO
adr_required: NOT REQUIRED
---

# Task: [Feature / Ticket Name]

**Status**: TODO | IN PROGRESS | BLOCKED | COMPLETE
**Vibe Mode**: CREATION | HARDENING | GATEKEEPER

---

## Context (The Elephants 🐘)

_List every risk, assumption, or hidden dependency that could cause this to fail._

1. **[Elephant Name]**: [Risk description]
   - *Strategy*: [Mitigation approach]
   - *Status*: ⏳ Pending | ✅ Resolved

2. **Schema Drift**: Does this change columns in `IngestionConfig`, `ConnectionConfig`, or `IngestionSource`?
   - *Strategy*: Update DDL + view + all connector SELECTs + INSERT column counts atomically
   - *Status*: ⏳ Pending

3. **SQL Injection**: Does any new string value get interpolated into Spark SQL?
   - *Strategy*: `.replace(chr(39), chr(39)*2)` for strings, `int()` cast for IDs
   - *Status*: ⏳ Pending

4. **Live DEV Delta**: Does the DEV environment need ALTER TABLE migration SQL?
   - *Strategy*: Write and document migration SQL before merging
   - *Status*: ⏳ Pending

5. **Runtime Dependency**: Does new code require packages not available in Fabric by default?
   - *Strategy*: `PYDANTIC_AVAILABLE` flag pattern — install at notebook start, fallback path if absent
   - *Status*: ⏳ Pending

---

## Execution Plan (Ralph's Ledger)

### Creation Phase (RED-GREEN-REFACTOR)
- [ ] Write failing test (RED)
- [ ] Implement minimal code (GREEN)
- [ ] Refactor + clean

### Hardening Phase
- [ ] All tests passing
- [ ] Edge cases covered (NULL, empty string, special chars, wrong type)
- [ ] No tautology tests (every assertion can actually fail)
- [ ] SQL injection surfaces checked

### Gatekeeper Phase
- [ ] Gate 1: Security scan (`bandit` + `gitleaks` + manual SQL check)
- [ ] Gate 2: Contract tests (Pydantic + DDL column counts)
- [ ] Gate 3: Edge case coverage documented
- [ ] Gate 4: AST syntax check all OK
- [ ] Gate 5: Schema drift check (if applicable)

---

## Live DEV Migration SQL

```sql
-- Run in Fabric SQL endpoint / notebook against control.IngestionConfig
-- Step 1: Enable column mapping (required for RENAME COLUMN on Delta tables)
ALTER TABLE control.IngestionConfig SET TBLPROPERTIES (
  'delta.columnMapping.mode' = 'name',
  'delta.minReaderVersion' = '2',
  'delta.minWriterVersion' = '5'
);

-- Step 2: Rename and add columns
ALTER TABLE control.IngestionConfig RENAME COLUMN FileFormat TO SourceFileFormat;
ALTER TABLE control.IngestionConfig ADD COLUMN LandingFileFormat STRING;
ALTER TABLE control.IngestionConfig ADD COLUMN RelativeUrl STRING;
```

---

## Iteration Log

- **[YYYY-MM-DD]**: VALIDATE gate: ✅ — [brief summary: prev sprint closed, TD scan clean, ADR confirmed/not required, scope N cycles, Mom Test passed]
- **[YYYY-MM-DD]**: [What was done]
