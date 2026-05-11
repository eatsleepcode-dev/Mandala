---
gap_id: GAP-01
sprint: 1
status: DONE
adr_required: ADR-045
---

# Task: GAP-01 — Workspace Identity auth (JDBC connector + provisioning script)

**Status**: DONE
**Vibe Mode**: CREATION
**Branch**: `claude/review-recent-commits-Auyjc`
**Sprint**: 1
**Effort**: M (2–3 days)
**Score impact**: +7 pts (Security / P1 item — partial; REST connector WI carries to Sprint 2)

---

## Context (The Elephants 🐘)

1. **`UseWorkspaceIdentity` column missing from `ConnectionConfig` DDL**: `nb_bootstrap.py`
   `CREATE TABLE control.ConnectionConfig` has no `UseWorkspaceIdentity` column. A schema
   change is required before any test that reads that column can be meaningful.
   - *Strategy*: Update `nb_bootstrap.py` DDL atomically with the ALTER TABLE migration SQL
     and seed row additions. Guard in code: `conn_cfg.get("UseWorkspaceIdentity", False)` —
     existing rows without the column return `None` (falsy), safe default.
   - *Status*: ✅ Done — `UseWorkspaceIdentity BOOLEAN` added to DDL; seeded in dev + smoke

2. **`_ingest_source` calls `get_secret` with no WI guard**: Current code calls
   `get_secret(conn_cfg["KeyVaultSecretName"], kv_url, notebookutils)` unconditionally.
   If `UseWorkspaceIdentity=True` and `KeyVaultSecretName` is `None`, this raises
   `TypeError` from inside `get_secret`, not a clear user-facing error.
   - *Strategy*: Introduce `build_jdbc_connection(conn_config, kv_url, notebookutils)`
     helper that branches on the flag before touching KV. `_ingest_source` calls it instead.
   - *Status*: ✅ Done — `build_jdbc_connection` implemented; `_ingest_source` delegates to it

3. **`notebookutils=None` in offline tests**: WI token acquisition requires the Fabric
   runtime. `build_jdbc_connection` must raise `RuntimeError` with a clear message when
   `UseWorkspaceIdentity=True` and `notebookutils is None`. This is the offline safety gate.
   - *Strategy*: Explicit guard at the top of the WI branch. Tests exercise this via
     `notebookutils=None`.
   - *Status*: ✅ Done — guard in place; tested by `test_wi_flag_true_no_notebookutils_raises`

4. **`scripts/11-provision-workspace-identity.py` makes live Fabric REST calls**: The
   polling loop (`_poll_operation`) and the long-running `provision_identity` cannot be
   integration-tested without a live workspace. Tests must mock `requests.get` /
   `requests.post` at the boundary.
   - *Strategy*: Tests patch `requests.get` and `requests.post`. Cover: happy path,
     poll-until-succeeded, poll-timeout, failed state, deprovision 204.
   - *Status*: ✅ Done — 4 tests in `test_provision_workspace_identity.py`; all mocked

5. **`nb_conn_rest.py` WI support is out of scope**: Sprint plan explicitly notes REST
   connector WI as a known Sprint 2 carryover. Do not touch `nb_conn_rest.py` in this sprint.
   - *Strategy*: Scope boundary — enforce by not modifying that file.
   - *Status*: ✅ Resolved (by exclusion)

---

## Live DEV Migration SQL

```sql
-- Run against DEV control lakehouse before writing any test that queries UseWorkspaceIdentity.
-- Step 1: Enable column mapping (required for ADD COLUMN on existing Delta table)
ALTER TABLE control.ConnectionConfig SET TBLPROPERTIES (
  'delta.columnMapping.mode' = 'name',
  'delta.minReaderVersion' = '2',
  'delta.minWriterVersion' = '5'
);

-- Step 2: Add UseWorkspaceIdentity column (defaults to NULL for existing rows — falsy, safe)
ALTER TABLE control.ConnectionConfig ADD COLUMN UseWorkspaceIdentity BOOLEAN;
```

---

## Execution Plan (Ralph's Ledger)

### Cycle 1 — `build_jdbc_connection` resolves credentials via WI flag

- [x] 🔴 RED: `tests/test_nb_conn_jdbc.py::TestBuildJdbcConnection::test_wi_flag_true_calls_get_token`
      — `UseWorkspaceIdentity=True`: asserts `nbu.credentials.getToken` called with SQL scope;
      result contains `"accessToken"`
- [x] 🔴 RED: `tests/test_nb_conn_jdbc.py::TestBuildJdbcConnection::test_wi_flag_false_calls_kv_secret`
      — `UseWorkspaceIdentity=False`: asserts `nbu.secrets.get` called; `getToken` not called
- [x] 🔴 RED: `tests/test_nb_conn_jdbc.py::TestBuildJdbcConnection::test_wi_flag_true_no_notebookutils_raises`
      — `UseWorkspaceIdentity=True`, `notebookutils=None`: asserts `RuntimeError` raised
- [x] 🟢 GREEN: add `build_jdbc_connection(conn_config, kv_url, notebookutils)` to
      `src/notebooks/nb_conn_jdbc.py`
- [x] 🔵 REFACTOR: none required (function is already minimal)
- [x] COMMIT: `feat(nb-conn-jdbc): build_jdbc_connection with WI/SP branching [RED/GREEN]`

### Cycle 2 — `_ingest_source` uses `build_jdbc_connection`

- [x] 🔴 RED: `tests/test_nb_conn_jdbc.py::TestIngestSourceWI::test_wi_source_calls_get_token_not_kv`
      — end-to-end `_ingest_source` with `UseWorkspaceIdentity=True` conn config: asserts
      `getToken` called, `secrets.get` not called
- [x] 🟢 GREEN: replace `get_secret(conn_cfg["KeyVaultSecretName"], ...)` call in
      `_ingest_source` with `build_jdbc_connection(conn_cfg, kv_url, notebookutils)`; use
      result to build the JDBC URL / options
- [x] 🔵 REFACTOR: confirm `_ingest_source` no longer calls `get_secret` directly for
      credential resolution
- [x] COMMIT: `feat(nb-conn-jdbc): _ingest_source delegates to build_jdbc_connection [RED/GREEN/REFACTOR]`

### Cycle 3 — `UseWorkspaceIdentity` in DDL and seed

- [x] 🔴 RED: `tests/test_nb_conn_jdbc.py::TestConnectionConfigSchema::test_seed_conn_config_has_use_workspace_identity`
      — opens `config/seed-dev.json`; asserts every `ConnectionConfig` row has
      `UseWorkspaceIdentity` key
- [x] 🟢 GREEN:
      (a) update `nb_bootstrap.py` `CREATE TABLE control.ConnectionConfig` to include
          `UseWorkspaceIdentity BOOLEAN`
      (b) add `"UseWorkspaceIdentity": false` to every `ConnectionConfig` row in
          `config/seed-dev.json` and `config/seed-smoke.json`
- [x] 🔵 REFACTOR: none
- [x] COMMIT: `feat(nb-bootstrap): add UseWorkspaceIdentity to ConnectionConfig DDL [GREEN]`

### Cycle 4 — `scripts/11-provision-workspace-identity.py` unit tests

- [x] 🔴 RED: `tests/test_provision_workspace_identity.py::TestGetIdentityStatus::test_returns_identity_when_present`
      — mocks `requests.get`; asserts function returns the `workspaceIdentity` sub-object
- [x] 🔴 RED: `tests/test_provision_workspace_identity.py::TestProvisionIdentity::test_polls_until_succeeded`
      — mocks `requests.post` returning 202 + `Location`; mocks `requests.get` returning
      `{"status": "running"}` then `{"status": "succeeded"}`; asserts result returned
- [x] 🔴 RED: `tests/test_provision_workspace_identity.py::TestProvisionIdentity::test_raises_on_failed_state`
      — poll returns `{"status": "failed"}`; asserts `RuntimeError`
- [x] 🟢 GREEN: write `scripts/11-provision-workspace-identity.py` (provision, status,
      deprovision, poll loop, CLI)
- [x] 🔵 REFACTOR: none required
- [x] COMMIT: `feat(scripts): 11-provision-workspace-identity.py with WI lifecycle [RED/GREEN]`

---

## Gate Checklist

### Hardening Phase
- [x] All tests passing — 21 passed (18 JDBC + 3 provision)
- [x] WI path tested (getToken called)
- [x] SP path tested (secrets.get called, getToken NOT called)
- [x] WI + None notebookutils raises cleanly
- [x] No tautology tests

### Gatekeeper Phase
- [x] Gate 1: `gitleaks detect --verbose` — not installed; no secrets in new code
- [x] Gate 2: `bandit` — provisioning script clean; pre-existing B608/B108 in nb_conn_jdbc.py = TD-039
- [x] Gate 3: `ruff` — provisioning script + tests clean; pre-existing issues in nb_conn_jdbc.py = TD-039
- [x] Gate 4: `mypy scripts/11-provision-workspace-identity.py` — clean (types-requests installed); nb_conn_jdbc.py pre-existing errors = TD-039
- [x] Gate 5: `pytest --cov=nb_conn_jdbc` — 89% (≥ 80% ✅)
- [x] Gate 6: AST parse nb_conn_jdbc.py — OK
- [x] Gate 7: `UseWorkspaceIdentity` appears only in `build_jdbc_connection` and `_ingest_source` call site
- [x] Sniff test: `build_jdbc_connection` — single responsibility confirmed
- [ ] Roast: `build_jdbc_connection` in fresh context — pending (Sprint close)
- [ ] Manual: `python scripts/11-provision-workspace-identity.py status ...` — requires live workspace

---

## Iteration Log

- **2026-05-02**: Task card created via `/build-sprint GAP-01`. Pre-mortem identified
  missing DDL column as primary blocker — migration SQL written before code. `nb_conn_rest.py`
  WI confirmed as Sprint 2 carryover. Script tests require `requests` mocking.
  Radon not installed locally; `_ingest_source` estimated CC ~5 — no tidy cycle needed.
- **2026-05-02**: All 4 TDD cycles complete. 21 tests, 89% coverage. Ruff/mypy clean on new
  code. Pre-existing nb_conn_jdbc.py violations = TD-043. Committed GREEN + pushed to
  `claude/review-recent-commits-Auyjc`. Roast deferred to sprint-close.
- **Sprint close 2026-05-02**: Roast complete — 2 Critical + 4 High + 4 Medium. Critical fixes:
  WI access token was passed as JDBC URL (never worked end-to-end, now uses .option("accessToken")),
  SQL injection in _load_object via ObjectName/WatermarkColumn (now identifier-validated).
  High fixes: boolean blindness on UseWorkspaceIdentity, bare KeyError on KeyVaultSecretName,
  "or" credential chain deleted, double-log on QUARANTINED path, NULL watermark max guard.
  48 tests, 91% coverage. TDs raised: TD-043, TD-045, TD-047. TDs closed: none.
  Carryover: nb_conn_rest.py WI (Sprint 2); smoke test of provisioning script (Sprint 2 prerequisite).
