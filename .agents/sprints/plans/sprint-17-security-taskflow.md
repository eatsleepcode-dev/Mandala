---
sprint: 17
title: "Security & Taskflow — Workspace Identity migration + KV naming + Taskflow definitions"
feature_plan_phase: "P7 + P8"
effort: M + S + M
status: complete
completed_date: 2026-05-06
score_before: 1284
score_after_actual: 1302
adr_required: []
branch: vnext
pre_existing_open_tds: "TD-032 (Workspace Identity migration) — closed by this sprint"
prerequisite: Sprints 12–16 COMPLETE (all wizard notebooks must exist before WI migration touches them)
carryover:
  - "Cycle 11 (scripts/deploy_fabric_cli.sh) — deferred to TD-077; optional P1-D deliverable"
tds_raised:
  - TD-077
tds_closed:
  - TD-032
---

# Sprint 17 — Security & Taskflow (FEATURE_PLAN Phases 7 + 8)

## Goals

Workspace Identity as the default auth model. KV secret naming convention enforced.
Fabric Taskflow definitions for all major pipeline chains.

| Item | Deliverable | Done when |
|---|---|---|
| P7-A (TD-032) | Workspace Identity full migration | All Fabric-to-Fabric calls use WI; SPN optional; `nb_environment_validator` checks WI presence |
| P7-B | KV secret naming convention | Naming pattern documented; `nb_environment_validator` validates KV secret names |
| P8-A | Taskflow definitions for 4 main pipelines | `Taskflows/` directory with 4 `.tfx` definitions; existing pipelines remain functional |
| P1-D | `scripts/deploy_fabric_cli.sh` — Fabric CLI deploy path | Creates workspaces, imports items, sets VL values; documented in OPERATIONS.md |

---

## Pre-flight notes

**TD-032** (Workspace Identity migration) — open; WI auth flag (`UseWorkspaceIdentity`) was added
in Sprint 1 (GAP-01) for JDBC. This sprint completes the migration:
- REST connector WI path is already done (Sprint 2).
- Remaining: KV access via WI (no secret needed), WI detection in
  `Modules/Hub_Plugins/Deployment_Wizard/azure_deployment.py`, `nb_env_setup` SPN field removal
  when WI is active.

**Taskflow format** — Fabric Taskflow item definitions use JSON. The `Taskflows/` directory stores
these as `.tfx` (JSON) files. They are additive — existing pipelines remain functional in parallel.

---

## Notebook delivery order

### Workspace Identity full migration (TD-032)

1. **Tidy** — audit all `mssparkutils.credentials.getSecret` calls; identify which can use WI
2. **Cycle 1** — `nb_conn_jdbc.py`: extend `UseWorkspaceIdentity` to KV access (fetch JDBC password
   via WI token rather than KV secret when `UseWorkspaceIdentity=True` and source is Fabric SQL)
3. **Cycle 2** — `nb_env_setup.py`: hide SPN credential fields in widget when WI is active;
   add `AuthModel` field (WorkspaceIdentity / ServicePrincipal)
4. **Cycle 3** — `Modules/Hub_Plugins/Deployment_Wizard/azure_deployment.py`: add
   `_probe_workspace_identity()` helper; set `wi_available` traitlet; React Step 1 offers WI
   as default auth radio when `wi_available=True`
5. **Cycle 4** — `nb_environment_validator.py`: add `check_workspace_identity_present` check
   (optional; amber if absent, not red)

### KV secret naming convention (P7-B)

6. **Cycle 5** — `nb_environment_validator.py`: add `check_kv_secret_naming` — validates that
   known secrets follow `{client}-{env}-{source}-{type}` pattern; warn on non-conforming names
7. **Cycle 6** — document naming convention in `OPERATIONS.md` under "Key Vault"

### Taskflow definitions (P8-A)

8. **Cycle 7** — `Taskflows/TF_Daily_Platform_Refresh.tfx` — mirrors `10_Daily_Platform_Refresh`
   pipeline (nb_orchestrator chain); dependency graph defined
9. **Cycle 8** — `Taskflows/TF_Daily_Landing_Refresh.tfx` — mirrors `00_Daily_Landing_Refresh`
   (connector fan-out)
10. **Cycle 9** — `Taskflows/TF_Gold_Runner.tfx` + `Taskflows/TF_Weekly_Optimise.tfx`

### Fabric CLI deploy script (P1-D)

11. **Cycle 10** — `scripts/deploy_fabric_cli.sh` — `fab` CLI: create workspaces, import items,
    assign capacity, set Variable Library values; usage documented in OPERATIONS.md

---

## TDD summary

| Cycle | Test class | Key test methods |
|---|---|---|
| 1 | — | structural only (audit) |
| 2 | `TestWorkspaceIdentityJdbc` | `test_wi_skips_kv_for_fabric_sql_source`, `test_spn_fallback_when_wi_false` |
| 3 | `TestEnvSetupAuthModel` | `test_spn_fields_hidden_when_wi_active` |
| 4 | `TestAzureDeploymentWiDetection` | `test_wi_available_true_when_managed_identity_present` |
| 5 | `TestEnvironmentValidator` | `test_wi_check_amber_when_absent`, `test_wi_check_pass_when_present` |
| 6 | `TestKvSecretNaming` | `test_conforming_secret_name_passes`, `test_non_conforming_name_warns` |
| 7 | — | OPERATIONS.md update; no unit test |
| 8–10 | `TestTaskflowDefinitions` | `test_taskflow_files_exist`, `test_taskflow_json_valid` |
| 11 | — | shell script; smoke test in CI via `bash -n` (syntax only) |

---

## Key design decisions

- **WI is default, SPN is fallback** — the migration does not remove SPN support; it demotes it
  to the fallback path. This ensures backward compatibility for deployments without managed identity.
- **Taskflows are additive** — existing Data Factory pipelines remain functional. Taskflows provide
  a Fabric-native alternative for new deployments and for dependency visualisation.
- **KV naming validation is advisory** — non-conforming names produce an amber warning in
  `nb_environment_validator`, not a hard fail. Organisations may have pre-existing naming conventions.
- **Fabric CLI script** — uses `fab` CLI (Fabric CLI tool). Requires `fab` to be installed and
  authenticated. Documented as a developer tool, not a CI/CD replacement.

---

## Control table / DDL changes

None required. `ConnectionConfig.UseWorkspaceIdentity` column already exists (added Sprint 1).

---

## Definition of Done

- [x] `pytest tests/test_nb_conn_jdbc.py -k "WorkspaceIdentity" -v` — all green
- [x] `pytest tests/test_nb_environment_validator.py -k "WiCheck or KvNaming" -v` — all green
- [x] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [x] `gitleaks detect --verbose` — clean
- [x] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [x] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [x] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [x] TD-032 marked resolved in `TECH_DEBT.md`
- [x] `Taskflows/` directory with 4 `.tfx` files committed
- [🔁] `scripts/deploy_fabric_cli.sh` committed with usage in `OPERATIONS.md` — deferred → TD-077
- [x] KV naming convention documented in `OPERATIONS.md`
- [x] Sprint register updated
