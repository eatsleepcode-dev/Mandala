---
gap_id: GAP-03
sprint: 3
status: COMPLETE
completed_date: 2026-05-02
adr_required: none
tds_raised: [TD-063]
---

# Task: GAP-03 — Spark resource profiles per workload

**Status**: COMPLETE
**Vibe Mode**: CREATION
**Branch**: `claude/review-recent-commits-Auyjc`
**Sprint**: 3
**Effort**: M (1–2 days)
**Score impact**: +4 pts (combined with GAP-06 → 352 → 363)

---

## Context (The Elephants 🐘)

1. **`apply_layer_spark_config` signature clash — `env_config` vs `resource_profile_id`**: The
   sprint plan proposes a new signature `(spark, layer, resource_profile_id=None)` that
   *removes* `env_config`. But the existing function relies on `env_config` to read
   `GoldTargetFileSizeBytes` and `VOrderEnabled` for Gold-layer config. Dropping `env_config`
   breaks existing Gold optimisation behaviour.
   - *Strategy*: Keep `env_config` as third positional arg (backwards compatible with all 8+
     existing call sites). Add `resource_profile_id: str | None = None` as fourth optional kwarg.
     Also read `{Layer}ResourceProfileId` from `env_config` when the kwarg is not supplied, so
     orchestration notebooks don't need to be updated — they just get the seed row automatically.
   - *Status*: ⏳ Pending — Cycle 1

2. **`spark.sparkContext.setLocalProperty` vs `spark.conf.set`**: Resource profiles are
   injected via `sparkContext.setLocalProperty`, not `spark.conf.set`. The SparkContext is a
   different object from the SparkSession. In offline tests `spark.sparkContext` is a
   `MagicMock()` attribute so calls succeed, but in production the property name
   `"spark.fabric.resourceProfile"` must be exact — there is no validation at call time.
   - *Strategy*: Wrap in `hasattr` guard: if `spark.sparkContext` is accessible, call
     `setLocalProperty`; else silently skip (maintains testability without a live Spark cluster).
     Document the exact Fabric property name as a constant `_FABRIC_RESOURCE_PROFILE_PROPERTY`.
   - *Status*: ⏳ Pending — Cycle 1

3. **`EnvironmentConfig` key naming convention**: The existing EnvironmentConfig rows use
   `PascalCase` (`GoldTargetFileSizeBytes`, `VOrderEnabled`). The new keys must follow the
   same convention: `BronzeResourceProfileId`, `GoldResourceProfileId`. The layer-to-key
   mapping in `apply_layer_spark_config` must use `title()` casing: `BRONZE` → `Bronze`.
   No Silver resource profile row is needed — Silver uses the same capacity default as Bronze.
   - *Status*: ⏳ Pending — Cycle 2 (env_config lookup), Cycle 3 (seed)

4. **Backwards-compatible fallback ordering**: When `resource_profile_id` is `None` AND
   `env_config` doesn't contain the key (e.g. old callers without the new seed rows), the
   function must not raise — it must silently use the capacity default. This is the correct
   production behaviour (not all layers have a custom resource profile).
   - *Strategy*: `resource_profile_id = resource_profile_id or env_config.get(f"{layer.title()}ResourceProfileId")`.
     If still None after both, skip the `setLocalProperty` call.
   - *Status*: ⏳ Pending — Cycle 1

---

## Live DEV Migration SQL

```sql
-- EnvironmentConfig: add ResourceProfile rows (new rows only — no DDL/schema change)
-- Run once per DEV/UAT/PROD environment that has an existing EnvironmentConfig table.
INSERT INTO control.EnvironmentConfig (EnvName, ParameterName, ParameterValue, Description)
VALUES
  ('dev', 'BronzeResourceProfileId', NULL,
   'Fabric Resource Profile ID for Bronze ingestion notebooks. NULL = capacity default.'),
  ('dev', 'GoldResourceProfileId', NULL,
   'Fabric Resource Profile ID for Gold V-Order notebooks. NULL = capacity default.');

-- Production example (do NOT auto-deploy; set via ADO variable group):
-- ('prod', 'BronzeResourceProfileId', 'rp-memory-optimised', '...'),
-- ('prod', 'GoldResourceProfileId',   'rp-compute-optimised', '...')
```

---

## Execution Plan (Ralph's Ledger)

### Cycle 1 — `apply_layer_spark_config` sets resource profile from explicit kwarg

- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestApplyLayerSparkConfigResourceProfile::test_sets_resource_profile_when_id_provided`
      — pass `resource_profile_id="rp-memory-optimised"`; assert `spark.sparkContext.setLocalProperty`
      called with `("spark.fabric.resourceProfile", "rp-memory-optimised")`
- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestApplyLayerSparkConfigResourceProfile::test_no_resource_profile_call_when_id_is_none`
      — pass `resource_profile_id=None` and empty `env_config`; assert `setLocalProperty`
      NOT called with `"spark.fabric.resourceProfile"` key
- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestApplyLayerSparkConfigResourceProfile::test_no_resource_profile_call_when_id_omitted`
      — call with no `resource_profile_id` kwarg (uses default), empty `env_config`;
      assert `setLocalProperty` NOT called for resource profile
- [x] 🟢 GREEN: add `resource_profile_id: str | None = None` as fourth kwarg to
      `apply_layer_spark_config` in `src/notebooks/nb_utils_config.py`. Add
      `_FABRIC_RESOURCE_PROFILE_PROPERTY = "spark.fabric.resourceProfile"` constant.
      Apply `setLocalProperty` when `resource_profile_id` is truthy.
- [x] 🔵 REFACTOR: confirm all existing call sites `(spark, layer, env_config)` still pass
      with the new optional fourth param — no changes needed at call sites
- [x] COMMIT: `feat(nb-utils-config): apply_layer_spark_config accepts resource_profile_id kwarg [RED/GREEN]`

---

### Cycle 2 — `apply_layer_spark_config` resolves profile from `env_config` when kwarg absent

- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestApplyLayerSparkConfigResourceProfile::test_reads_bronze_profile_from_env_config`
      — pass `env_config={"BronzeResourceProfileId": "rp-mem"}` with no explicit kwarg;
      assert `setLocalProperty` called with `("spark.fabric.resourceProfile", "rp-mem")`
- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestApplyLayerSparkConfigResourceProfile::test_reads_gold_profile_from_env_config`
      — `layer="GOLD"`, `env_config={"GoldResourceProfileId": "rp-cpu", "VOrderEnabled": "false"}`;
      assert `setLocalProperty` called with `"rp-cpu"`
- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestApplyLayerSparkConfigResourceProfile::test_explicit_kwarg_overrides_env_config`
      — `resource_profile_id="explicit"`, `env_config={"BronzeResourceProfileId": "from-seed"}`;
      assert `setLocalProperty` called with `"explicit"`, not `"from-seed"`
- [x] 🟢 GREEN: add env_config lookup in `apply_layer_spark_config`:
      `resource_profile_id = resource_profile_id or env_config.get(f"{layer.title()}ResourceProfileId")`
- [x] 🔵 REFACTOR: none required
- [x] COMMIT: `feat(nb-utils-config): apply_layer_spark_config reads ResourceProfileId from env_config [GREEN]`

---

### Cycle 3 — `EnvironmentConfig` seed has ResourceProfileId rows

- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestResourceProfileSeed::test_bronze_resource_profile_id_row_present`
      — open `config/seed-dev.json`; assert `BronzeResourceProfileId` in EnvironmentConfig ParameterNames
- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestResourceProfileSeed::test_gold_resource_profile_id_row_present`
      — assert `GoldResourceProfileId` in EnvironmentConfig ParameterNames
- [x] 🔴 RED: `tests/test_nb_utils_config.py::TestResourceProfileSeed::test_resource_profile_ids_are_null_in_dev`
      — assert both rows have `ParameterValue: null` (capacity default for dev)
- [x] 🟢 GREEN: add two rows to `config/seed-dev.json` `EnvironmentConfig`:
      `BronzeResourceProfileId` (null) and `GoldResourceProfileId` (null) with descriptions
- [x] 🔵 REFACTOR: none
- [x] COMMIT: `feat(seed): add BronzeResourceProfileId + GoldResourceProfileId to EnvironmentConfig [GREEN]`

---

## Gate Checklist

### Hardening Phase
- [x] All tests passing
- [x] Existing `apply_layer_spark_config` call sites unchanged — no regression
- [x] `resource_profile_id` kwarg > env_config lookup > None (silent default) precedence correct
- [x] `setLocalProperty` not called when profile ID resolves to None or `""`

### Gatekeeper Phase
- [x] Gate 1: `gitleaks detect --verbose` — no secrets
- [x] Gate 2: `bandit -r src/notebooks/nb_utils_config.py -ll -f txt` — clean
- [x] Gate 3: `ruff check src/notebooks/nb_utils_config.py --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [x] Gate 4: `mypy src/notebooks/nb_utils_config.py --ignore-missing-imports --no-strict-optional` — 0 errors
- [x] Gate 5: `python3 -m pytest tests/test_nb_utils_config.py -k "ResourceProfile" -v` — all green
- [x] Gate 6: `python3 -m pytest tests/test_nb_utils_config.py` — full class still green (no regression)

---

## Iteration Log

- **2026-05-02**: Task card created via `/build-sprint GAP-03`. Pre-mortem: signature
  backwards-compatibility risk identified — `env_config` must be kept as third positional arg;
  `resource_profile_id` added as fourth optional kwarg. Env_config lookup added as fallback so
  orchestration notebooks don't need to be updated. No ADR required (parameter extension only).
  3 TDD cycles planned.

- **2026-05-02**: Sprint 3 GAP-03 COMPLETE. 3 TDD cycles delivered + 2 roast HIGH fixes:
  (a) empty-string `resource_profile_id=""` uses `is not None` guard (not `or`) — correct semantic;
  (b) `getattr(spark, 'sparkContext', None)` guard for Fabric Runtime 1.3+ Spark Connect;
  8 tests green in TestApplyLayerSparkConfigResourceProfile + 3 in TestResourceProfileSeed.
  TD-063 raised: verify correct Fabric API for resource profile injection (setLocalProperty vs conf.set).
  Roast: 0 CRITICALs, 2 HIGHs fixed, 1 MEDIUM deferred (type annotation), 1 LOW → TD-063.
