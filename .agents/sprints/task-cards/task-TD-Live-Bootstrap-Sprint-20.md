---
sprint_id: TD-Live-Bootstrap-Sprint-20
sprint: Sprint 20 (Phase 1)
status: COMPLETE
adr_required: NOT REQUIRED
---

# Task: Tech Debt — Live Env + Bootstrap (Sprint 20 Phase 1–2)

**Status**: COMPLETE FOR SCOPE (TD-076, TD-063, TD-078 done; TD-064 deferred)
**Vibe Mode**: COMMISSIONING
**Branch**: `vnext` (local tranche complete, live workspace ready)
**Sprint**: Sprint 20 — Phase 1–2 (Live + Bootstrap)
**Effort**: 4–5 hrs (TD-064 deferred pending Fabric SQL Control DB remediation)
**Score impact**: +8 pts now (TD-076/TD-063/TD-078), +7 pts when TD-064 completes

---

## LOCAL TRANCHE COMPLETE ✅

**Commit**: `46873ca` — Local Phase 1 quick wins + task cards  
**Validation**: All 1488 tests pass; ready for live execution  
**Next Phase**: Carry TD-064 to a later sprint after Fabric SQL Control DB remediation

---

**TDs in scope**: TD-076, TD-078, TD-063 (all complete)

---

## Context (The Elephants 🐘)

### 1. **TD-078 — `control.annotations` table missing** (20 min, LOCAL)

**Problem**: `nb_bootstrap.py` creates 13 control tables but `annotations` is missing.
- Used by data quality / data governance workflows to attach metadata to objects
- Not seeded in `seed-dev.json`
- Blocks GAP-07 (Bronze profiling with whylogs)

**Strategy**:
- Add `control.annotations` DDL to `nb_bootstrap.py` (model on existing tables)
- Columns: `AnnotationID`, `TableName`, `ColumnName`, `Comment`, `Author`, `CreatedAt`, `IsResolved`
- Add helper function `_create_annotations_table(spark)` following existing pattern
- Integrate into `_create_control_tables()` orchestration
- Write unit test in `tests/test_nb_bootstrap.py`
- Local-only (no seed data required)

**Status**: ✅ Completed (implemented and validated locally)

---

### 2. **TD-076 — Apply CleansingRules migration in live DEV** (5 min, LIVE)

**Problem**: `control.ObjectConfig` missing `CleansingRules` column in live DEV workspace.
- Already guarded in code via `_add_column_if_missing()` (added Sprint 19)
- Needs verification in live workspace

**Strategy**:
- Trigger `nb_bootstrap` in live DEV workspace via `scripts/06b-trigger-notebook-bootstrap.ps1`
- Verify: Query `control.ObjectConfig` → check for `CleansingRules STRING` column
- If present, mark TD-076 DONE
- If absent, investigate Fabric SQL schema evolution

**Status**: ✅ Complete (live verification executed)

---

### 3. **TD-063 — `setLocalProperty` Fabric API verification** (30 min, LIVE)

**Problem**: `nb_utils_config.apply_layer_spark_config()` uses `setLocalProperty()` for Spark tuning.
- Needs verification that Spark correctly applies layer-specific settings (Bronze, Silver, Gold)
- No existing test in live workspace
- Blocks potential V-Order issues in Gold layer

**Strategy**:
- Run Bronze → Silver → Gold layer jobs in live DEV workspace
- For each layer:
  - Verify Spark config properties set correctly (check `spark.conf.get()` output)
  - Verify output V-Order or other layer-specific optimization applied
- Review Fabric API docs for `setLocalProperty` alternatives (if preferred)
- Document findings in diary entry

**Status**: ✅ Complete (live verification executed)

---

### 4. **TD-064 — GAP-05 live commissioning** (3–4 hrs, LIVE, DEFERRED ⏸️)

**Problem**: Core SQL schema not applied to live Fabric workspace. Entire medallion pipeline blocked.
- Landing → Bronze → Silver → Gold schema must be deployed
- Smoke tests (11 connector types) fail on schema not found
- Power BI DirectLake semantic model not wired
- Delta optimization not enabled
- **Blocks all downstream analytics**

**Strategy**:
- **Phase A — SQL Schema Deployment** (1 hr)
  - Extract DDL from `nb_bootstrap.py` + `nb_landing_to_bronze.py` + `nb_silver_transform.py` + `nb_gold_...py`
  - Run in live DEV via Livy or RunNotebook
  - Verify: `spark.sql("SHOW TABLES IN control/bronze/silver/gold")`
  
- **Phase B — Smoke Tests** (1 hr)
  - Fix connector notebook metadata: patch `default_lakehouse_name: db_control` → `lh_smoke`
  - Re-run `scripts/08-run-smoke-tests.ps1`
  - Target: All 11 connector types succeed (JDBC, REST, file, shortcut, Dataverse, etc.)
  - Verify: Landing tables populated with test data

- **Phase C — Power BI Wiring** (0.5–1 hr)
  - Create DirectLake semantic model pointing to Gold layer
  - Verify: Can query semantic model from Power BI Desktop
  - Document: Power BI setup steps for CI/CD automation

- **Phase D — Delta Optimization** (0.5 hr)
  - Run `nb_optimize.py` in live DEV
  - Verify: OPTIMIZE + VACUUM executed on all layers
  - Verify: V-Order enabled on Gold layer tables

**Status**: ⏸️ **DEFERRED** — Move to a later sprint. Prerequisite: Fabric SQL Control DB must be remediated and verified stable first.

---

## Recommended Sequence

### Option A — Quick Wins First (build confidence, 1.5 hrs)
```
1. TD-078 (20 min) — local, no live workspace needed
2. TD-070 (15 min) — en dashes cleanup (from Group 3)
3. TD-071 (30 min) — deduplication (from Group 3)
   ↓
   Commit: "feat(bootstrap): add annotations table + hygiene fixes"
   ↓
4. TD-076 (5 min) — live workspace verification
   ↓
5. TD-064 (3–4 hrs) — MAIN WORK
```

### Option B — Deep Dive (full day)
```
1. TD-078 (20 min)
2. TD-076 (5 min) in live
3. TD-063 (30 min) in live
4. TD-064 (3–4 hrs) in live → **UNBLOCKS ENTIRE MEDALLION**
```

---

## Exit Criteria (DoD — Definition of Done)

**TD-078 DONE** when:
- [x] `_create_annotations_table(spark)` implemented in `nb_bootstrap.py`
- [x] Unit tests pass: `pytest tests/test_nb_bootstrap.py -k annotation`
- [x] No regressions: `pytest tests/ -q --tb=no` — 1488 tests pass
- [x] Commit included in Sprint 20 local tranche (`46873ca`)

**TD-076 DONE** when:
- [x] `nb_bootstrap` run attempted via `06b-trigger-notebook-bootstrap.ps1` with Livy fallback success
- [x] Schema verification: `DESCRIBE TABLE control.ObjectConfig` confirms `CleansingRules` column exists (`True`)
- [x] Diary entry recorded in `diary/entries/2026-05-11_vnext_bootstrap-smoke-fix.md`

**TD-063 DONE** when:
- [x] Live Spark session verification executed for BRONZE / SILVER / GOLD
- [x] Verified `spark.conf.get()` layer settings:
  - BRONZE: `optimizeWrite=true`, `autoCompact=null`
  - SILVER: `optimizeWrite=true`, `autoCompact=true`
  - GOLD: `optimizeWrite=true`, `autoCompact=true`, `targetFileSize=134217728`, `vorder=true`
- [x] Verified `setLocalProperty("spark.fabric.resourceProfile", ...)` round-trip for all layers
- [x] Diary entry recorded in `diary/entries/2026-05-11_vnext_bootstrap-smoke-fix.md`

**TD-064 DONE** when:
- [ ] All 11 smoke tests pass: `scripts/08-run-smoke-tests.ps1` exits 0
- [ ] Smoke tables populated in live Landing layer
- [ ] Bronze → Silver → Gold transformations execute successfully
- [ ] Power BI semantic model created + queryable from Desktop
- [ ] `nb_optimize.py` completes without errors
- [ ] Diary entry: "2026-05-11 TD-064 GAP-05 commissioning complete in live DEV"
- [ ] ADR written: ADR-052 (live workspace lessons learned)

---

## Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Live Fabric workspace | ✅ Available | Workspace ID: 96bb20f3-6ebd-4dce-8e01-5f00a44afda5 |
| SQL DB: BFL_DEV_db_control | ✅ Available | Pre-created |
| Lakehouse: lh_smoke | ✅ Available | Fallback for connector defaults |
| Variable Library: Platform_Config | ✅ Available | Value set: `dev` |
| Azure AI Foundry project | ❓ TBD | Needed for TD-064 Phase D (Power BI + AI integration) |

---

## Notes

- **TD-064 deferred by decision**: Do not execute GAP-05 live commissioning in this sprint.
- **Primary prerequisite before resuming TD-064**: Fabric SQL Control DB remediation and validation in live DEV.
- **TD-076 evidence (live)**: `TD076_CLEANSINGRULES_COLUMN_EXISTS=True`
- **TD-063 evidence (live)**: `TD063_LAYERS={...}` confirmed expected per-layer Spark config behavior
- **TD-078 evidence (local)**: `pytest tests/test_nb_bootstrap.py -k annotation -v` -> `2 passed`
- **Live workspace available**: No more local-only development; use live DEV for end-to-end validation
- **Connector notebook metadata bug**: All 11 connectors have `default_lakehouse_name: db_control` baked into `.ipynb`. Must patch to `lh_smoke` before Livy session startup (pattern: `Patch-IPYNB` used in `06b`)
- **Expected test additions**: `tests/test_nb_bootstrap.py` + `tests/test_nb_optimize.py` may need live workspace mocking

## Sprint Close Log

- **Sprint close 2026-05-11**: DoD complete for TD-076, TD-063, TD-078. Carryover: TD-064 (deferred by decision; prerequisite Fabric SQL Control DB remediation). TDs closed: TD-076, TD-063, TD-078.
