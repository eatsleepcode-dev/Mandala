---
gap_id: GAP-04
sprint: 2
status: COMPLETE
adr_required: ADR-046
completed_date: 2026-05-02
---

# Task: GAP-04 — Fabric Mirroring connector (`nb_conn_mirror`)

**Status**: COMPLETE
**Vibe Mode**: CREATION
**Branch**: `claude/review-recent-commits-Auyjc`
**Sprint**: 2
**Effort**: L (3–4 days)
**Score impact**: +7 pts (Engineering / P2 item → 3/3), combined with GAP-01 REST carryover → 338 → 352

---

## Context (The Elephants 🐘)

1. **`WatermarkState` is deprecated — sprint plan references it incorrectly**: `nb_bootstrap.py`
   contains a comment: *"WatermarkState is deprecated — watermarks now live in ControlLog."*
   The sprint-02 plan's Cycle 3 test adds `SourceTable` to `WatermarkState`, but there are
   0 rows in the seed and no active writers. Adding a column to a deprecated table is dead code.
   - *Strategy*: Mirror-specific metadata (`MirroredDbId`, `SchemaName`, `TableName`,
     `ConnectorType`) belongs in `IngestionConfig` where it is already the config source of
     truth for all connectors. Skip `WatermarkState.SourceTable`; extend `IngestionConfig`
     instead.
   - *Status*: ⏳ Pending — Cycle 4 adds two columns to `IngestionConfig`

2. **`run_rest_ingestion` CC=29 (D-rated) must be touched for GAP-01 carryover**: The
   existing `run_rest_ingestion` function has cyclomatic complexity 29. Adding
   `resolve_bearer_token` to it requires modifying this function. A tidy cycle must come
   first to reduce risk before the RED cycle.
   - *Strategy*: Extract `_build_auth_headers(conn_cfg, kv_url, notebookutils)` as a
     preliminary structural move. Then `resolve_bearer_token` slots in cleanly.
   - *Status*: ⏳ Pending — Tidy Cycle runs before RED

3. **`IngestionConfig` DDL mismatch with seed rows**: `IngestionConfig` DDL has 13 columns
   including `SourcePath`, `RelativeUrl`, `CustomQuery`, etc., but the 10 seed rows only
   supply 5 keys (`ConfigID, SourceID, ObjectName, WatermarkColumn, SyncType`). Adding
   `ConnectorType` and `MirroredDbId` must be nullable (no ALTER TABLE required — just add
   to DDL and ensure seed rows with `null` are valid).
   - *Strategy*: Add both columns to the DDL `CREATE TABLE IF NOT EXISTS` block in
     `nb_bootstrap.py`. No ALTER TABLE needed for new tables; existing data is unaffected
     (Delta nullable).
   - *Status*: ⏳ Pending — Cycle 4

4. **`nb_conn_mirror.py` imports `pyspark` at module level**: The sprint plan's implementation
   imports `from pyspark.sql import DataFrame, SparkSession` unconditionally. This breaks
   offline pytest collection (no pyspark in CI). All pyspark imports must be wrapped in
   `try/except ImportError` guards.
   - *Strategy*: Follow the pattern used in `nb_conn_jdbc.py` and `nb_conn_rest.py`:
     `try: from pyspark.sql import ... except ImportError: pass`. Tests use MagicMock for
     spark; the connector function accepts a duck-typed `spark` parameter.
   - *Status*: ⏳ Pending — Cycle 2

5. **`scripts/12-manage-mirroring.py` makes live Fabric REST calls**: All HTTP calls in the
   mirroring script must be tested via `requests.get`/`requests.post` mocks. No live network
   calls in tests.
   - *Strategy*: Same pattern as `scripts/11-provision-workspace-identity.py` — patch
     `requests.get` and `requests.post` at the boundary.
   - *Status*: ⏳ Pending — Cycle 5

6. **`OAuthScope` absent from current `ConnectionConfig` DDL**: `resolve_bearer_token`
   reads `conn_config.get("OAuthScope", ...)` but `OAuthScope` is not a column in the
   `ConnectionConfig` DDL. The WI path for REST uses a Dynamics 365 scope
   (`https://org.crm.dynamics.com/.default`) which must be stored per-connection.
   - *Strategy*: Add `OAuthScope STRING` to `ConnectionConfig` DDL in `nb_bootstrap.py`.
     Default to `""` in seed rows; `resolve_bearer_token` falls back to
     `https://analysis.windows.net/powerbi/api` when `OAuthScope` is empty.
   - *Status*: ⏳ Pending — Cycle 1 (DDL part) and Cycle 3 (resolve_bearer_token)

---

## Live DEV Migration SQL

```sql
-- IngestionConfig: add ConnectorType and MirroredDbId (nullable — no existing rows affected)
-- Step 1: Enable column mapping if not already set
ALTER TABLE control.IngestionConfig SET TBLPROPERTIES (
  'delta.columnMapping.mode' = 'name',
  'delta.minReaderVersion' = '2',
  'delta.minWriterVersion' = '5'
);

-- Step 2: Add new columns
ALTER TABLE control.IngestionConfig ADD COLUMN ConnectorType STRING;
ALTER TABLE control.IngestionConfig ADD COLUMN MirroredDbId STRING;

-- ConnectionConfig: add OAuthScope (nullable)
ALTER TABLE control.ConnectionConfig SET TBLPROPERTIES (
  'delta.columnMapping.mode' = 'name',
  'delta.minReaderVersion' = '2',
  'delta.minWriterVersion' = '5'
);
ALTER TABLE control.ConnectionConfig ADD COLUMN OAuthScope STRING;
```

---

## Execution Plan (Ralph's Ledger)

### ADR Cycle — Write ADR-046 before implementation

- [x] Write `docs/adr/ADR-046-mirroring-connector-vs-jdbc.md`
- [x] Add to `docs/adr/README.md` catalog
- [x] COMMIT: `docs(adr): ADR-046 — Fabric Mirroring connector vs JDBC`

---

### Tidy Cycle — `run_rest_ingestion` (CC=29 → extract auth helper, structural only)

- [x] Run radon: `radon cc src/notebooks/nb_conn_rest.py -s -n C` — confirm CC=29
- [x] Extract `_resolve_rest_auth(conn_cfg, kv_url, notebookutils)` from the auth block
      inside `run_rest_ingestion` — single-responsibility helper, no behaviour change
- [x] Verify `run_rest_ingestion` CC drops below 20 after extraction
- [x] COMMIT: `tidy(nb-conn-rest): extract _resolve_rest_auth, reduce CC from 29`

---

### Cycle 1 — GAP-01 carryover: `resolve_bearer_token` in `nb_conn_rest.py`

- [x] 🔴 RED: `tests/test_nb_conn_rest.py::TestWorkspaceIdentityAuth::test_rest_acquires_wi_token_with_oauth_scope`
      — `UseWorkspaceIdentity=True`, `OAuthScope` set: asserts `nbu.credentials.getToken`
      called with the scope; result equals the returned token string
- [x] 🔴 RED: `tests/test_nb_conn_rest.py::TestWorkspaceIdentityAuth::test_rest_falls_back_to_key_vault_when_flag_false`
      — `UseWorkspaceIdentity=False`: asserts KV `get_secret` called; `getToken` not called
- [x] 🔴 RED: `tests/test_nb_conn_rest.py::TestWorkspaceIdentityAuth::test_rest_wi_no_notebookutils_raises`
      — `UseWorkspaceIdentity=True`, `notebookutils=None`: asserts `RuntimeError`
- [x] 🔴 RED: `tests/test_nb_conn_rest.py::TestWorkspaceIdentityAuth::test_rest_wi_empty_oauth_scope_uses_default`
      — `OAuthScope=""`: asserts `getToken` called with `"https://analysis.windows.net/powerbi/api"`
- [x] 🟢 GREEN: add `resolve_bearer_token(conn_config, kv_url, notebookutils)` to
      `src/notebooks/nb_conn_rest.py`; wire into `run_rest_ingestion` via `_resolve_rest_auth`
- [x] 🟢 GREEN: add `OAuthScope STRING` to `ConnectionConfig` DDL in `nb_bootstrap.py`;
      add `"OAuthScope": null` to all `ConnectionConfig` seed rows in `config/seed-dev.json`
      and `config/seed-smoke.json`
- [x] 🔵 REFACTOR: confirm `run_rest_ingestion` delegates to `resolve_bearer_token` and
      does not duplicate auth logic
- [x] COMMIT: `feat(nb-conn-rest): resolve_bearer_token with WI/KV branching [RED/GREEN]`

---

### Cycle 2 — `nb_conn_mirror.py`: `read_mirror_db_table` with HWM filtering

- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestReadMirrorDbTable::test_reads_delta_format_from_onelake_path`
- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestReadMirrorDbTable::test_hwm_from_filter_applied_when_provided`
- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestReadMirrorDbTable::test_hwm_to_filter_applied_when_provided`
- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestReadMirrorDbTable::test_no_filter_when_no_hwm`
- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestReadMirrorDbTable::test_returns_dataframe`
- [x] 🟢 GREEN: create `src/notebooks/nb_conn_mirror.py` with `_onelake_path()` helper
      and `read_mirror_db_table`. String filter expressions used (no pyspark at module level).
- [x] 🔵 REFACTOR: `_onelake_path` independently testable; injection guards added (roast fix)
- [x] COMMIT: `feat(nb-conn-mirror): read_mirror_db_table with OneLake path + HWM [RED/GREEN]`

---

### Cycle 3 — `nb_conn_mirror.py`: `validate_ingestion_config` + `VALID_CONNECTOR_TYPES`

- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestValidateIngestionConfig::test_mirror_connector_type_is_valid`
- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestValidateIngestionConfig::test_mirror_config_requires_mirrored_db_id`
- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestValidateIngestionConfig::test_valid_config_passes_validation`
- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestOnelakePath::test_path_format_correct`
- [x] 🟢 GREEN: `VALID_CONNECTOR_TYPES = {"mirror"}` and `validate_ingestion_config(config)` added
- [x] COMMIT: `feat(nb-conn-mirror): validate_ingestion_config + VALID_CONNECTOR_TYPES [RED/GREEN]`

---

### Cycle 4 — DDL and seed: `IngestionConfig.ConnectorType` + `MirroredDbId`

- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestIngestionConfigSchema::test_ingestion_config_ddl_has_connector_type`
- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestIngestionConfigSchema::test_ingestion_config_ddl_has_mirrored_db_id`
- [x] 🔴 RED: `tests/test_nb_conn_mirror.py::TestIngestionConfigSchema::test_seed_dev_ingestion_config_has_connector_type_key`
- [x] 🟢 GREEN: `ConnectorType STRING, MirroredDbId STRING` added to `IngestionConfig` DDL;
      `null` values added to all seed rows in seed-dev.json and seed-smoke.json
- [x] COMMIT: `feat(nb-bootstrap): add ConnectorType + MirroredDbId to IngestionConfig DDL [GREEN]`

---

### Cycle 5 — `scripts/12-manage-mirroring.py` unit tests

- [x] 🔴 RED: `tests/test_manage_mirroring.py::TestGetMirroringStatus::test_returns_status_dict`
- [x] 🔴 RED: `tests/test_manage_mirroring.py::TestCreateMirroredDatabase::test_polls_lro_on_202`
- [x] 🔴 RED: `tests/test_manage_mirroring.py::TestCreateMirroredDatabase::test_raises_on_lro_failed`
- [x] 🔴 RED: `tests/test_manage_mirroring.py::TestStopMirroring::test_stop_calls_correct_endpoint`
- [x] 🟢 GREEN: `scripts/12-manage-mirroring.py` written with all lifecycle functions + CLI
- [x] 🔵 REFACTOR: `timeout=30` added to all `requests.*` calls (S113 gate)
- [x] COMMIT: `feat(scripts): 12-manage-mirroring.py with Fabric Mirroring lifecycle [RED/GREEN]`

---

## Gate Checklist

### Hardening Phase
- [x] All tests passing
- [x] WI path tested: `getToken` called with correct scope
- [x] KV fallback path tested: `get_secret` called; `getToken` NOT called
- [x] WI + `notebookutils=None` raises `RuntimeError`
- [x] HWM filter: `df.filter` called for `hwm_from` and `hwm_to` independently
- [x] No tautology tests

### Gatekeeper Phase
- [x] Gate 1: `gitleaks detect --verbose` — no secrets in new code
- [x] Gate 2: `bandit -r src/notebooks/nb_conn_mirror.py scripts/12-manage-mirroring.py -ll -f txt` — clean
- [x] Gate 3: `ruff check src/notebooks/nb_conn_mirror.py scripts/12-manage-mirroring.py tests/test_nb_conn_mirror.py --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [x] Gate 4: `mypy src/notebooks/nb_conn_mirror.py --ignore-missing-imports --no-strict-optional` — 0 errors
- [x] Gate 5: `pytest tests/test_nb_conn_mirror.py tests/test_nb_conn_rest.py` — all passing
- [x] Gate 6: AST parse `nb_conn_mirror.py` — OK
- [x] Gate 7: `UseWorkspaceIdentity` flows only through `resolve_bearer_token`; no duplicate auth logic
- [x] Sniff test: `resolve_bearer_token` and `read_mirror_db_table` — single responsibility
- [x] Roast: `nb_conn_mirror.py` — 2 CRITICALs found (HWM injection, path injection) and fixed; boolean blindness fixed
- [🔁] Manual: `python scripts/12-manage-mirroring.py status ...` — deferred (requires live Fabric workspace)
- [x] Manual: ADR-046 committed before first implementation commit

---

## Iteration Log

- **2026-05-02**: Task card created via `/build-sprint GAP-04`. Pre-mortem identified:
  WatermarkState deprecated — mirror config belongs in IngestionConfig instead; run_rest_ingestion CC=29
  requires tidy cycle; pyspark import guard required in nb_conn_mirror.py; OAuthScope column missing
  from ConnectionConfig DDL. ADR-046 required — not yet written.

- **2026-05-02**: Sprint 2 COMPLETE. All 5 TDD cycles delivered. Key decisions:
  (a) WatermarkState.SourceTable dropped — IngestionConfig.ConnectorType + MirroredDbId preferred;
  (b) pyspark import guard solved by using string filter expressions (no F.col dependency);
  (c) Roast identified 2 CRITICALs (HWM injection + path traversal) — fixed with _assert_guid,
      _assert_safe_identifier, _safe_hwm_value guards + full TestInjectionGuards test class;
  (d) boolean blindness on UseWorkspaceIdentity fixed: `wi_raw is True or str(wi_raw).strip().lower() == "true"`.
  Carryover: live Fabric workspace smoke tests for scripts/12-manage-mirroring.py.
  New TDs raised: TD-061 (silent "" bearer), TD-062 (_DEFAULT_OAUTH_SCOPE Power BI hardcode).
