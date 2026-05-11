# the platform Data Platform — Roadmap

> Generated: 2026-04-25  
> Based on: FMD Framework (edkreuk/FMD_FRAMEWORK) vs the platform codebase comparison

---

## FMD vs the platform — Capability Comparison

### Control Store Architecture

| Aspect | FMD | the platform |
|---|---|---|
| Storage type | Fabric SQL Database (`SQL_FMD_FRAMEWORK`) | Control Lakehouse (Delta tables) |
| Metadata write pattern | Stored procedures (`sp_UpsertPipelineBronzeLayerEntity`, etc.) | Python notebook functions |
| Schemas | `[integration]`, `[execution]`, `[logging]` | `control.*` |
| Key tables | `BronzeLayerEntity`, `SilverLayerEntity`, `LandingzoneEntity`, `Connection`, `DataSource`, `Workspace` | `ObjectConfig`, `RunbookStep`, `ControlLog`, `Watermarks`, `CleansingRules`, `ShortcutConfig`, `ViewScript` |
| Execution tracking | `PipelineBronzeLayerEntity`, `PipelineLandingzoneEntity`, `LandingzoneEntityLastLoadValue` | `ControlLog`, watermark tables |

**Note:** FMD's SQL DB provides transactional ACID guarantees on metadata writes but adds a Fabric SQL DB dependency and ODBC driver requirement in every notebook. the client's Delta approach is simpler operationally and already working well. No change recommended.

---

### Orchestration

| Aspect | FMD | the platform |
|---|---|---|
| Mechanism | Data Pipelines + `runMultiple` DAG (up to 50 concurrent) | `runMultiple` DAG in `nb_orchestrator.py` |
| Dependency chaining | `dependsOn` array within `runMultiple` activities | `DependsOn` column in `RunbookStep` → same pattern |
| Fan-out | Groups files by `DataSource+Schema+Table`, sequences within group by **filename timestamp** | `FanOutSource: ObjectConfig` expands one step → N per-object activities |
| Taskflow | Yes — `Taskflow/` directory | No |
| Max concurrency | 50 per batch (auto-batches) | 50 per `runMultiple` call |

**This platform ahead:** `FanOutSource: ObjectConfig` fan-out is a cleaner pattern for preventing `ConcurrentAppendException` than FMD's file-grouping approach.

**FMD ahead:** FMD extracts `YYYYMMDDHHMM` timestamps from landing filenames and guarantees chronological sequencing within same-source file groups. See **TD-037**.

---

### Bronze → Silver Transformation

| Aspect | FMD (`nb_fmd_load_bronze_silver`) | the platform (`nb_bronze_to_silver` + `nb_silver_transform`) |
|---|---|---|
| SCD types | SCD2 only | SCD0, SCD1, SCD2, FACT-TRANSACTION, FACT-SNAPSHOT |
| Change detection | MD5 hash columns: `HashedPKColumn` + `HashedNonKeyColumns` | Direct column comparison |
| Merge approach | DataFrame union (deletes + updates_old + updates_new + inserts) → single Delta merge | Per-SCD-type write strategies |
| V-Order optimization | Explicitly enabled on Silver Delta tables | Not explicitly set |
| Change Data Feed | Explicitly enabled | Not explicitly set |
| Soft deletes | `IsDeleted=True`, `IsCurrent=False` | Same pattern |
| Temporal tracking | `RecordStartDate`, `RecordEndDate`, `RecordModifiedDate`, `IsCurrent` | Same columns |

**This platform ahead:** SCD0/SCD1/FACT write variants — FMD handles SCD2 only.

**FMD ahead:** Hash-based change detection scales better on wide tables. See **TD-035**. V-Order + CDC explicit enablement improves query perf and downstream consumers. See **TD-036**.

---

### Data Quality / Cleansing

| Aspect | FMD | the platform |
|---|---|---|
| Rule storage | SQL DB `[integration]` schema | `control.CleansingRules` Delta table |
| Rule application | `nb_fmd_dq_cleansing` (`%run`'d) | Inline in `nb_bronze_to_silver.py` |
| Custom DQ extension | `nb_fmd_custom_dq_cleansing` — **auto-created via Fabric REST API** if missing | `nb_apply_masking.py` for PII; no auto-scaffold |

**FMD ahead:** Auto-creation of the custom DQ notebook via REST API is a good zero-friction onboarding touch. the platform could adopt this pattern to auto-scaffold a `nb_custom_cleansing` placeholder when bootstrapping a new workspace.

---

### Connectors (Landing Zone)

| Connector | FMD | the platform |
|---|---|---|
| ADLS | ✅ `PL_FMD_LDZ_COPY_FROM_ADLS_01` | ✅ `nb_conn_file.py` |
| Azure SQL / JDBC | ✅ `PL_FMD_LDZ_COPY_FROM_ASQL_01` | ✅ `nb_conn_jdbc.py` |
| REST API | ✅ `PL_FMD_LDZ_COMMAND_NOTEBOOK` (custom NB) | ✅ `nb_conn_rest.py` |
| OneLake Files | ✅ | ✅ `nb_shortcut_functions.py` |
| OneLake Tables | ✅ `PL_FMD_LDZ_COPY_FROM_ONELAKE_TABLES_01` | Partial (shortcuts only) |
| Dataverse | ❌ (custom notebook pattern) | ✅ `nb_conn_dataverse.py` |
| SFTP | ✅ `PL_FMD_LDZ_COPY_FROM_SFTP_01` | ❌ |
| FTP | ✅ `PL_FMD_LDZ_COPY_FROM_FTP_01` | ❌ |
| Oracle | ✅ `PL_FMD_LDZ_COPY_FROM_ORACLE_01` | ❌ |
| SQL Managed Instance | ✅ `PL_FMD_LDZ_COPY_FROM_SQLMI_01` | ❌ |
| ADF integration | ✅ `PL_FMD_LDZ_COPY_FROM_ADF` | ❌ |

**This platform ahead:** Dataverse native connector.

**FMD ahead:** SFTP, FTP, Oracle, SQLMI, ADF. Gaps to address if the platform needs those transports. Add as TDs when a specific source requiring them is raised.

---

### Source Onboarding / Bootstrapping

| Aspect | FMD | the platform |
|---|---|---|
| SQL source auto-onboard | `PL_TOOLING_POST_ASQL_TO_FMD` — introspects source SQL schema, auto-populates metadata | ❌ Manual metadata entry / `nb_bootstrap.py` seeding |
| Bronze auto-discovery | ❌ | ✅ `nb_catalog_sync.py` diffs Bronze LH vs `ObjectConfig` |
| Onboarding wizard | `nb_utilities_setup_fmd` | `nb_platform_setup.py` + `nb_bronze_onboarding.py` |

**This platform ahead:** `nb_catalog_sync.py` auto-discovery is better for Dataverse/shortcut-based ingestion where tables already exist in the LH.

**FMD ahead:** SQL source schema introspection saves significant manual metadata entry for JDBC/SQL sources. See **TD-038**.

---

### Variable Library / Config

Both use Fabric Variable Library. FMD has two (`VAR_CONFIG_FMD` + `VAR_FMD`). the platform has one (`Platform_Config`). Functionally equivalent.

---

### Workspace Topology

| Aspect | FMD | the platform |
|---|---|---|
| Code workspace | Separate (framework code + SQL DB + environment) | Single workspace (code + data co-located) |
| Data workspace(s) | Separate per deployment | Same workspace as code |
| Business domain workspaces | `business_domain/` — separate Gold workspaces per domain | Single workspace (`lh_gold`) |
| Identity model | Workspace Identity | SPN (TD-032 pending) |

---

## Where the platform is Ahead of FMD

1. **SCD0/SCD1/FACT-TRANSACTION/FACT-SNAPSHOT** write strategies — FMD is SCD2-only
2. **`FanOutSource: ObjectConfig`** fan-out — cleaner MERGE-conflict prevention
3. **`nb_catalog_sync.py`** — Bronze auto-discovery from existing LH
4. **Native Dataverse connector** (`nb_conn_dataverse.py`)

---

## Roadmap Items from FMD Analysis

These are candidate improvements identified from the FMD comparison. Each maps to a TECH_DEBT.md entry.

| # | Item | Priority | TD Ref |
|---|---|---|---|
| 1 | Hash-based change detection for SCD2 (`HashedPKColumn` + `HashedNonKeyColumns`) | Medium | TD-035 |
| 2 | Explicit V-Order + Change Data Feed on Silver Delta tables | Low | TD-036 |
| 3 | Filename timestamp sequencing in landing-to-Bronze (chronological ordering within same-source file groups) | Low | TD-037 |
| 4 | SQL source schema introspection for bulk JDBC onboarding (equivalent to `PL_TOOLING_POST_ASQL_TO_FMD`) | Low | TD-038 |
| 5 | Migrate SPN → Workspace Identity for pipeline/notebook connections | Medium | TD-032 |
| 6 | SCD2 delete-and-reinsert edge case fix in `apply_scd2()` | Medium | TD-031 |
| 7 | Bronze layer graceful failure on missing/late-arriving files | Low | TD-033 |
| 8 | Centralise Spark Environment in config workspace | Low | TD-034 |
| 9 | SharePoint as first-class data source/destination | Low | TD-030 |

---

## Previously Logged Tech Debt (summary)

| TD | Title | Status |
|---|---|---|
| TD-001 | Replace hand-rolled `build_notebooks.py` with proper notebook SDK | 🔲 Open |
| TD-002 | Fix `Platform_Config` VariableLibrary schema mismatch | 🔲 Open |
| TD-003 | Rename `PipelineConfig`/`PipelineID` → `RunbookConfig`/`RunbookID` | 🔲 Open |
| TD-030 | SharePoint as first-class source/destination | 🔲 Open |
| TD-031 | SCD2 delete-and-reinsert edge case in `apply_scd2()` | 🔲 Open |
| TD-032 | Migrate SPN → Workspace Identity | 🔲 Open |
| TD-033 | Bronze layer graceful failure on missing files | 🔲 Open |
| TD-034 | Centralise Spark Environment in config workspace | 🔲 Open |

Full detail for all items: [TECH_DEBT.md](./TECH_DEBT.md)
