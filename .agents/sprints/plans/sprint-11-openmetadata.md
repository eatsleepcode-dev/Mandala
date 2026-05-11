---
sprint: 11
title: "OpenMetadata integration — Data Product Catalogue sync (GAP-11)"
gaps: [GAP-11]
effort: L
status: PLANNED
score_before: TBD
score_after_estimate: TBD
adr_required: [ADR-052]
branch: claude/new-session-Jgqbi
prerequisite: "Sprint 9 (GAP-10) COMPLETE — control.DataProduct table and nb_data_product_catalog.py CRUD must exist"
---

# Sprint 10 — OpenMetadata integration

## Goals

| Gap | Deliverable | Done when |
|-----|-------------|-----------|
| GAP-11 | ADR-052 — OpenMetadata vs Purview integration boundary | File committed before first implementation commit |
| GAP-11 | `nb_conn_rest.py` — `resolve_bearer_token` handles `AuthProfile='openmetadata_jwt'` | JWT path tested; SP path regression tested |
| GAP-11 | `ConnectionConfig.AuthProfile` DDL column in `nb_bootstrap.py` | DDL present; Live DEV Migration SQL applied |
| GAP-11 | `nb_openmetadata_sync.py` — `sync_data_product`, `sync_gold_objects`, `_build_lineage_event` | All tests green against mocked REST API; OpenLineage payload validated |
| GAP-11 | `EnvironmentConfig` seed rows: `OpenMetadataBaseUrl` + `OpenMetadataToken` | Seed integrity tests green |
| GAP-11 | `infrastructure/openmetadata.bicep` placeholder | File exists with Container App + managed identity notes |

---

## TD Pre-flight

**TD-064 (High)** — live Fabric SQL commissioning — **open, out of scope for Sprint 10**.
Pre-existing carryover from Sprint 6. OpenMetadata sync uses the REST connector; no Fabric SQL
commissioning dependency in offline tests.

No other High TDs are targeted at Sprint 10.

---

## Prerequisite gate

**GAP-10 (Sprint 9) must be COMPLETE before Sprint 10 starts.**

The `control.DataProduct` table and `nb_data_product_catalog.py` CRUD functions are the source
of truth for the sync. Sprint 10 must not start until the Sprint 9 DoD is fully met.

---

## ADR pre-flight

ADR-052 must be written and committed before any implementation commits in this sprint.

| ADR | Topic | Status |
|-----|-------|--------|
| ADR-052 | OpenMetadata vs Purview integration boundary | MISSING — write first |

---

## GAP-11 — OpenMetadata integration

### Notebook delivery order

1. **ADR-052** — committed first
2. **Cycle 1** — `EnvironmentConfig` seed rows + `ConnectionConfig.AuthProfile` DDL
3. **Cycle 2** — `resolve_bearer_token` JWT auth profile guard clause in `nb_conn_rest.py`
4. **Cycle 3** — `_build_lineage_event` pure function (OpenLineage payload)
5. **Cycle 4** — `sync_data_product` with mocked REST API + graceful HTTP error handling
6. **Cycle 5** — `sync_gold_objects` with table entity + lineage events
7. **Cycle 6** — `infrastructure/openmetadata.bicep` placeholder

### Key design decisions (pre-empt ADR-052 authoring)

- **OpenMetadata responsibility**: lineage graph, catalog UI, quality dashboards, OpenLineage
  event ingestion. Self-hosted (Container App or AKS) in the BFL tenant.
- **Purview responsibility**: sensitivity labels, compliance scanning, Fabric-native integration.
  Microsoft-managed. These are complementary, not competing.
- **Integration boundary**: `nb_openmetadata_sync.py` reads from `control.DataProduct` +
  `control.GoldObject` and publishes to OpenMetadata REST API. No direct Purview calls in this
  sprint (Purview integration is P8, deferred).
- **JWT bearer auth**: `AuthProfile='openmetadata_jwt'` in `ConnectionConfig`. The JWT token
  is stored in Key Vault (not hardcoded). `resolve_bearer_token` returns it directly without
  an OAuth exchange.
- **No live API calls in tests**: all HTTP interactions mocked via `unittest.mock.patch`.
  Payload shape assertions use exact field names from the OpenMetadata REST API specification.
- **OpenLineage payload**: `_build_lineage_event` is a pure function tested in isolation.
  Fields: `_producer`, `run.runId`, `job.name`, `inputs[].name`, `outputs[].name`.
- **Infrastructure**: `openmetadata.bicep` is a placeholder only. Actual infrastructure decision
  (Container App vs AKS, managed identity, network peering) requires a separate client
  architecture review. The bicep file documents the intended approach.

### `nb_conn_rest.py` radon monitoring

`run_rest_ingestion` CC=14, `paginate` CC=16. The JWT guard clause adds one branch to
`resolve_bearer_token` only. After Cycle 2 GREEN, run:

```bash
radon cc src/notebooks/nb_conn_rest.py -s
```

If `resolve_bearer_token` CC > 10, extract `_resolve_jwt_token` helper in REFACTOR commit before
proceeding to Cycle 3.

### TDD summary

| Cycle | Test class | Test methods |
|-------|-----------|--------------|
| 1 | `TestOpenMetadataSeedRows` | `test_seed_has_openmetadata_base_url`, `test_seed_has_openmetadata_token` |
| 1 | `TestConnectionConfigDDL` | `test_connection_config_has_auth_profile_column` |
| 2 | `TestOpenMetadataJwtAuth` | `test_jwt_token_returned_directly_from_kv`, `test_existing_sp_path_not_affected_by_auth_profile_none` |
| 3 | `TestBuildLineageEvent` | `test_lineage_event_has_required_openlineage_fields`, `test_lineage_event_inputs_outputs_contain_fqn` |
| 4 | `TestSyncDataProduct` | `test_sync_posts_correct_payload`, `test_sync_handles_http_error_gracefully` |
| 5 | `TestSyncGoldObjects` | `test_sync_gold_object_posts_table_entity`, `test_lineage_posted_for_each_gold_object` |
| 6 | `TestOpenMetadataBicep` | `test_openmetadata_bicep_placeholder_exists` |

---

## Infrastructure note

`infrastructure/openmetadata.bicep` — placeholder only. Contents should document:

```bicep
// OpenMetadata — self-hosted catalog and lineage server
// Deployment options: Azure Container App (preferred) or AKS
// Managed identity: system-assigned, granted reader on control plane SQL DB
// Network: VNet integration required for private endpoint access to Fabric SQL
// TODO: raise infrastructure decision with BFL platform team before Sprint 10 execution
```

This file documents intent only. No actual resources are provisioned by this sprint.

---

## Definition of Done

- [ ] `pytest tests/test_nb_openmetadata_sync.py -v` — all green
- [ ] `pytest tests/test_nb_conn_rest.py -k "OpenMetadata" -v` — all green
- [ ] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [ ] `gitleaks detect --verbose` — clean (`OpenMetadataToken` seed value is a placeholder)
- [ ] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [ ] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [ ] ADR-052 committed before first implementation commit
- [ ] GAP-10 (Sprint 9) COMPLETE before sprint starts
- [ ] `ConnectionConfig.AuthProfile` DDL in `nb_bootstrap.py`
- [ ] `OpenMetadataBaseUrl` + `OpenMetadataToken` seed rows in `config/seed-dev.json`
- [ ] SP-path regression tested (no behaviour change when `AuthProfile=None`)
- [ ] OpenLineage payload field coverage tested (`_producer`, `run`, `job`, `inputs`, `outputs`)
- [ ] HTTP error graceful handling tested (409 → ControlLog, no exception)
- [ ] `infrastructure/openmetadata.bicep` placeholder committed
- [ ] Sprint register updated
