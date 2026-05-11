Branch: claude/chat-handoff-read-bfcwR | HEAD: 8ba4160 | 2026-05-09

## Handoff — Sprint 18 CLOSED

**Repo:** /home/user/peggy
**Last sprint:** Sprint 18 — GAP-21 OneLake RBAC + Livy CI smoke — COMPLETE
**Commits this session:** 4921eb4..8ba4160

## Baseline
- Tests: 1350 passed, 34 skipped
- Ruff: pre-existing violations only (not in sprint scope)
- mypy: clean (pre-existing nb_conn_livy requests stub warning)
- gitleaks/bandit: not installed in env; schema drift check PASS

## Delivered this session
- docs/adr/ADR-057-onelake-data-access-roles.md — written and Accepted (4921eb4)
- scripts/20-configure-onelake-access-roles.py — 5 TDD cycles, full OneLake RBAC provisioning (88fab89→7af5e30)
- scripts/smoke_livy.py — 3 TDD cycles, acquire_livy_token / submit_batch / poll_until_done (62a2141→c823674)
- config/seed-dev.json + seed-template.json — OneLakeAccessRolesEnabled: false guard added (5a6d2b4, a2b03e2)
- tests/conftest.py — requests.exceptions stub added; fixed test_nb_connection_test (23b9637)
- src/utils/pii_scanner.py — IBAN regex tightened ({4,30}→{11,30}); IP/MAC regex fallbacks added (d3ea5b1)
- src/notebooks/nb_bootstrap.py — _migrate_table helper extracted; CC reduced from 14 (c4da04e)
- Sprint 18 close artefacts — SPRINT_REGISTER, TECH_DEBT, CHANGELOG, agent-guide.html, task-GAP-21.md (8ba4160)

## Open items
- TD-079: Smoke_Livy CI stage (azure-pipelines.yml) — HITL blocked, requires live DEV workspace with Fabric F2+ capacity
- TD-078: control.annotations DDL missing from nb_bootstrap.py — Medium, suggested Sprint 19
- 20260508 plan Phases 1–5 not started: schema divergence fixes (migrations 07–09), DAL helpers,
  12-notebook migration off direct spark.sql, SourceConfig column parity (21 missing cols in Fabric SQL),
  data migration script (scripts/15-migrate-delta-control-to-fabric-sql.py), SQLGlot spike

## Next task
Sprint 19 — GAP-22: OIDC / Workload Identity Federation for ADO pipeline (ADR-058 required first)
OR continue 20260508 plan Phase 1 (schema divergence): start with migration 07/08 fixes + TD-078 annotations DDL.
Run `/build-sprint GAP-22` for Sprint 19, or review __inbox/__todo/20260508/PLAN.md for Phase 1 items.
