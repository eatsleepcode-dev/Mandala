# ADR-001 — Azure DevOps Authentication and API Integration Pattern

**Status**: Accepted  
**Date**: 2026-05-12  
**Gap**: GAP-ADO  
**Deciders**: Martin Scott

---

## Context

Mandala needs to sync task cards and sprints to Azure DevOps (ADO) work items and backlogs. This requires:
1. A secure way to store user credentials (Personal Access Token)
2. A pattern for calling the ADO REST API from a VS Code extension
3. A decision on sync direction (push-only vs bidirectional)

Three options were considered:

| Option | Auth | Complexity | Security |
|---|---|---|---|
| A: PAT stored in VS Code settings | PAT in `settings.json` | Low | ❌ Leaks to git |
| B: PAT in VS Code SecretStorage | PAT in encrypted OS keychain | Medium | ✅ Never in settings |
| C: OAuth / Azure Entra ID | OAuth device flow | High | ✅ No long-lived tokens |
| D: Azure Key Vault | Fetch PAT from KV at runtime | High | ❌ Circular — requires Entra auth before PAT can be retrieved |

---

## Decision

**Option B — PAT stored in VS Code `SecretStorage` API.**

- `vscode.SecretStorage` encrypts secrets using the OS keychain (Keychain on macOS, Credential Manager on Windows, libsecret on Linux)
- The PAT is never written to `settings.json`, `.vscode/`, or any workspace file
- The extension retrieves it on demand via `context.secrets.get('mandala.ado.pat')`
- Users set/rotate the PAT via the Settings UI "Test Connection" flow; it is stored on confirm

**Why not Key Vault?** Azure Key Vault was considered (it is used in the phoric project's `.env.example` as the recommended store for `AZURE_DEVOPS_PAT`). However for a desktop VS Code extension it creates a circular dependency: authenticating to Key Vault requires Entra credentials, which are harder to obtain than the PAT itself. `SecretStorage` provides equivalent security properties (OS keychain encryption, never written to disk as plaintext) without any cloud dependency. Key Vault / managed identity becomes the right pattern if Mandala ever runs as a headless CI agent — that decision will warrant a separate ADR.

## Phoric Reference Patterns (dev-2 branch)

Three patterns exist in phoric, used in different runtime contexts:

| Context | File | Pattern |
|---|---|---|
| Server-side API (FastAPI) | `apps/foundry-agent-service/src/control_plane/devops_presales_api.py` | `os.getenv("AZURE_DEVOPS_PAT")` — env var, injected by deployment infra |
| Fabric notebooks | `deploy/fabric/ado_writeback.py` | `mssparkutils.credentials.getSecret("<kv-name>", "<secret-name>")` — fetches PAT from Key Vault at notebook runtime using Fabric's built-in managed identity |
| MCP server | `apps/mcp-server/src/phoric_mcp_server/secrets.py` | `SecretManager`: tries `SecretClient(vault_url, DefaultAzureCredential())` first, falls back to env var |

None of these patterns apply directly to a desktop VS Code extension:
- `os.getenv` / env vars → not available in a VS Code extension context
- `mssparkutils.credentials.getSecret()` → Fabric notebook runtime only
- `DefaultAzureCredential` + Key Vault → requires Entra auth before PAT retrieval (circular dependency for a desktop tool)

**`vscode.SecretStorage` is the correct equivalent** — the OS keychain provides the same encrypted-at-rest guarantee as Key Vault, without requiring any prior authentication. This is the established VS Code extension pattern for exactly this scenario.

The phoric Fabric pattern (`mssparkutils.credentials.getSecret()`) would be the right model if Mandala ever ran as a Fabric notebook or a CI agent with managed identity. That would warrant a new ADR at that point.

---



**Push-only (Mandala → ADO) for v1.** Bidirectional sync introduces conflict resolution complexity that is out of scope.

Mandala is the source of truth for task cards. ADO is the reflection. On push:
- A new task card creates a new ADO work item
- An existing task card (with `ado_work_item_id` in frontmatter) updates the existing item
- Status mapping: `todo` → `To Do`, `in-progress` → `Active`, `done` → `Closed`

---

## API Pattern

Use ADO REST API v7.1 with `Authorization: Basic` header (base64-encoded `:PAT`). No SDK dependency — raw `fetch()` calls keep the extension bundle lean.

Base URL pattern: `https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/${workItemType}?api-version=7.1`

All API calls are async and routed through a dedicated `AdoClient` class in `src/lib/ado.ts`.

---

## Consequences

- ✅ PAT never leaks to disk or source control
- ✅ No additional npm dependencies
- ✅ Simple, widely understood auth pattern for ADO
- ⚠️ PAT rotation is manual — user must re-enter if PAT expires
- ⚠️ Sync is one-way — changes made in ADO are not reflected back in Mandala
- ❌ OAuth support deferred — will require a follow-up ADR when requested
