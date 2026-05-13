---
gap_id: GAP-ADO
title: Azure DevOps Integration — push Mandala tasks and sprints to ADO backlog
sprint: 2
status: IN PROGRESS
vibe_mode: CREATION
adr_required: "ADR-001 — ADO authentication and API integration pattern"
source_inbox: "I want to connect this to devops.md"
created: 2026-05-12
---

# Task: Azure DevOps Integration

**Status**: IN PROGRESS  
**Vibe Mode**: CREATION

---

## VALIDATE gate — 2026-05-12

- ✅ Previous sprint (Sprint-1) is PLANNED, never started — no open cycles to block
- ✅ TD-001 Medium ("Replace placeholder code") acknowledged — listed in Pre-existing Tech Debt below
- ✅ ADR-001 created and Accepted — `docs/adr/ADR-001-ado-authentication.md`
- ✅ Scope: 5 cycles, each with a named actor and testable assertion
- ✅ Mom Test passed — see Target Condition
- ✅ Context health: clean session

---

## Target Condition — Sprint 2 — 2026-05-12

- **Auth stored**: user can enter ADO org URL, project, and PAT in Settings → PAT stored in SecretStorage, never in settings.json
- **Connection tested**: "Test Connection" button returns success or descriptive error message
- **Work item pushed**: a `.mandala` task card can be pushed to ADO as a work item (type configurable)
- **Round-trip frontmatter**: pushed items store `ado_work_item_id` in card frontmatter for future updates
- **Tests automated**: ≥ 8 unit tests covering credential storage, ADO API client, and task card → work item mapping
- Experiment threshold: FAILED if PAT is ever written to settings.json, or if a push creates duplicate work items

---

## Pre-existing Tech Debt

- **TD-001** (Medium) — "Replace placeholder code" — not in scope for this sprint; deferred to Sprint 3

---

## Context (The Elephants 🐘)

1. **PAT leaks to disk**
   - PAT must NEVER be written to `mandala.*` settings keys — it would end up in `.vscode/settings.json` and git history
   - *Strategy*: Use `context.secrets.store('mandala.ado.pat', value)` / `context.secrets.get(...)` exclusively. SettingsView shows a masked "●●●●●" placeholder once set.
   - *Key Vault considered and rejected*: Azure Key Vault would require Entra authentication before the PAT can be retrieved — a circular dependency (you need auth to get the auth token). `SecretStorage` uses the OS keychain (Windows Credential Manager / macOS Keychain / libsecret) which is the correct equivalent for a desktop extension — same security properties, no Azure dependency, works offline. If the deployment context ever becomes a headless CI agent, revisit with a managed identity + Key Vault pattern and amend ADR-001.
   - *Status*: ⏳ Pending

2. **ADO work item type varies by process template**
   - Agile: "User Story", Scrum: "Product Backlog Item", CMMI: "Requirement" — hardcoding "Task" is safest cross-template
   - *Strategy*: Default work item type = "Task". Make it configurable via `mandala.adoWorkItemType` setting.
   - *Status*: ⏳ Pending

3. **Duplicate work items on repeated push**
   - Pushing the same card twice creates two ADO items if `ado_work_item_id` is not tracked
   - *Strategy*: After creating a work item, write `ado_work_item_id: NNN` into the card's YAML frontmatter. On subsequent pushes, PATCH the existing item instead of POST a new one.
   - *Status*: ⏳ Pending

4. **Network calls in tests**
   - The ADO API client must be mockable; live network calls in unit tests are a CI killer
   - *Strategy*: `AdoClient` takes a `fetcher` parameter defaulting to `globalThis.fetch`. Tests inject a mock fetcher.
   - *Status*: ⏳ Pending

5. **BrainProvider context access**
   - `context.secrets` is only available on the `ExtensionContext` passed at activation, not in BrainProvider directly
   - *Strategy*: Pass `context` (or `context.secrets`) into `BrainProvider` constructor; store as `this._secrets`.
   - *Status*: ⏳ Pending

---

## Execution Plan (Ralph's Ledger)

### Cycle 1 — ADR confirmation 🦴
**Actor**: maintainer  
**Hypothesis**: if the auth pattern is documented before any code is written, integration decisions are reversible  
- [x] Verify `docs/adr/ADR-001-ado-authentication.md` status is `Accepted`
- [x] ADR linked in task card frontmatter
- **COMMIT**: `docs(adr): ADR-001 ADO authentication and API integration pattern`

---

### Cycle 2 — Credential storage (SecretStorage + Settings UI)
**Actor**: developer configuring Mandala for the first time  
**Hypothesis**: if the user enters ADO org/project/PAT and clicks Save, the PAT is stored in SecretStorage and never appears in settings.json  
**Assertion**: `context.secrets.get('mandala.ado.pat')` returns the stored value; `vscode.workspace.getConfiguration('mandala')` does NOT contain the PAT

- [ ] 🔴 RED: `src/lib/ado.test.ts::AdoCredentials::stores_pat_in_secret_storage` — mock `SecretStorage`, assert `store()` called with key `mandala.ado.pat` and PAT value; assert settings.get never called with PAT
- [ ] 🔴 RED: `src/lib/ado.test.ts::AdoCredentials::retrieves_pat_from_secret_storage` — mock `SecretStorage.get()`, assert credential object returned
- [ ] 🟢 GREEN: implement `src/lib/ado.ts` — `AdoCredentials` class with `store(secrets, pat)` / `retrieve(secrets)` methods
- [ ] 🟢 GREEN: add `mandala.adoOrgUrl`, `mandala.adoProject`, `mandala.adoWorkItemType` to `package.json` configuration schema (strings only — no PAT in settings)
- [ ] 🟢 GREEN: add ADO config section to `SettingsView.tsx` with org/project/work-item-type inputs + PAT input (type=password, shows ●●●●● once saved)
- [ ] 🟢 GREEN: wire `saveAdoCredentials` message from SettingsView → BrainProvider → `context.secrets.store()`
- [ ] 🔵 REFACTOR: extract credential types to `shared/types.ts`
- [ ] COMMIT: `feat(ado): credential storage via SecretStorage + settings UI`

---

### Cycle 3 — ADO REST API client with connection test
**Actor**: developer validating their ADO configuration  
**Hypothesis**: if the user clicks "Test Connection", Mandala calls the ADO Projects API and reports success or a clear error  
**Assertion**: mock fetcher receives correct `Authorization: Basic` header; on 200 webview receives `{status:'ok'}`; on 401 webview receives `{status:'error', message:'Invalid PAT or org URL'}`

- [ ] 🔴 RED: `src/lib/ado.test.ts::AdoClient::test_connection_success` — mock fetcher returns 200 `{value:[{name:'MyProject'}]}`; assert `testConnection()` resolves `{ok:true}`
- [ ] 🔴 RED: `src/lib/ado.test.ts::AdoClient::test_connection_401` — mock fetcher returns 401; assert `testConnection()` resolves `{ok:false, message:'…'}`
- [ ] 🔴 RED: `src/lib/ado.test.ts::AdoClient::sends_basic_auth_header` — assert Authorization header is `Basic <base64(':PAT')>`
- [ ] 🟢 GREEN: implement `AdoClient` class in `src/lib/ado.ts` — `testConnection()`, `fetcher` parameter, base64 auth header construction
- [ ] 🟢 GREEN: wire `testAdoConnection` message: SettingsView button → BrainProvider → `AdoClient.testConnection()` → post result back to webview
- [ ] 🔵 REFACTOR: type the fetcher interface (`AdoFetcher`) for testability
- [ ] COMMIT: `feat(ado): AdoClient with connection test`

---

### Cycle 4 — Work item push (task card → ADO work item)
**Actor**: developer who wants their Mandala task reflected in the team ADO board  
**Hypothesis**: if a task card with YAML frontmatter is pushed, Mandala creates (or updates) an ADO work item and writes `ado_work_item_id` back to the file  
**Assertion**: mock fetcher verifies POST body contains correct `title` and `description`; after push, the task card file contains `ado_work_item_id: 42`

- [ ] 🔴 RED: `src/lib/ado.test.ts::AdoClient::push_creates_work_item` — mock POST 200 `{id:42}`; assert title field mapped from frontmatter `title`, description from file body
- [ ] 🔴 RED: `src/lib/ado.test.ts::AdoClient::push_updates_existing_item` — frontmatter has `ado_work_item_id: 42`; assert PATCH sent to `/wit/workitems/42`
- [ ] 🔴 RED: `src/lib/ado.test.ts::AdoClient::push_writes_id_back_to_frontmatter` — after push, file content contains `ado_work_item_id: 42`
- [ ] 🟢 GREEN: implement `pushWorkItem(card, fs, secrets, config)` in `src/lib/ado.ts` — maps frontmatter fields, POST or PATCH based on `ado_work_item_id` presence, writes ID back via `frontmatter.ts`
- [ ] 🟢 GREEN: add "Push to ADO" context action on task cards in InboxView
- [ ] 🔵 REFACTOR: status mapping table (Mandala status → ADO state string) extracted as constant
- [ ] COMMIT: `feat(ado): push task card as ADO work item with frontmatter round-trip`

---

### Cycle 5 — Settings UI polish + connection status indicator
**Actor**: developer checking their ADO integration health at a glance  
**Hypothesis**: if the Settings ADO section shows connection status (✅ Connected / ❌ Error / ○ Not configured), the user can diagnose problems without opening the command palette  
**Assertion**: snapshot test shows status badge renders correctly for each state

- [ ] 🔴 RED: `src/webview/components/SettingsView.test.tsx::SettingsView::renders_ado_connected_badge` — mock `adoConnectionStatus: 'connected'`; assert green badge present
- [ ] 🔴 RED: `src/webview/components/SettingsView.test.tsx::SettingsView::renders_ado_error_badge` — mock `adoConnectionStatus: 'error'`; assert red badge present
- [ ] 🟢 GREEN: add `adoConnectionStatus: 'connected'|'error'|'unconfigured'` to AppState; render badge in SettingsView ADO section
- [ ] 🟢 GREEN: post `adoConnectionStatus` update from BrainProvider after test result
- [ ] 🔵 REFACTOR: extract `<StatusBadge>` component if used in more than one place
- [ ] COMMIT: `feat(ado): connection status badge in settings`

---

## No schema/DDL change required

This is a VS Code extension — no SQL migration needed. The only persistent writes are:
- VS Code `SecretStorage` (PAT)
- `package.json` configuration schema (3 new string keys: `adoOrgUrl`, `adoProject`, `adoWorkItemType`)
- YAML frontmatter in task card files (`ado_work_item_id` field added on push)

---

## Iteration Log

- **2026-05-12**: VALIDATE gate ✅ — Sprint-1 PLANNED (never started), TD-001 Medium acknowledged, ADR-001 Accepted, 5 cycles scoped, Mom Test passed. Context: clean session.
