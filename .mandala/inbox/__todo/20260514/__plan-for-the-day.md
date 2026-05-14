---
type: day-plan
date: "2026-05-14"
branch: "main"
sprint: 2
sprint_status: "IN PROGRESS"
scope: "Mandala"
repos: ["Mandala"]
head_sha: "88e7b5d"
test_baseline: "169 passed"
lint_status: "10 errors"
task_card: "task-GAP-ADO.md"
carried_over: []
inbox_actioned: ["I want to connect this to devops.md", "T-048.md"]
open_tds: ["TD-001"]
hitl_gates: ["ADO Connection Test (Cycle 3)"]
---

# Day Plan — 14 May 2026

> [!IMPORTANT]
> Branch: `main` · Sprint 2 **IN PROGRESS** · HEAD: `88e7b5d`

> [!NOTE]
> chore(handoff): session handoff 6e833b8 [skip ci]
> **Legacy context:** The `.agents/` directory contains inherited metadata from the original repository (Data Platform) and is disregarded for current Mandala sprint tracking.

---

## Handoff State

| Key | Value |
|---|---|
| Last sprint | Sprint 1 — Initial setup — **COMPLETE** |
| HEAD | `88e7b5d` — chore(handoff): session handoff 6e833b8 |
| Test baseline | ✅ 169 passed |
| Linting | 10 errors (51 violations total) |
| Branch push | main is current |
| Open TDs | 1 Medium (Mandala native) |

---

## Focus Areas

1. **Primary** — **ADO Integration (GAP-ADO)**: Implement Cycle 2 (Credential storage & Settings UI).
2. **Secondary** — Resolve Linting Errors (10 errors in `src`).
3. **Housekeeping** — Inbox triage and task folder organisation.

---

## Workstream A — ADO Integration (GAP-ADO) `Priority: HIGH`

Implementing secure credential storage and updating the Settings UI to handle Azure DevOps configuration.

### Task A1 — Cycle 2: Credential storage (SecretStorage + Settings UI)

**Design**
- [ ] Define `CredentialManager` in `src/lib/credentials.ts`
- [ ] Update `SettingsView.tsx` to include ADO fields (Org URL, Project, Work Item Type, PAT)

**TDD — RED**
- [ ] Write `src/lib/credentials.test.ts` for `store()` and `retrieve()`
- [ ] `npm test` → confirm RED

**TDD — GREEN**
- [ ] Implement `CredentialManager` using `context.secrets`
- [ ] Update `package.json` with new settings keys
- [ ] Update `SettingsView.tsx` with ADO form
- [ ] `npm test` → GREEN

**Quality gates**
- [ ] `npm run lint` — verify no new violations
- [ ] `npm test` — confirm 169 passed baseline maintained

> [!WARNING]
> **HITL checkpoint** Verify that PAT is stored in `SecretStorage` and NOT in `settings.json` by checking the global/workspace settings file after saving.

**Commit**
```powershell
git add src/lib/credentials.ts src/lib/credentials.test.ts src/webview/components/SettingsView.tsx package.json
git commit -m "feat(credentials): generic credential storage via SecretStorage + settings UI"
```

---

## Workstream B — Linting Remediation `Priority: MEDIUM`

Resolving the 10 errors currently blocking a clean lint pass.

### Task B1 — Fix unused variables and explicit-any violations

**TDD — GREEN**
- [ ] Resolve unused imports in `src/webview`
- [ ] Narrow `any` types where possible
- [ ] `npm run lint` → Clean

**Commit**
```powershell
git add .
git commit -m "fix(lint): resolve 10 errors in src (unused vars, explicit-any)"
```

---

## Workstream C — Housekeeping `Priority: LOW`

- [ ] **C1 — Inbox Triage**
  ```powershell
  # Move unprocessed items to today's todo folder
  Move-Item ".mandala/inbox/I want to connect this to devops.md" ".mandala/inbox/__todo/20260514/"
  Move-Item ".mandala/inbox/T-048.md" ".mandala/inbox/__todo/20260514/"
  ```

- [ ] **C2 — Sprint status review** — verify sprint deliverables against `.mandala/sprints/`

---

## Blocked Items ⛔

| # | Item | Requires live workspace? | Status |
|---|---|:---:|---|
| A1 | ADO Connection Test | ✅ Yes | ⬜ Pending |

---

## Sequencing Recommendation

```
Morning   → Workstream A (Cycle 2) → quality gates → commit
Afternoon → Workstream B (Linting) → commit
End of day → Housekeeping → sprint register update
Blocked   → ADO Connection Test (Cycle 3)
```

---

## Open Tech Debt (Mandala native)

| Severity | ID | Description |
|---|---|---|
| 🟡 Medium | TD-001 | Replace placeholder code |
