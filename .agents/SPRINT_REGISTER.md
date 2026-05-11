# Sprint Register — the platform Data Platform

> Single source of truth for sprint status, score progression, carryover, and tech debt linkage.
> Updated at the end of every sprint by `/sprint-close`.
> Baseline score: **325/390 (83%)** — **Achieved: 381/390 (98%)** after Sprint 6. Sprint 20 closed with carryover.

---

## Status key

| Status | Meaning |
|---|---|
| `PLANNED` | Defined, not yet started |
| `IN PROGRESS` | Active — task card open |
| `COMPLETE` | All DoD items checked, sprint-close run |
| `BLOCKED: Sprint N` | Cannot start until Sprint N completes |
| `CARRYOVER` | Partially complete — remainder moved to next sprint |

---

## Register

| Sprint | Title | Status | Gaps | Score Before → After | Started | Completed | Carryover |
|:---:|---|---|---|---|---|---|---|
| 1 | Queue isolation + Workspace Identity (start) | `COMPLETE` | GAP-02, GAP-01 | 325 → 338 | 2026-05-02 | 2026-05-02 | GAP-01 REST WI; smoke test |
| 2 | Workspace Identity (finish) + Mirroring connector | `COMPLETE` | GAP-01, GAP-04 | 338 → 352 | 2026-05-02 | 2026-05-02 | Live smoke tests (Fabric workspace) |
| 3 | Spark resource profiles + RTI observability | `COMPLETE` | GAP-03, GAP-06 | 352 → 363 | 2026-05-02 | 2026-05-03 | — |
| 4 | Fabric SQL Phase A — dual-write PoC | `COMPLETE` | GAP-05 | 363 → 363 | 2026-05-03 | 2026-05-03 | Live Fabric smoke tests (scripts/14) |
| 5 | Fabric SQL Phase B — read migration | `COMPLETE` | GAP-05 | 363 → 363 | 2026-05-03 | 2026-05-03 | Seed SQL + manual smoke (Fabric workspace) |
| 6 | Fabric SQL Phase C — full migration | `COMPLETE` | GAP-05 | 363 → 381 | 2026-05-03 | 2026-05-03 | TD-064 — live Fabric SQL commissioning (requires live workspace) |
| 7 | JSON unpack pipeline | `COMPLETE` | GAP-07 | 381 → 381 | 2026-05-03 | 2026-05-03 | 84 tests; 3 notebooks updated; roast fixes committed |
| 8 | Data awareness (Bronze profiling + PII) | `COMPLETE` | GAP-07, GAP-08 | 381 → 381 | 2026-05-03 | 2026-05-03 | — |
| 9 | Quality enforcement (Pandera contracts) | `COMPLETE` | GAP-09 | 381 → 381 | 2026-05-05 | 2026-05-05 | — |
| 10 | PIM control plane (Data Product Catalogue) | `COMPLETE` | GAP-10 | 381 → 381 | 2026-05-05 | 2026-05-05 | DataProduct v1.1: 14-field schema, CRUD, DDL, migration SQL, 33 tests |
| 11 | OpenMetadata integration | `COMPLETE` | GAP-11 | 381 → 381 | 2026-05-05 | 2026-05-05 | All 5 cycles pre-implemented; 33 tests passing |
| 11.5 | SourceConfig — consolidate three ingestion config tables into control.SourceConfig | `COMPLETE` | UNIFIED-CONFIG | e8280c5 → 51b7bbe | 2026-05-05 | 2026-05-05 | 9 cycles + fix(tests) |
| 12 | Deployment Excellence — wire React wizard + nb_environment_validator + nb_connection_test | `PLANNED` | FEATURE P1 | TBD → TBD | — | — | — |
| 13 | Source Onboarding Wizard — nb_source_wizard + nb_jdbc_introspect | `COMPLETE` | FEATURE P2 | TBD → 1228 tests | 2026-05-06 | 2026-05-06 | — |
| 14 | Observability — structured logging (Layer 1) + Hub plugin ControlLog backends (Layer 2) + DQ observability/ADR-056 (Layer 3) | `COMPLETE` | FEATURE P3 | 1228 tests → 1228 tests | 2026-05-06 | 2026-05-06 | — |
| 15 | Connector Expansion — SFTP/FTPS + SharePoint + Oracle/SQLMI JDBC | `COMPLETE` | FEATURE P4 | 1228 → 1257 tests | 2026-05-06 | 2026-05-06 | — |
| 16 | Gold Domain Framework — domain scaffold wizard + write_gold() | `COMPLETE` | FEATURE P5 | 1257 → 1284 tests | 2026-05-06 | 2026-05-06 | — |
| 17 | Security & Taskflow — WI migration + KV naming + Taskflow definitions | `COMPLETE` | FEATURE P7/P8 | 1284 → 1302 tests | 2026-05-06 | 2026-05-06 | TD-077 (deploy_fabric_cli.sh deferred) |
| 18 | OneLake RBAC + Livy CI smoke | `COMPLETE` | GAP-21 | 1302 → 1310 tests | 2026-05-07 | 2026-05-09 | TD-079 (Smoke_Livy CI stage HITL gated) |
| 19 | Control Plane Phase 1 + Delta Table Maintenance | `COMPLETE` | CONTROL-PLANE-PHASE-1, GAP-23 | 1310 → 1407 tests | 2026-05-09 | 2026-05-09 | none |
| 20 | Live bootstrap + odd bits + CI/CD debt tranche | `COMPLETE` | TD-078, TD-076, TD-063, TD-067, TD-070, TD-071 | 1407 → 1488 tests | 2026-05-11 | 2026-05-11 | TD-064, TD-045, TD-072, TD-065, TD-066 |

---

## Sprint detail

### Sprint 1 — Queue isolation + Workspace Identity

**Status:** `COMPLETE`
**Branch:** `claude/review-recent-commits-Auyjc`
**Completed:** 2026-05-02
**ADRs:** ADR-045 ✅ committed
**Task cards:** `.agents/sprints/task-cards/task-GAP-02.md`, `.agents/sprints/task-cards/task-GAP-01.md`
**Sprint plan:** `.agents/sprints/plans/sprint-01-queue-isolation-workspace-identity.md`

**Deliverables:**
- [x] GAP-02: `WorkspaceGuid` flows through `build_dag` → `run_pipeline` → seed → ADO
- [x] GAP-01: `UseWorkspaceIdentity` flag + `build_jdbc_connection` in `nb_conn_jdbc`
- [x] GAP-01: `scripts/11-provision-workspace-identity.py` written + unit tested
- [x] GAP-01: `UseWorkspaceIdentity BOOLEAN` column in `ConnectionConfig` DDL + seeds
- [x] Roast: `build_dag` + `build_jdbc_connection` — 3 Critical + 7 High fixed
- [🔁] GAP-01: `nb_conn_rest` WI support → Sprint 2
- [🔁] GAP-01: smoke test against live workspace → Sprint 2 prerequisite

**Score actual:** 325 → 338 (+13) ✅ matched estimate

**TDs raised this sprint:** TD-039, TD-040, TD-041, TD-042, TD-043, TD-044, TD-045, TD-046, TD-047
**TDs closed this sprint:** none
**Carryover to Sprint 2:** GAP-01 REST connector WI (`nb_conn_rest.py`); provisioning script smoke validation

---

### Sprint 2 — Workspace Identity (finish) + Mirroring connector

**Status:** `COMPLETE`
**Branch:** `claude/review-recent-commits-Auyjc`
**Started:** 2026-05-02
**Completed:** 2026-05-02
**ADRs:** ADR-046 ✅ committed
**Task cards:** `.agents/sprints/task-cards/task-GAP-04.md`
**Sprint plan:** `.agents/sprints/plans/sprint-02-workspace-identity-finish-mirroring.md`

**Deliverables:**
- [x] GAP-01: `resolve_bearer_token()` in `nb_conn_rest.py` — WI + KV fallback + boolean blindness fix
- [x] GAP-01: `OAuthScope STRING` added to `ConnectionConfig` DDL + seeds
- [x] GAP-04: `nb_conn_mirror.py` — `read_mirror_db_table`, `_onelake_path`, `validate_ingestion_config`
- [x] GAP-04: Injection guards — GUID regex, identifier allowlist, HWM single-quote rejection
- [x] GAP-04: `IngestionConfig` DDL: `ConnectorType STRING`, `MirroredDbId STRING`
- [x] GAP-04: `scripts/12-manage-mirroring.py` — full Fabric Mirroring lifecycle + CLI
- [x] GAP-04: ADR-046 committed
- [x] Tests: 19+ new tests in `test_nb_conn_mirror.py` + 5 in `TestWorkspaceIdentityAuth` + 5 in `test_manage_mirroring.py`
- [x] Roast: 2 CRITICALs + 1 HIGH fixed in nb_conn_mirror; boolean blindness fixed in nb_conn_rest
- [🔁] GAP-01: `scripts/11-provision-workspace-identity.py` smoke test — requires live Fabric workspace
- [🔁] GAP-04: `scripts/12-manage-mirroring.py` live smoke (create/status/stop) — requires live Fabric workspace
- [❌] `WatermarkState.SourceTable` — Dropped (WatermarkState deprecated; superseded by IngestionConfig approach)

**Score actual:** 338 → 352 (+14) ✅ matched estimate

**TDs raised this sprint:** TD-061, TD-062
**TDs closed this sprint:** none
**Carryover to Sprint 3:** Live Fabric workspace smoke tests for `scripts/12-manage-mirroring.py` and `scripts/11-provision-workspace-identity.py`

---

### Sprint 3 — Spark resource profiles + RTI observability

**Status:** `COMPLETE`
**Branch:** `claude/review-recent-commits-Auyjc`
**Started:** 2026-05-02
**Completed:** 2026-05-03
**ADRs:** ADR-041 amended (§ RTI Eventstream opt-in companion)
**Task cards:** `.agents/sprints/task-cards/task-GAP-03.md`, `.agents/sprints/task-cards/task-GAP-06.md`
**Sprint plan:** `.agents/sprints/plans/sprint-03-spark-profiles-rti-observability.md`

**Deliverables:**
- [x] GAP-03: `apply_layer_spark_config` accepts `resource_profile_id` kwarg (4th optional, backward-compatible)
- [x] GAP-03: `_FABRIC_RESOURCE_PROFILE_PROPERTY` constant; `sparkContext.setLocalProperty` with `getattr` guard
- [x] GAP-03: Fallback: kwarg → `{Layer}ResourceProfileId` in env_config → None (no-op)
- [x] GAP-03: `BronzeResourceProfileId` + `GoldResourceProfileId` seed rows (null default)
- [x] GAP-03: 11 new tests in `TestApplyLayerSparkConfigResourceProfile` + `TestResourceProfileSeed`
- [x] GAP-06: ADR-041 amended with RTI Eventstream opt-in section
- [x] GAP-06: `_emit_to_eventstream` helper + guarded `requests` import in `nb_log_event.py`
- [x] GAP-06: RTI lookup + emit block at end of `log_event` — best-effort, two-layer try/except
- [x] GAP-06: `EnableRTIObservability` + `RTIEventstreamEndpoint` seed rows added
- [x] GAP-06: `infrastructure/modules/rti-workspace.bicep` documentation placeholder
- [x] GAP-06: `scripts/13-deploy-rti-observability.ps1` — KQL DB + Eventstream + Activator
- [x] GAP-06: `Deploy_RTI` stage in `azure-pipelines.yml` (opt-in via `ENABLE_RTI_OBSERVABILITY`)
- [x] GAP-06: 7 new tests in `TestRTIEventstreamEmit` + `TestRTISeedRows`
- [x] Roast GAP-03: 2 HIGHs fixed (empty-string guard, sparkContext None safety)

**Score actual:** 352 → 363 (+11) ✅ matched estimate

**TDs raised this sprint:** TD-063, TD-063b, TD-063c
**TDs closed this sprint:** none
**Carryover to Sprint 4:** none — Sprint 4 is independent (Fabric SQL Phase A)

---

### Sprint 4 — Fabric SQL Phase A (dual-write PoC)

**Status:** `COMPLETE`
**Branch:** `claude/review-recent-commits-Auyjc`
**Started:** 2026-05-03
**Completed:** 2026-05-03
**ADRs:** ADR-047 ✅ committed (Proposed)
**Task cards:** `.agents/sprints/task-cards/task-GAP-05.md`
**Sprint plan:** `.agents/sprints/plans/sprint-04-fabric-sql-phase-a-dual-write.md`

**Deliverables:**
- [x] GAP-05: TD-044, TD-048, TD-049, TD-050 fixed inline (pre-flight gate)
- [x] GAP-05: `src/notebooks/nb_utils_fabric_sql.py` — full CRUD DAL + SQLite stub via `PEGGY_SQL_STUB=sqlite`
- [x] GAP-05: `tests/test_nb_utils_fabric_sql.py` — 10 tests green (CRUD + seed rows)
- [x] GAP-05: `config/seed-dev.json` — `FabricSqlControlDb` null row in `EnvironmentConfig`
- [x] GAP-05: `log_control_event` in `nb_log_event.py` — dual-write path (Delta authoritative + Fabric SQL optional)
- [x] GAP-05: `tests/test_nb_log_event.py` — 4 new `TestDualWriteFabricSql` tests green
- [x] GAP-05: `scripts/14-manage-fabric-sql-db.py` — Fabric SQL DB lifecycle (create/get/list/delete/connection-string)
- [x] GAP-05: `config/control-schema/fabric-sql/01-create-tables.sql` — T-SQL DDL for 6 control tables
- [x] GAP-05: ADR-047 committed (status: Proposed)
- [🔁] GAP-05: `scripts/14-manage-fabric-sql-db.py` live smoke (create + connection-string) → Sprint 5
- [🔁] GAP-05: `01-create-tables.sql` applied in live Fabric SQL DB → Sprint 5

**Score actual:** 363 → 363 (0) ✅ matched estimate (score moves at Phase C)

**TDs raised this sprint:** none
**TDs closed this sprint:** TD-044, TD-048, TD-049, TD-050
**Carryover to Sprint 5:** Live Fabric workspace smoke tests for `scripts/14-manage-fabric-sql-db.py`

---

### Sprint 5 — Fabric SQL Phase B (read migration)

**Status:** `COMPLETE`
**Branch:** `claude/review-recent-commits-Auyjc`
**Started:** 2026-05-03
**Completed:** 2026-05-03
**ADRs:** ADR-047 updated (Proposed → Accepted — Phase B)
**Task cards:** `.agents/sprints/task-cards/task-GAP-05-phase-b.md`
**Sprint plan:** `.agents/sprints/plans/sprint-05-fabric-sql-phase-b-read-migration.md`

**Deliverables:**
- [x] GAP-05: `_get_fabric_sql_conn` bootstrap read (direct Delta SQL, no recursion)
- [x] GAP-05: `_get_config_from_fabric_sql` router in `nb_utils_config.py` (EnvVariables, RunbookSteps, ObjectConfig, ConnectionConfig)
- [x] GAP-05: `get_config` routes to Fabric SQL when `FabricSqlControlDb` set; Delta fallback intact
- [x] GAP-05: `get_runbook_steps`, `upsert_runbook_step`, `get_object_config`, `upsert_object_config`, `get_connection_config` in `nb_utils_fabric_sql.py`
- [x] GAP-05: `_bootstrap_stub` extended with RunbookStep, ObjectConfig, ConnectionConfig SQLite tables
- [x] GAP-05: `config/control-schema/fabric-sql/02-add-runbook-step.sql` DDL committed
- [x] GAP-05: `seed_control_db()` in `nb_seed_control_lh.py` — dual-write seeding; `%%configure -f` commented + notebookutils guarded
- [x] GAP-05: `tests/test_nb_seed_control_lh.py` — 2 new tests green
- [x] GAP-05: `TestGetConfigFabricSqlRouting` — 3 new tests green
- [x] GAP-05: `TestRunbookStepCRUD`, `TestObjectConfigCRUD` — 4 new tests green
- [x] ADR-047 status → Accepted — Phase B in progress
- [🔁] `02-seed-runbook-steps.sql` seed file → Sprint 6 (Phase C)
- [🔁] Manual smoke: live `FabricSqlControlDb` routing — blocked on live Fabric workspace → Sprint 6
- [🔁] `scripts/14` live smoke + `01-create-tables.sql` applied — carried from Sprint 4, blocked on live Fabric workspace → Sprint 6

**Score actual:** 363 → 363 (0) ✅ matched estimate (score moves at Phase C)

**TDs raised this sprint:** none
**TDs closed this sprint:** none
**Carryover to Sprint 6:** Seed SQL file; live Fabric smoke tests for Phase B + Phase A carryover

---

### Sprint 6 — Fabric SQL Phase C (full migration, Delta retired)

**Status:** `COMPLETE`
**Branch:** `claude/review-recent-commits-Auyjc`
**Started:** 2026-05-03
**Completed:** 2026-05-03
**ADRs:** ADR-047 updated (Accepted — Phase C complete)
**Task cards:** `.agents/sprints/task-cards/task-GAP-05-phase-c.md`
**Sprint plan:** `.agents/sprints/plans/sprint-06-fabric-sql-phase-c-full-migration.md`

**Deliverables:**
- [x] GAP-05: `get_config` unconditional Fabric SQL read via `PEGGY_SQL_CONN` env var; Delta fallback removed
- [x] GAP-05: `conftest.py` `pytest_configure` sets `PEGGY_SQL_STUB=sqlite` + `PEGGY_SQL_CONN=stub`
- [x] GAP-05: `nb_utils_fabric_sql.execute_ddl(conn_str, ddl)` helper added
- [x] GAP-05: `nb_bootstrap.create_control_tables(sql_conn=...)` routes to Fabric SQL DDL via `execute_ddl`
- [x] GAP-05: `_create_control_tables_fabric_sql` — T-SQL DDL for 6 control-plane tables
- [x] GAP-05: `seed_control_db()` `fabric_sql_conn` parameter now required (no `=None` default)
- [x] GAP-05: Delta `log_control_event` write path removed; Fabric SQL via `PEGGY_SQL_CONN` is sole path
- [x] GAP-05: `FabricSqlControlDb` removed from `config/seed-dev.json` (no longer a feature flag)
- [x] GAP-05: `config/control-schema/fabric-sql/03-views.sql` created (`vw_pipeline_summary`, `vw_watermark_health`)
- [x] GAP-05: `docs/framework-comparison.md` ID31 updated `0/3 → 3/3`
- [x] GAP-05: ADR-047 status → Accepted — Phase C complete
- [🔁] Live Fabric commissioning (SQL files applied, `nb_env_setup` conn str, Power BI DirectQuery, Delta drop) → TD-064

**Score actual:** 363 → 381 (+18) ✅ matched estimate

**TDs raised this sprint:** TD-064
**TDs closed this sprint:** none
**Carryover:** TD-064 (requires live Fabric workspace — no further planned sprint)

---

### Sprint 8 — Data awareness (Bronze profiling + PII auto-discovery)

**Status:** `COMPLETE` ✅
**Branch:** `claude/new-session-Jgqbi` (all work on `vnext`)
**ADRs:** ADR-048 (Bronze profiling) ✅ Accepted, ADR-049 (PII auto-discovery — tiered regex/presidio-sm/Fabric-UDF) ✅ Accepted
**Task cards:** `__inbox/__todo/20260503/task-GAP-07.md`, `__inbox/__todo/20260503/task-GAP-08.md`
**Sprint plan:** `__inbox/__todo/20260502/sprints/sprint-07-data-awareness.md`

**Pre-existing open High TD:** TD-064 (live Fabric SQL commissioning — requires live workspace). Out of scope for this sprint. Does not block new profiling/PII features.

**Planned deliverables:**
- [x] GAP-07: `nb_bronze_profiling.py` — `log_profile` + `drift_check`; `ColumnStats.DistributionHistogram` column
- [x] GAP-07: `nb_landing_to_bronze._call_bronze_profiling` integration (child notebook call)
- [x] GAP-07: `BronzeProfilingDriftThreshold` seed row in `config/seed-dev.json`
- [x] GAP-07: ADR-048 committed before first implementation commit
- [x] GAP-08: `nb_pii_scanner.py` — tiered PII scanner (regex → presidio-sm → Fabric UDF)
- [x] GAP-08: `profiling.PiiCandidates` DDL in `nb_bootstrap.py` (8 columns incl. ScanTier)
- [x] GAP-08: `nb_catalog_sync._apply_pii_auto_flag` integration (auto-confirms Confidence ≥ 0.9)
- [x] GAP-08: `PiiScanConfidenceThreshold` + `PiiScanTier` seed rows in `config/seed-dev.json`
- [x] GAP-08: ADR-049 amended to tiered architecture before first implementation commit

---

### Sprint 9 — Quality enforcement (Pandera contracts)

**Status:** `COMPLETE ✅`
**Branch:** `vnext`
**ADRs:** ADR-050 committed `c3021df`
**Task cards:** `.agents/sprints/task-cards/task-GAP-09.md`
**Completed:** 2026-05-05

**Deliverables completed:**
- [x] GAP-09: `nb_data_quality_contracts.py` — `build_schema` + `validate_dataframe`; quarantine write
- [x] GAP-09: `control.TableContracts` DDL confirmed with `IsEnabled` column
- [x] GAP-09: `nb_bronze_to_silver._validate_with_contracts` integration
- [x] GAP-09: ADR-050 committed before first implementation commit
- [x] Tidy: `process_object` CC=23 → extract `_validate_with_contracts` stub (structural only)

---

### Sprint 9 — PIM control plane (Data Product Catalogue)

**Status:** `COMPLETE ✅`
**Branch:** `vnext`
**ADRs:** ADR-051 committed `f7d4d15`
**Task cards:** `__inbox/__todo/20260503/task-GAP-10.md`

**Deliverables completed:**
- [x] GAP-10: `control.DataProduct` DDL in `nb_bootstrap.py`
- [x] GAP-10: `nb_data_product_catalog.py` — `register_product`, `update_product`, `deprecate_product`, `find_products_by_domain`
- [x] GAP-10: `config/seed-dev.json` example `DataProduct` seed row
- [x] GAP-10: ADR-051 committed before first implementation commit

---

### Sprint 11 — OpenMetadata integration

**Status:** `COMPLETE ✅`
**Branch:** `vnext`
**ADRs:** ADR-052 committed `d27de1c` (OpenMetadata vs Purview boundary) ✅
**Task cards:** `__inbox/__todo/20260503/task-GAP-11.md`
**Started:** 2026-05-05
**Closed:** 2026-05-05
**Prerequisite:** Sprint 10 (GAP-10) COMPLETE ✅

**Deliverables:**
- [x] GAP-11: `ConnectionConfig.AuthProfile` DDL column in `nb_bootstrap.py`
- [x] GAP-11: `OpenMetadataBaseUrl` + `OpenMetadataToken` seed rows in `config/seed-dev.json`
- [x] GAP-11: `resolve_bearer_token` JWT auth profile guard clause in `nb_conn_rest.py`
- [x] GAP-11: `nb_openmetadata_sync.py` — `_build_lineage_event`, `sync_data_product`, `sync_gold_objects`
- [x] GAP-11: ADR-052 committed before first implementation commit ✅

**Notes:** All 5 cycles were speculatively pre-implemented. 33 tests verified green; 1015 total suite passing (7 skipped). Sprint closed via verification — no fresh code written in sprint.

---

## TD-sprint-1 — Tech Debt Hardening (Sprint 1 followup)

**Status:** COMPLETE
**Date:** 2026-05-03
**Branch:** `claude/review-recent-commits-Auyjc`

**TDs closed:** TD-040, TD-047 (MED-2/3), TD-052, TD-053, TD-057, TD-059, TD-060, TD-061, TD-063b, TD-063c
**TDs raised:** none
**Score:** 381 → 381 (quality; no feature score change)

---

## TD-sprint-2 — Tech Debt Hardening (continued)

**Status:** COMPLETE
**Date:** 2026-05-03
**Branch:** `claude/review-recent-commits-Auyjc`
**Task cards:** `.agents/sprints/task-cards/task-TD-sprint-2.md`

**Cycles:**
- Tidy A: `nb_utils_fabric.py` ruff format + noqa pass (TD-051 cosmetic)
- Tidy B: `build_dag` extract `_build_activity_dict` + `_expand_fan_out` (TD-046 prereq)
- Cycle 1: `create_secret` CC D(24)→B(8) via helper extraction + 8 behaviour-locking tests (TD-051)
- Cycle 2: `build_dag` MEDIUM-02/04/05 defensive guards (TD-046)
- Cycle 3: 46 HTTP calls timeout= added + 6 magic lines prefixed; AST test; S113=0 (TD-054)
- Cycle 4: `_stub_pyspark()` in test_nb_utils_config.py; test_populated_tables_are_written passes (TD-056)
- Cycle 5: 10 collection errors → 0; importorskip guards + module-level skip (TD-041)

**TDs closed:** TD-041, TD-046 (MEDIUM-02/04/05), TD-051, TD-054, TD-056
**TDs raised:** none
**Score:** 381 → 381 (quality; no feature score change)

---

## TD-sprint-3 — Tech Debt Hardening (continued)

**Status:** COMPLETE
**Date:** 2026-05-03
**Branch:** `claude/review-recent-commits-Auyjc`
**Task cards:** `.agents/sprints/task-cards/task-TD-sprint-3.md`

**Cycles:**
- Tidy A: `nb_orchestrator.py` noqa pass — B018/E402/E501/S608 (TD-039)
- Tidy B: `nb_conn_jdbc.py` noqa pass — B018/E402/E501/S608/S108 (TD-043)
- Cycle 1: behaviour-locking tests for `_run_d365_shortcuts` (3 tests) [RED] (TD-055)
- Tidy C: extract `_mark_existing_shortcuts`, `_probe_source_lakehouses`, `_mark_not_found` — CC 30→13 (TD-055)
- Cycle 2: extract `_resolve_landing_files_root` from `run_rest_ingestion` — CC 29→14 (TD-055)
- Cycle 3: print warning when `_DEFAULT_OAUTH_SCOPE` fallback triggers (TD-062)
- DoD: global `requests`/`msal` stubs in conftest.py + project root on sys.path — suite 711→720 (TD-042, TD-058)

**TDs closed:** TD-039, TD-042, TD-043, TD-055, TD-058, TD-062
**TDs raised:** none
**Score:** 381 → 381 (quality; no feature score change)
**Test suite:** 720 passed, 5 pre-existing failures, 10 skipped

---

## Score progression

| After | Score | % | Delta |
|---|:---:|:---:|:---:|
| Baseline | 325 | 83% | — |
| Sprint 1 | 338 | 87% | +13 |
| Sprint 2 | 352 | 90% | +14 |
| Sprint 3 | 363 | 93% | +11 |
| Sprint 4 | 363 | 93% | 0 |
| Sprint 5 | 363 | 93% | 0 |
| Sprint 6 | 381 | 98% | +18 ✅ |
| TD-sprint-1 | 381 | 98% | 0 (quality) |
| TD-sprint-2 | 381 | 98% | 0 (quality) |
| TD-sprint-3 | 381 | 98% | 0 (quality) |
| Sprint 7 | COMPLETE ✅ | — | GAP-07 ✅, GAP-08 ✅ |
| Sprint 8 | COMPLETE ✅ | — | GAP-09 ✅ |
| Sprint 9 | COMPLETE ✅ | — | GAP-10 ✅ |
| Sprint 10 | COMPLETE ✅ | — | GAP-11 ✅ |

---

### Sprint 7 — JSON unpack pipeline

**Status:** `COMPLETE`
**Branch:** `feat/dev-diary`
**Started:** 2026-05-03
**Completed:** 2026-05-03
**Task cards:** `__inbox/__todo/20260503/task-GAP-07.md`

**Score actual:** 381 → 381 (quality sprint — infrastructure for JSON unpack; no feature score change until UnpackSpec rows are activated)

**Deliverables:**
- [x] Tidy A: `create_control_tables` CC=16 → 5 (2ff64ea)
- [x] Tidy B: `run_view_seeder` CC=16 → 8 (c560ae5)
- [x] Cycle 1: `control.UnpackSpec` DDL added; `PendingMaterializedViews` removed from bootstrap (8382078)
- [x] Cycle 2: `profiling.ColumnStats.PathExpression` migration guard (c9199cc)
- [x] Cycles 3–7: `nb_json_unpack_sync.py` — `discover_variant_columns`, `parse_variant_schema_to_paths`, `derive_candidate_unpack_rows`, `merge_unpack_proposals`, `run_json_unpack_sync` — 22 tests (5ddc324)
- [x] Cycle 8: remove dead materialized-view code from `nb_view_seeder.py` (5c2c27d)
- [x] Cycle 9: `load_unpack_spec` + `build_view_ddl` UnpackSpec support (7a5555d)
- [x] Tidy: mypy `type: ignore` suppressions for Fabric execution cell in `nb_json_unpack_sync.py` (8af69e0)
- [x] Roast fix: `_scalar_projection` strips `$.` prefix for valid Fabric VARIANT SQL (5367a82)
- [x] Roast fix: `load_unpack_spec` wired into `run_view_seeder` (was dead code) (5367a82)

**Test suite:** 84 passing (was 81; +3 from roast fixes)

**Quality gates:**
- mypy `nb_json_unpack_sync.py`: ✅ 0 errors
- bandit: ✅ 0 HIGH; 6 MEDIUM B608 (pre-existing spark.sql pattern)
- Coverage per file: nb_json_unpack_sync 87% ✓, nb_view_seeder 64% ✓ (Fabric-only ABFSS blocks), nb_bootstrap 54% ✓
- CC: all sprint functions ≤8 ✅

**TDs raised this sprint:** none
**TDs closed this sprint:** none
**Carryover:** `schema_of_variant_agg` profiling (VARIANT runtime-only — deferred; `discover_variant_columns` returns empty `schema_str` until a future sprint adds the profiling SQL)

---

### Sprint 12 — Deployment Excellence

**Status:** `COMPLETE`
**Branch:** vnext
**Commits:** `9f8fafc` → `e7a2d49` (nosec/noqa fixup committed separately)
**Date:** 2026-05-05
**ADRs:** none required
**Sprint plan:** `.agents/sprints/plans/sprint-12-deployment-excellence.md`
**Task card:** `__inbox/__todo/20260505/task-SPRINT-12.md`
**Feature plan phase:** Phase 1
**Tests added:** +50 new tests (1142 total, 7 skipped)

**Deliverables:**
- [x] `nb_environment_validator.py` — 7 validation checks; `ValidationResult` dict; `SkipKVCheck` param (23 tests)
- [x] `nb_connection_test.py` — JDBC / REST / File / Dataverse / KV test paths (15 tests)
- [x] `azure_deployment.py` — `_probe_workspace_identity()` + `wi_available` traitlet; WI as default in Step 1 UI (5 tests)
- [x] `config/seed-template.json` — documented template with `_comment_<key>` annotations (4 tests)
- [x] `__inbox/peggy_os_workspace/README.md` — documents build pipeline + relationship to `peggy-hub-ui` repo (3 tests)
- [x] `Step1Bootstrap.jsx` — WI radio shown when `wi_available=true`; SPN demoted to fallback

---

### Sprint 13 — Source Onboarding Wizard

**Status:** `COMPLETE`
**Branch:** vnext
**Started:** 2026-05-06
**Completed:** 2026-05-06
**ADRs:** ADR-056 ✅ Accepted
**Sprint plan:** `.agents/sprints/plans/sprint-13-source-onboarding.md`
**Task card:** `__inbox/__todo/20260506/task-sprint-13.md`
**Feature plan phase:** Phase 2
**Prerequisite:** Sprint 12 COMPLETE (nb_connection_test.py required by wizard Step 3)

**Planned deliverables:**
- [x] `nb_jdbc_introspect.py` — PK inference; proposed `ObjectConfig` rows with `IsActive=False`; TD-038
- [x] `nb_source_wizard.py` — 7-step guided source registration for JDBC/REST/File/Dataverse
- [x] Cleansing rule wizard tab in `nb_maintenance_objectconfig.py` — 4 rule types + preview
- [x] `CleansingRules.RuleType` migration guard in `nb_bootstrap.py`
- [x] TD-038 marked resolved

---

### Sprint 14 — Observability

**Status:** `COMPLETE`
**Completed:** 2026-05-06
**Branch:** `vnext`
**ADRs:** none required
**Sprint plan:** `.agents/sprints/plans/sprint-14-observability.md`
**Feature plan phase:** Phase 3
**Score:** 8

**Deliverables:**
- [x] `ControlLog` structured logging fields: `DurationSeconds`, `SourceRowCount`, `SinkRowCount`
- [x] `config/control-schema/fabric-sql/05-add-logging-fields.sql`
- [x] `nb_landing_to_bronze` — add `log_event` call with row counts
- [x] `PipelineMonitorPlugin` — ControlLog backend; WI token path; demo data fallback removed
- [x] `DqRulesPlugin` — History tab with pass-rate trend from `ControlLog`
- [x] `LogViewerPlugin` — ControlLog Errors tab (structured `EventType='Error'` rows)
- [x] Prerequisite: TD-036 (V-Order + CDF on Silver) ✅ already closed

---

### Sprint 15 — Connector Expansion

**Status:** `COMPLETE`
**Branch:** `vnext`
**HEAD:** `a97a5ae`
**Task card:** `__inbox/__todo/20260506/task-sprint-15.md`
**ADRs:** none required
**Sprint plan:** `.agents/sprints/plans/sprint-15-connector-expansion.md`
**Feature plan phase:** Phase 4

**Planned deliverables:**
- [x] `nb_conn_sftp.py` — config-driven SFTP + FTPS ingestion; `Protocol` ∈ `{SFTP, FTPS}`; Parquet landing; paramiko / ftplib.FTP_TLS
- [x] `nb_conn_sharepoint.py` — Graph API; List + File modes; SPN auth; TD-030
- [x] `nb_conn_jdbc.py` — `DRIVER_MAP` + `DriverType` column; Oracle/SQLMI URL formats
- [x] `ConnectionConfig.Protocol`, `Port`, `DriverType` migration guards
- [x] `IngestionConfig.SharePointSiteUrl`, `ListOrLibraryName` migration guards
- [x] TD-030 marked resolved
- **Deferred:** `nb_conn_adf.py` — ADF edge-case; Fabric pipelines are target state

**Tests:** 1257 passed, 7 skipped (+29 vs baseline 1228)

---

### Sprint 16 — Gold Domain Framework

**Status:** `COMPLETE`
**Branch:** `vnext` (commits `f381166`…`f07f136`)
**ADRs:** none required
**Sprint plan:** `.agents/sprints/plans/sprint-16-gold-domain.md`
**Feature plan phase:** Phase 5
**Prerequisite:** Sprint 13 COMPLETE

**Delivered:**
- [x] `templates/nb_gold_domain_table_template.py` — standard Gold notebook template with `{CLIENT}/{DOMAIN}/{TABLE}` tokens
- [x] `write_gold()` standardised in `nb_utils_processing.py` — overwrite/append/merge modes + `_log_ctx` / `log_event` integration
- [x] `nb_domain_scaffold.py` — 4-step Gold domain wizard (`define_domain`, `detect_table_types`, `generate_stubs`, `create_semantic_model_stub`, `run_domain_scaffold` w/ dry_run)
- [x] 18 new tests (1284 total, 7 skipped); `nb_domain_scaffold` 89% coverage; bandit/mypy clean; ruff clean on new files
- [x] Pre-existing ruff violations resolved (E401/S110/E402/S608) in `nb_utils_processing.py` — `f07f136`

---

### Sprint 17 — Security & Taskflow

**Status:** `COMPLETE`
**Branch:** `vnext` (commits `6541388`…`fd24765`)
**ADRs:** none required
**Sprint plan:** `.agents/sprints/plans/sprint-17-security-taskflow.md`
**Feature plan phase:** Phases 7 + 8
**Prerequisite:** Sprints 12–16 COMPLETE

**Delivered:**
- [x] Cycle 0: Strip BOM from `nb_environment_validator.py` — `6541388`
- [x] Cycle 1: Annotate WI-eligible `getSecret` calls in `nb_conn_jdbc.py` — `4f88ba2`
- [x] Cycle 2: WI KV bypass in `nb_conn_jdbc.py` (FabricSQL sources skip KV; `getToken` for SQL auth) — `fd3c261`
- [x] Cycle 3: `AuthModel` widget + `_toggle_spn_fields` in `nb_env_setup.py`; SPN fields hidden when WI active — `f2379d3`
- [x] Cycle 4: `wi_available` traitlet + `_probe_workspace_identity()` pre-existing in `azure_deployment.py`; 5 tests verified
- [x] Cycle 5-6: `check_workspace_identity_present` (advisory amber) + `check_kv_secret_naming` in `nb_environment_validator.py` — `b8be347`
- [x] Cycle 7: `OPERATIONS.md` — Key Vault secret naming convention documented — `819e693`
- [x] Cycles 8-9: `Taskflows/` directory with 4 `.tfx` definitions (Daily Platform Refresh, Daily Landing Refresh, Gold Runner, Weekly Optimise) — `452e931`
- [x] Cycle 10: TD-032 closed — `22026f1`
- [x] Ruff/mypy fixes — `ce434af`, `fd24765`
- [🔁] Cycle 11: `scripts/deploy_fabric_cli.sh` — deferred → TD-077

**Score:** 1284 → 1302 tests (+18)
**TDs closed:** TD-032
**TDs raised:** TD-077
**Carryover to next sprint:** None (TD-077 is backlog)

---

### Sprint 19 — Control Plane Phase 1 + Delta Table Maintenance (GAP-23)

**Status:** `COMPLETE`
**Branch:** `claude/build-daily-plan-skill-dLmia`
**Started:** 2026-05-09
**Completed:** 2026-05-09
**ADRs:** ADR-060 ✅ (Delta table maintenance strategy — V-Order, OPTIMIZE, Liquid Clustering)
**Task card:** `__inbox/__todo/20260509/task-sprint-19.md`
**Prerequisite:** Sprint 18 COMPLETE ✅

**Delivered:**
- [x] ADR-060: Delta table maintenance strategy (V-Order mandatory for Gold, OPTIMIZE weekly, Z-Order high-cardinality only)
- [x] `src/notebooks/nb_table_maintenance.py` — OPTIMIZE, VACUUM, V-Order enforcement, auto-compaction (3 TDD cycles, GAP-23)
- [x] `tests/test_nb_table_maintenance.py` — tests for OPTIMIZE, VACUUM, V-Order, auto-compaction
- [x] `src/notebooks/nb_landing_to_bronze.py` — Bronze auto-compaction enabled on write path
- [x] `tests/test_nb_landing_to_bronze.py` — asserts Bronze auto-compaction on write path
- [x] `src/notebooks/nb_environment_validation.py` — switched VariableLibrary check to `notebookutils.variableLibrary.getLibrary()`
- [x] `tests/test_nb_environment_validation.py` — updated validator tests
- [x] `src/notebooks/nb_bootstrap.py` — added annotations table DDL and `ObjectConfig` column migrations (Phase 1)
- [x] `tests/test_nb_bootstrap.py` — updated table counts and migration assertions
- [x] `scripts/smoke_livy.py` — **refactored from Batch API to Sessions API** (fix for Batch requiring `file` URI)
- [x] `tests/test_script_smoke_livy.py` — updated 13 tests for Sessions flow
- [x] `docs/adr/ADR-060-delta-table-maintenance.md`
- [x] `docs/adr/README.md` — ADR-060 registered as Accepted
- [x] `__guides/fabric-dev-workspace-setup.md` — DEV workspace provisioning guide (capacity → workspace → identity → SPN → lakehouse)

**Also delivered:**
- [x] `.agents/workflows/day-plan.md` — `/day-plan` skill workflow
- [x] `.claude/commands/day-plan.md` — Claude command stub
- [x] `.agents/TECH_DEBT.md` — TD-079 closed (HITL validated 2026-05-09, exit code 0)
- [x] `azure-pipelines.yml` — Smoke_Livy HITL comment updated; displayName → `Livy Sessions API Smoke Test`
- [x] `scripts/generate_control_erd.py` — ruff B007 fix (`schema` → `_schema`)
- [x] `scripts/generate_delta_erd.py` — ruff B007 fix (`schema` → `_schema`)

**DEV workspace provisioned this sprint:**
- Workspace `data-platform-dev` (ID: `96bb20f3-6ebd-4dce-8e01-5f00a44afda5`) on `fabdataplatformdevsuk01` (F8)
- Schema-enabled lakehouse `lh_smoke` (ID: `d65b7507-d7cd-4657-9c33-11824f190c20`, `defaultSchema=dbo`)
- SPN `sp-duk-dev-dataplatform` added as workspace Admin; secrets in `kv-duk-dev-dataplatform`

**Score:** 1310 → 1407 tests (+13 sprint-19 smoke_livy tests, 7 skipped)
**TDs closed:** TD-079 (Smoke_Livy CI stage — HITL validated 2026-05-09, exit code 0)
**TDs raised:** none
**Gaps closed:** GAP-23 (Delta table maintenance)
**Gaps partial:** CONTROL-PLANE-PHASE-1 (annotations DDL + ObjectConfig migrations delivered; full schema sync ongoing)

---

### Sprint 20 — PBI-QA — Agentic QA Framework for Power BI (Walking Skeleton)

**Status:** `COMPLETE` ✅
**Branch:** `vnext`
**Started:** 2026-05-09
**Completed:** 2026-05-09
**ADRs:** ADR-061 ✅ (Unified agentic QA framework for Power BI — promoted Proposed → Accepted 2026-05-09)
**Task card:** `__inbox/__todo/20260509/task-PBI-QA.md`
**Story map:** `__inbox/__todo/20260509/story-map-PBI-QA.md` (Revision 1) → archived to `.agents/sprints/story-maps/`
**Prerequisite:** Sprint 19 COMPLETE ✅

**Scope (9 cycles — ALL COMPLETE):**
- Cycle 1 🦴: US-001 — QA_Visual_Tests + QA_Test_Executions DDL in nb_bootstrap ✅
- Cycle 2 🦴: US-004 — PBIR parser seeds QA_Visual_Tests from fixture directory ✅
- Cycle 3: US-024 — PBIR offline config assertions (sort + filter, <1 s, no iframe) ✅
- Cycle 4 🦴: US-010 — Baseline visual data extraction + Gold SQL comparison ✅
- Cycle 5: US-011 — Cross-filter simulation with `remove_filters()` guard ✅
- Cycle 6: US-013 — Full test execution loop with per-row error isolation ✅
- Cycle 7 🦴: US-021 + US-023 — Stdout failure summary + run summary ✅
- Cycle 8 🦴: US-022 — `retest_measure()` fix validation without TMSL ✅
- Cycle 9: US-016 — CI hard-fail mode (`sys.exit(1)` + structured stdout) ✅

**Deliverables:**
- [x] `src/notebooks/nb_pbi_qa.py` (new) — 364 lines, 9 functions, PBIR parser, assertions, baseline/cross-filter tests, CI exit
- [x] `tests/test_nb_pbi_qa.py` (new) — 27 tests, all passing
- [x] `tests/fixtures/pbir_sample/` (new fixture directory) — minimal PBIR with 2 sample visuals
- [x] `src/notebooks/nb_bootstrap.py` — added QA DDL for `QA_Visual_Tests` (9 columns) + `QA_Test_Executions` (8 columns)
- [x] `tests/test_nb_bootstrap.py` — updated table count assertions, added 3 QA-specific tests
- [x] `__inbox/__todo/20260509/story-map-PBI-QA.md` + `.html` — preserved for archival
- [x] ADR-061 — committed and accepted (Accepted 2026-05-09)

**Deferred (backlog):** US-002 (PBIP Git integration), US-003 (Foundry provisioning), US-005–009 (measure dict, interaction overrides, SQL agent, live filters, BPA gate), US-012 (drill-through), US-014–015 (RCA agent, HITL widget), US-017–020 (TMSL, durable HITL, dashboard, incremental testing), US-025 (pbi_fixer fork)

**Test evidence:**
- `py -m pytest tests/test_nb_pbi_qa.py -v` — 27 passed ✅
- `py -m pytest tests/ -q --tb=no` — 1437 passed, 7 skipped, 13 subtests passed ✅ (baseline was 1407 passed; Sprint 20 added 30 tests)
- `ruff check` on Sprint 20 scope — 0 errors ✅
- `mypy src/notebooks/nb_pbi_qa.py --ignore-missing-imports --no-strict-optional` — 0 errors ✅
- Livy smoke tests (sprints 18–19) — 13 passed ✅
- **Deployment note:** fabric-cicd 1.0.0 parameter validation blocker — parameter.yml `dev:` key rejected. Workaround: Deploy to Fabric workspace deferred pending fabric-cicd rollback or parameter file migration. Local tests + build ✅, workspace deployment blocked.

**Score:** 1407 → 1437 tests (+30 net tests for walking skeleton + QA DDL coverage)
**TDs raised:** TD-081 (fabric-cicd 1.0.0 parameter file migration)
**TDs closed:** TD-081 ✅ (resolved 2026-05-09 via `scripts/deploy_sprint20_notebooks.py` REST API workaround)
**Carryover:** Foundry provisioning (US-003, priority 15) → Sprint 21; PBIP Git (US-002, priority 14) → Sprint 21

---

### Sprint 18 — OneLake RBAC + Livy CI smoke

**Status:** `COMPLETE`
**Branch:** `claude/chat-handoff-read-bfcwR`
**Started:** 2026-05-07
**Completed:** 2026-05-09
**ADRs:** ADR-057 ✅ (OneLake Data Access Roles — Accepted)
**Task card:** `.agents/sprints/task-cards/task-GAP-21.md`
**Sprint scope:** `__inbox/__todo/20260507/sprint-18-scope.md`
**Prerequisite:** Sprint 17 COMPLETE ✅

**Delivered:**
- [x] ADR-057: OneLake Data Access Roles — deny-by-default model, per-layer role assignments (`4921eb4`)
- [x] `scripts/20-configure-onelake-access-roles.py` — 5 TDD cycles: list/create/ensure/configure-layer/configure-all-layers
- [x] `config/seed-dev.json` + `config/seed-template.json` — `OneLakeAccessRolesEnabled: false`
- [x] `tests/test_script_20_configure_onelake_access_roles.py` — 5 tests, all GREEN
- [x] `scripts/smoke_livy.py` — token acquisition, batch submit, poll-until-done (3 TDD cycles)
- [x] `tests/test_script_smoke_livy.py` — 3 tests, all GREEN
- [🔁] `azure-pipelines.yml` Smoke_Livy stage — blocked on HITL validation (→ TD-079)

**Also delivered (pre-existing failures fix):**
- Fixed 31 pre-existing test failures: pandas/traitlets/anywidget installed; `requests.exceptions` conftest stub; pii-scanner IP/MAC regex fallbacks + IBAN false-positive
- `tidy(nb-bootstrap)`: extracted `_migrate_table` helper — `_apply_control_migrations` CC 14→8

**Score:** 1302 → 1310 tests (+8 sprint-18 tests; +40 pre-existing fixes unblocked)
**TDs closed:** none
**TDs raised:** TD-079 (Smoke_Livy CI stage awaiting HITL)
**Carryover from Sprint 17:** TD-077 (backlog, not active carryover)
