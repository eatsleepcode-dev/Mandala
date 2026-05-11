---
sprint: 15
title: "Connector Expansion — SFTP/FTPS + SharePoint + Oracle/SQLMI JDBC"
feature_plan_phase: 4
effort: M + M + S
status: PLANNED
score_before: TBD
score_after_estimate: TBD
adr_required: []
branch: TBD
pre_existing_open_tds: "TD-030 (SharePoint connector) 🔲 — closed by this sprint"
---

# Sprint 15 — Connector Expansion (FEATURE_PLAN Phase 4)

## Goals

Match FMD connector coverage. Add SharePoint as a first-class platform differentiator.

| Item | Deliverable | Done when |
|---|---|---|
| P5-A | `nb_conn_sftp.py` — SFTP + FTPS file ingestion | Config-driven; `Protocol` ∈ `{SFTP, FTPS}`; Parquet landing; same output format as `nb_conn_file.py` |
| P5-B (TD-030) | `nb_conn_sharepoint.py` — SharePoint / OneDrive via Graph API | List mode + File mode; SPN auth; secret from KV |
| P5-C | Oracle/SQLMI JDBC support in `nb_conn_jdbc.py` | `DRIVER_MAP` extended; `ConnectionConfig.DriverType` column |

> **Out of scope (deferred):** `nb_conn_adf.py` (ADF trigger) — ADF is an edge case; migration path to Fabric pipelines is preferred. Deferred to backlog.

---

## Pre-flight notes

**TD-030** (SharePoint connector) — open; closed by `nb_conn_sharepoint.py` this sprint.

**`paramiko`** — SFTP and FTPS both use `paramiko` (available in Fabric Runtime 1.3+). SFTP uses
`SSHClient.open_sftp()`; FTPS uses `ftplib.FTP_TLS` (stdlib, no extra dependency). The `Protocol`
column in `ConnectionConfig` selects the transport; both produce the same Parquet landing output.
Offline tests mock the `paramiko.SSHClient` and `ftplib.FTP_TLS` interfaces.

**Oracle JDBC driver** — `ojdbc11.jar` must be present in the Fabric environment. The connector
adds driver type routing; the JAR provisioning is documented in `OPERATIONS.md`, not automated.

---

## Notebook delivery order

### nb_conn_sftp.py

1. **Tidy** — read `nb_conn_file.py` to identify the output contract (Parquet landing pattern)
2. **Cycle 1** — `_get_sftp_client` — paramiko SSH connection from `ConnectionConfig`; KV secret fetch
3. **Cycle 2** — `_get_ftps_client` — `ftplib.FTP_TLS` connection; same `ConnectionConfig` shape; `Protocol=FTPS`
4. **Cycle 3** — `_list_remote_files` + `_download_file` — protocol-aware dispatch; filtered by `FilePattern` in `IngestionConfig`
5. **Cycle 4** — `run_sftp_ingestion` orchestrator — download → convert → write Parquet to landing;
   `ControlLog` event; `Protocol` param routes SFTP vs FTPS

### nb_conn_sharepoint.py (TD-030)

6. **Cycle 5** — `_get_graph_token` — client_credentials grant (`Sites.Read.All`); KV secret
7. **Cycle 6** — `_read_list_items` — SharePoint List → DataFrame; pagination via `@odata.nextLink`
8. **Cycle 7** — `_download_library_files` — Document Library → Landing LH files zone
9. **Cycle 8** — `run_sharepoint_ingestion` orchestrator; `Mode` param (`list` / `file`)

### nb_conn_jdbc.py Oracle/SQLMI extension

10. **Tidy** — read current driver handling; confirm extension point
11. **Cycle 9** — `DRIVER_MAP` dict constant; `ConnectionConfig.DriverType` column (migration guard
    in nb_bootstrap; default `sqlserver` for backward compat)
12. **Cycle 10** — `build_jdbc_url` extended for Oracle (`jdbc:oracle:thin:@`) and SQLMI URL format

---

## TDD summary

| Cycle | Test class | Key test methods |
|---|---|---|
| 1 | — | structural only |
| 2 | `TestSftpConnector` | `test_sftp_client_uses_kv_secret`, `test_sftp_connect_uses_correct_port` |
| 3 | `TestFtpsConnector` | `test_ftps_client_uses_kv_secret`, `test_ftps_enforces_tls` |
| 4 | `TestSftpConnector` | `test_list_remote_files_applies_pattern`, `test_protocol_dispatch_sftp`, `test_protocol_dispatch_ftps` |
| 5 | `TestSftpConnector` | `test_run_sftp_ingestion_writes_parquet`, `test_log_event_called` |
| 6 | `TestSharePointAuth` | `test_graph_token_uses_client_credentials`, `test_kv_secret_fetched` |
| 7 | `TestSharePointList` | `test_list_items_paginated`, `test_next_link_followed` |
| 8 | `TestSharePointFiles` | `test_library_files_downloaded_to_landing` |
| 9 | `TestSharePointConnector` | `test_list_mode_calls_read_list_items`, `test_file_mode_calls_download` |
| 10 | `TestJdbcDriverMap` | `test_oracle_driver_in_map`, `test_default_is_sqlserver` |
| 11 | `TestBuildJdbcUrl` | `test_oracle_url_format`, `test_sqlmi_url_format` |

---

## Key design decisions

- **SFTP/FTPS output contract** — identical to `nb_conn_file.py`: Parquet file written to
  `lh_landing/Files/{SourceName}/YYYYMMDDHHMM_{filename}.parquet`. `nb_landing_to_bronze` picks
  it up transparently.
- **FTPS transport** — uses stdlib `ftplib.FTP_TLS` (no extra dependency). `Protocol=SFTP` routes
  to paramiko; `Protocol=FTPS` routes to `FTP_TLS`. Both share the same `ConnectionConfig` columns
  (`Host`, `Port`, `Username`; password from KV secret).
- **SharePoint auth** — SPN client_credentials (not delegated) to enable service account access
  without user sign-in. `Sites.Read.All` is the minimum required scope.
- **Oracle JDBC** — `DriverType` column defaults to `sqlserver` so existing seeds/connections are
  unaffected. Oracle connections set `DriverType=oracle`.
- **ADF connector deferred** — `nb_conn_adf.py` removed from this sprint. ADF is a migration
  edge-case; Fabric-native pipelines are the target state. Revisit only if a customer requires it.

---

## Control table / DDL changes

| Table | Change | Migration guard |
|---|---|---|
| `control.ConnectionConfig` | Add `Protocol STRING` (SFTP, FTPS, SHAREPOINT), `Port INT` | `ALTER TABLE IF NOT EXISTS COLUMN` |
| `control.ConnectionConfig` | Add `DriverType STRING` (default `sqlserver`) | `ALTER TABLE IF NOT EXISTS COLUMN` |
| `control.IngestionConfig` | Add `SharePointSiteUrl STRING`, `ListOrLibraryName STRING` | `ALTER TABLE IF NOT EXISTS COLUMN` |

---

## Definition of Done

- [ ] `pytest tests/test_nb_conn_sftp.py -v` — all green (covers SFTP + FTPS protocol dispatch)
- [ ] `pytest tests/test_nb_conn_sharepoint.py -v` — all green
- [ ] `pytest tests/test_nb_conn_jdbc.py -k "DriverMap or OracleUrl" -v` — all green
- [ ] `pytest tests/ --cov=src/notebooks --cov-report=term-missing --cov-fail-under=80 -v` — ≥80%
- [ ] `gitleaks detect --verbose` — clean
- [ ] `bandit -r src/ -ll -f text` — no new Medium/High findings
- [ ] `ruff check src/ tests/ scripts/ --select=E,W,B,S,C90 --ignore=S101,S603,S607` — clean
- [ ] `mypy src/notebooks/ --ignore-missing-imports --no-strict-optional` — zero new errors
- [ ] TD-030 marked resolved in `TECH_DEBT.md`
- [ ] `ConnectionConfig.Protocol`, `Port`, `DriverType` migration guards in `nb_bootstrap.py`
- [ ] `IngestionConfig.SharePointSiteUrl`, `ListOrLibraryName` migration guards in `nb_bootstrap.py`
- [ ] Sprint register updated
