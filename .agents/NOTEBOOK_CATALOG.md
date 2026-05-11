# the platform Data Platform — Notebook Catalog

> Generated: 2026-04-25  
> Source: static analysis of `src/notebooks/*.py`  
> 59 notebooks total (58 published, 1 utility-only)

---

## How to Read This Document

- **%run deps** — notebooks inlined at build time via `%run` (shared libraries, loaded into the same Spark session)
- **Calls** — notebooks invoked at runtime via `notebookutils.notebook.run()` (separate sessions)
- **Called by** — pipelines or notebooks that invoke this notebook
- **Last modified** — file timestamp on `main` branch

---

## Quick Dependency Map

```
Fabric Pipelines
├── 01_JDBC_Connector          → nb_conn_jdbc
├── 02_REST_Connector          → nb_conn_rest
├── 00_Daily_Landing_Refresh   → nb_landing_to_bronze (fan-out)
├── 10_Daily_Platform_Refresh  → nb_orchestrator
│                                  └─ nb_bronze_to_silver (fan-out per object)
├── 10_Gold_Runner             → nb_gold_orchestrator
├── pl_refresh_semantic_models → nb_build_throughput
└── Weekly_Optimise            → nb_optimize

Shared %run libraries (inlined, not called):
  nb_utils_config      ← nb_bronze_to_silver, nb_conn_*, nb_landing_to_bronze,
                          nb_notebook_generator, nb_orchestrator, nb_view_*
  nb_utils_views       ← nb_view_factory, nb_view_seeder
  nb_widget_library    ← nb_json_admin, nb_maintenance_objectconfig
  nb_deregister_functions ← nb_deregister_object
  nb_silver_transform  ← nb_bronze_to_silver (inlined)
```

---

## Notebooks by Layer

### Platform Bootstrap

---

#### nb_bootstrap
| | |
|---|---|
| **File** | [src/notebooks/nb_bootstrap.py](../src/notebooks/nb_bootstrap.py) |
| **Stage** | Platform Bootstrap |
| **Purpose** | One-time DDL setup: creates all `control.*` Delta tables (ObjectConfig, RunbookStep, ControlLog, Watermarks, ConnectionConfig, IngestionConfig, CleansingRules, etc.) in the Control Lakehouse. Idempotent — safe to re-run. |
| **Parameters** | `WorkspaceName`, `EnvPrefix` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual / nb_platform_setup on first run |
| **Last modified** | 2026-04-23 |

---

#### nb_platform_setup
| | |
|---|---|
| **File** | [src/notebooks/nb_platform_setup.py](../src/notebooks/nb_platform_setup.py) |
| **Stage** | Platform Bootstrap |
| **Purpose** | Full environment initialisation: creates Lakehouse shortcuts, seeds control tables, wires Variable Library. Calls nb_platform_reset for a clean slate if `RunReset=True`. |
| **Parameters** | `ControlLakehouse`, `BronzeLakehouse`, `SilverLakehouse`, `GoldLakehouse`, `KeyVaultUrl`, `DataverseOrgUrl`, `WorkspaceId`, `RunReset` |
| **%run deps** | — |
| **Calls** | `nb_platform_reset` |
| **Called by** | Manual |
| **Last modified** | 2026-04-25 |

---

#### nb_env_setup
| | |
|---|---|
| **File** | [src/notebooks/nb_env_setup.py](../src/notebooks/nb_env_setup.py) |
| **Stage** | Platform Bootstrap |
| **Purpose** | Interactive environment configuration wizard. Sets env prefix, workspace IDs, lakehouse names, ERP JDBC connection details, and Variable Library names. |
| **Parameters** | `ENV_PREFIX`, `WORKSPACE_ID`, `BRONZE_LH_NAME`, `SILVER_LH_NAME`, `GOLD_LH_NAME`, `CONTROL_LH_NAME`, `ERP_SERVER`, `ERP_DATABASE`, `ERP_USERNAME`, `ERP_KV_URL`, `ERP_KV_SECRET`, `VL_PLATFORM_NAME`, `VL_ADMIN_NAME` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual |
| **Last modified** | 2026-04-23 |

---

#### nb_seed_control_lh
| | |
|---|---|
| **File** | [src/notebooks/nb_seed_control_lh.py](../src/notebooks/nb_seed_control_lh.py) |
| **Stage** | Bootstrap |
| **Purpose** | Seeds `control.*` tables from `config/seed-dev.json` — populates IngestionSource, ConnectionConfig, IngestionConfig, ObjectConfig, RunbookStep rows. Run after nb_bootstrap to load initial metadata. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual (after nb_bootstrap) |
| **Last modified** | 2026-04-23 |

---

#### nb_platform_bootstrapper
| | |
|---|---|
| **File** | [src/notebooks/nb_platform_bootstrapper.py](../src/notebooks/nb_platform_bootstrapper.py) |
| **Stage** | Platform Bootstrap |
| **Purpose** | Thin pipeline-callable wrapper that chains nb_bootstrap + nb_seed_control_lh in the correct order. Used in `100_Pipelines` deployment flow. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Fabric Pipeline: deployment flow |
| **Last modified** | 2026-04-02 |

---

### Connectors (Landing Zone)

---

#### nb_conn_jdbc
| | |
|---|---|
| **File** | [src/notebooks/nb_conn_jdbc.py](../src/notebooks/nb_conn_jdbc.py) |
| **Stage** | Connectors & Ingestion Layer |
| **Purpose** | Extracts data from JDBC sources (D365 F&O, Azure SQL) into Landing Lakehouse as Parquet. Reads connection metadata from `control.ConnectionConfig`, resolves Key Vault secret, supports watermark-based incremental and full loads. |
| **Parameters** | `PipelineRunId`, `SourceName`, `LandingLakehouse`, `KeyVaultUrl` |
| **%run deps** | `nb_utils_config` |
| **Calls** | — |
| **Called by** | Fabric Pipeline: `01_JDBC_Connector` (ForEach over IngestionConfig rows) |
| **Last modified** | 2026-04-23 |

---

#### nb_conn_rest
| | |
|---|---|
| **File** | [src/notebooks/nb_conn_rest.py](../src/notebooks/nb_conn_rest.py) |
| **Stage** | Connectors |
| **Purpose** | Generic config-driven REST ingestion. Reads connection + pagination config from control tables, resolves KV secret, supports BEARER and BASIC auth, pagination modes: SINGLE/CURSOR/OFFSET/LINK_HEADER. Lands raw JSON as Parquet. |
| **Parameters** | `PipelineRunId`, `SourceName`, `LandingLakehouse`, `KeyVaultUrl` |
| **%run deps** | `nb_utils_config` |
| **Calls** | — |
| **Called by** | Fabric Pipeline: `02_REST_Connector` (ForEach over IngestionConfig rows) |
| **Notes** | BASIC auth added for HiBob (branch `claude/hibob-api-setup-WgSHk`, not yet merged) |
| **Last modified** | 2026-04-23 |

---

#### nb_conn_file
| | |
|---|---|
| **File** | [src/notebooks/nb_conn_file.py](../src/notebooks/nb_conn_file.py) |
| **Stage** | Connectors |
| **Purpose** | Ingests files (CSV, Parquet, Excel) from ADLS/OneLake into Landing Lakehouse. Config-driven source path resolution. |
| **Parameters** | `PipelineRunId`, `LandingLakehouse`, `SourceName` |
| **%run deps** | `nb_utils_config` |
| **Calls** | — |
| **Called by** | Fabric Pipeline: file-based connector |
| **Last modified** | 2026-04-23 |

---

#### nb_conn_dataverse
| | |
|---|---|
| **File** | [src/notebooks/nb_conn_dataverse.py](../src/notebooks/nb_conn_dataverse.py) |
| **Stage** | Connectors |
| **Purpose** | Reads Dataverse tables via the Power Platform connector / OData API into Landing Lakehouse. Resolves service principal credentials from Key Vault. |
| **Parameters** | `ControlLakehouse`, `KeyVaultUrl`, `DataverseOrgUrl`, `PreviewTable` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Fabric Pipeline: Dataverse connector step |
| **Last modified** | 2026-04-02 |

---

#### nb_conn_shortcut
| | |
|---|---|
| **File** | [src/notebooks/nb_conn_shortcut.py](../src/notebooks/nb_conn_shortcut.py) |
| **Stage** | Connectors |
| **Purpose** | Creates/manages OneLake shortcuts in the Bronze Lakehouse. Reads shortcut config from `control.ShortcutConfig`. |
| **Parameters** | `PipelineRunId`, `BronzeLakehouse`, `ControlLakehouse`, `ConfigFilesBase` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Fabric Pipeline: shortcut setup step |
| **Last modified** | 2026-04-23 |

---

#### nb_shortcut_functions
| | |
|---|---|
| **File** | [src/notebooks/nb_shortcut_functions.py](../src/notebooks/nb_shortcut_functions.py) |
| **Stage** | _Shared |
| **Purpose** | Shared library of OneLake shortcut helper functions (`create_shortcut`, `delete_shortcut`, `list_shortcuts`, etc.). `%run`'d by shortcut-related notebooks. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | `%run` from nb_conn_shortcut and others |
| **Last modified** | 2026-04-23 |

---

### Core Ingestion Pipeline

---

#### nb_landing_to_bronze
| | |
|---|---|
| **File** | [src/notebooks/nb_landing_to_bronze.py](../src/notebooks/nb_landing_to_bronze.py) |
| **Stage** | Core PySpark Orchestration |
| **Purpose** | Promotes Parquet files from Landing Lakehouse into Bronze Lakehouse as Delta tables. Handles schema inference, deduplication, and watermark updates. One call per ObjectName. |
| **Parameters** | `PipelineId`, `ObjectName`, `LandingLakehouse`, `BronzeLakehouse`, `ControlLakehouse` |
| **%run deps** | `nb_utils_config` |
| **Calls** | — |
| **Called by** | Fabric Pipeline: `00_Daily_Landing_Refresh` (fan-out per object) |
| **Last modified** | 2026-04-23 |

---

#### nb_catalog_sync
| | |
|---|---|
| **File** | [src/notebooks/nb_catalog_sync.py](../src/notebooks/nb_catalog_sync.py) |
| **Stage** | Connectors |
| **Purpose** | Diffs the Bronze Lakehouse catalog against `control.ObjectConfig`. Inserts missing rows for newly discovered tables. Idempotent — safe to run repeatedly. |
| **Parameters** | `PipelineRunId`, `BronzeLakehouse`, `BronzeLakehouseId` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | `nb_bronze_onboarding` (Step 1) |
| **Last modified** | 2026-04-24 |

---

#### nb_bronze_onboarding
| | |
|---|---|
| **File** | [src/notebooks/nb_bronze_onboarding.py](../src/notebooks/nb_bronze_onboarding.py) |
| **Stage** | Bronze → Silver |
| **Purpose** | Full Bronze onboarding chain: (1) nb_catalog_sync — discover new tables, (2) nb_view_seeder — create Silver views, (3) nb_bronze_to_silver — materialise Silver Delta tables. Run whenever new Dataverse/shortcut tables appear. |
| **Parameters** | `PipelineRunId`, `TableFilter`, `SkipB2S`, `PipelineID` |
| **%run deps** | — |
| **Calls** | `nb_log_event`, `nb_catalog_sync`, `nb_view_seeder` |
| **Called by** | Manual / Fabric Pipeline: onboarding trigger |
| **Last modified** | 2026-03-28 |

---

#### nb_bronze_to_silver
| | |
|---|---|
| **File** | [src/notebooks/nb_bronze_to_silver.py](../src/notebooks/nb_bronze_to_silver.py) |
| **Stage** | Silver Layer |
| **Purpose** | Core medallion transform: reads Bronze Delta → applies dedup, schema drift detection, cleansing rules, audit columns → writes Silver via strategy in nb_silver_transform (SCD0/1/2, FACT-TRANSACTION/SNAPSHOT). Updates watermarks. |
| **Parameters** | `BronzeLakehouse`, `SilverLakehouse`, `ControlLakehouse`, `TableFilter`, `ViewName`, `ViewSQL`, `PipelineID`, `PipelineRunId` |
| **%run deps** | `nb_utils_config` (inlines nb_silver_transform) |
| **Calls** | — |
| **Called by** | `nb_orchestrator` (fan-out via FanOutSource:ObjectConfig), `nb_bronze_onboarding` (new tables) |
| **Last modified** | 2026-04-25 |

---

#### nb_silver_transform
| | |
|---|---|
| **File** | [src/notebooks/nb_silver_transform.py](../src/notebooks/nb_silver_transform.py) |
| **Stage** | Silver Layer |
| **Purpose** | Silver write strategy library: `apply_scd0()`, `apply_scd1()`, `apply_scd2()`, `apply_fact_transaction()`, `apply_fact_snapshot()`. `%run`'d by nb_bronze_to_silver — not called directly. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | `%run` from nb_bronze_to_silver |
| **Notes** | TD-031: SCD2 delete-reinsert edge case not yet fixed. TD-035: hash-based change detection not yet added. |
| **Last modified** | 2026-04-25 |

---

#### nb_view_seeder
| | |
|---|---|
| **File** | [src/notebooks/nb_view_seeder.py](../src/notebooks/nb_view_seeder.py) |
| **Stage** | Bronze / Silver Layer |
| **Purpose** | Creates Silver-layer SQL views for each active ObjectConfig row. Views project Bronze Delta table columns into the Silver schema expected by nb_bronze_to_silver. |
| **Parameters** | `ControlLakehouse`, `BronzeLakehouse`, `SilverLakehouse`, `WorkspaceName`, `Layer`, `TableFilter`, `pipeline_id` |
| **%run deps** | `nb_utils_config`, `nb_utils_views` |
| **Calls** | — |
| **Called by** | `nb_bronze_onboarding` (Step 2), `nb_register_functions` |
| **Last modified** | 2026-04-25 |

---

#### nb_view_factory
| | |
|---|---|
| **File** | [src/notebooks/nb_view_factory.py](../src/notebooks/nb_view_factory.py) |
| **Stage** | Core PySpark Orchestration |
| **Purpose** | Generates and executes SQL view DDL across Bronze/Silver layers based on ObjectConfig metadata. Used to bulk-refresh view definitions after schema changes. |
| **Parameters** | `PipelineId`, `Layer`, `ControlLakehouse` |
| **%run deps** | `nb_utils_config`, `nb_utils_views` |
| **Calls** | — |
| **Called by** | Manual / maintenance pipelines |
| **Last modified** | 2026-04-23 |

---

#### nb_orchestrator
| | |
|---|---|
| **File** | [src/notebooks/nb_orchestrator.py](../src/notebooks/nb_orchestrator.py) |
| **Stage** | Core PySpark Orchestration |
| **Purpose** | Metadata-driven orchestrator. Reads `control.RunbookStep`, builds a `runMultiple` DAG with dependency chaining and fan-out (FanOutSource:ObjectConfig expands to N per-object nb_bronze_to_silver activities). |
| **Parameters** | `PipelineID`, `ControlLakehouse`, `LandingLakehouse` |
| **%run deps** | `nb_utils_config` |
| **Calls** | — (builds runMultiple DAG dynamically) |
| **Called by** | Fabric Pipeline: `10_Daily_Platform_Refresh` |
| **Last modified** | 2026-04-23 |

---

#### nb_notebook_generator
| | |
|---|---|
| **File** | [src/notebooks/nb_notebook_generator.py](../src/notebooks/nb_notebook_generator.py) |
| **Stage** | Silver Layer |
| **Purpose** | Metadata-driven Silver notebook generator. Reads `control.ViewScript`, generates `nb_SQL_vw_*` notebooks and publishes them to the Fabric workspace. Used when SQL-defined Silver views need their own notebook wrapper. |
| **Parameters** | `SilverLakehouse`, `BronzeLakehouse`, `ControlLakehouse`, `WorkspaceName`, `VariableLibraryName`, `ExecutionModeVariable`, `ExecutionModeFallback`, `Layer`, `TableFilter`, `RunDriftCheck`, `GenerateOnDrift`, `PublishNotebooks`, `FolderName`, `ParentFolderName`, `EnvironmentId` |
| **%run deps** | `nb_utils_config` |
| **Calls** | — |
| **Called by** | Manual / post-schema-drift automation |
| **Notes** | `EnvironmentId` now resolved from Variable Library (fixed 2026-04-25) |
| **Last modified** | 2026-04-25 |

---

### Gold Layer

---

#### nb_gold_orchestrator
| | |
|---|---|
| **File** | [src/notebooks/nb_gold_orchestrator.py](../src/notebooks/nb_gold_orchestrator.py) |
| **Stage** | Gold Layer |
| **Purpose** | Orchestrates Gold layer notebook execution: date dims, fact tables, summary tables, reporting dimensions. |
| **Parameters** | `PipelineRunId` |
| **%run deps** | — |
| **Calls** | `nb_log_event` |
| **Called by** | Fabric Pipeline: `10_Gold_Runner` |
| **Last modified** | 2026-03-28 |

---

#### nb_gold_catalog_sync
| | |
|---|---|
| **File** | [src/notebooks/nb_gold_catalog_sync.py](../src/notebooks/nb_gold_catalog_sync.py) |
| **Stage** | Gold Layer |
| **Purpose** | Syncs Gold Lakehouse table catalog with control metadata. Discovers new Gold candidate tables and registers them. |
| **Parameters** | `WorkspaceId`, `ControlLakehouse`, `GoldPipelineID`, `ModelPipelineID`, `GoldNamePrefixes`, `PipelineRunId` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual / Gold pipeline |
| **Last modified** | 2026-04-25 |

---

#### nb_gold_candidate_detection
| | |
|---|---|
| **File** | [src/notebooks/nb_gold_candidate_detection.py](../src/notebooks/nb_gold_candidate_detection.py) |
| **Stage** | Gold Layer — Discovery |
| **Purpose** | Analyses Silver tables to identify candidates for Gold promotion: detects fact/dimension patterns, key coverage, join relationships. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual (discovery/analysis) |
| **Last modified** | 2026-04-25 |

---

#### nb_create_date_dim
| | |
|---|---|
| **File** | [src/notebooks/nb_create_date_dim.py](../src/notebooks/nb_create_date_dim.py) |
| **Stage** | Gold Layer |
| **Purpose** | Creates/refreshes the standard Date dimension table in Gold Lakehouse. |
| **Parameters** | `PipelineRunId`, `SilverLakehouse`, `GoldLakehouse`, `DateRangeStart`, `DateRangeEnd` |
| **%run deps** | — |
| **Calls** | `nb_log_event` |
| **Called by** | `nb_gold_orchestrator` |
| **Last modified** | 2026-04-02 |

---

#### nb_create_dimdate
| | |
|---|---|
| **File** | [src/notebooks/nb_create_dimdate.py](../src/notebooks/nb_create_dimdate.py) |
| **Stage** | Gold Layer |
| **Purpose** | Alternative date dimension builder (extended format). |
| **Parameters** | `GoldLakehouse`, `StartDate`, `EndDate` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual / Gold pipeline variant |
| **Last modified** | 2026-04-02 |

---

#### nb_create_dimdate_default
| | |
|---|---|
| **File** | [src/notebooks/nb_create_dimdate_default.py](../src/notebooks/nb_create_dimdate_default.py) |
| **Stage** | Gold Layer |
| **Purpose** | Creates the default DimDate table with standard the platform date attributes. Logged via nb_log_event. |
| **Parameters** | `PipelineRunId`, `GoldLakehouse`, `DateRangeStart`, `DateRangeEnd` |
| **%run deps** | — |
| **Calls** | `nb_log_event` |
| **Called by** | `nb_gold_orchestrator` |
| **Last modified** | 2026-04-02 |

---

#### nb_create_summary_table
| | |
|---|---|
| **File** | [src/notebooks/nb_create_summary_table.py](../src/notebooks/nb_create_summary_table.py) |
| **Stage** | Gold Layer |
| **Purpose** | Builds configured summary/aggregate tables in Gold from Silver source tables. |
| **Parameters** | `PipelineRunId`, `SilverLakehouse`, `GoldLakehouse`, `BronzeLakehouse` |
| **%run deps** | — |
| **Calls** | `nb_log_event` |
| **Called by** | `nb_gold_orchestrator` |
| **Last modified** | 2026-04-02 |

---

#### nb_configure_reporting_dimension
| | |
|---|---|
| **File** | [src/notebooks/nb_configure_reporting_dimension.py](../src/notebooks/nb_configure_reporting_dimension.py) |
| **Stage** | Gold Layer |
| **Purpose** | Configures reporting dimension tables in Gold — applies attribute mappings, surrogate key assignment, SCD metadata. |
| **Parameters** | `PipelineRunId`, `SilverLakehouse` |
| **%run deps** | — |
| **Calls** | `nb_log_event` |
| **Called by** | `nb_gold_orchestrator` |
| **Last modified** | 2026-04-02 |

---

#### nb_create_purchase_invoice_fact
| | |
|---|---|
| **File** | [src/notebooks/nb_create_purchase_invoice_fact.py](../src/notebooks/nb_create_purchase_invoice_fact.py) |
| **Stage** | Gold Layer |
| **Purpose** | Builds the Purchase Invoice fact table in Gold from Silver source tables. client-specific domain logic. |
| **Parameters** | `PipelineRunId`, `SilverLakehouse` |
| **%run deps** | — |
| **Calls** | `nb_log_event` |
| **Called by** | `nb_gold_orchestrator` |
| **Last modified** | 2026-04-02 |

---

#### nb_purchase_order_fact_extension
| | |
|---|---|
| **File** | [src/notebooks/nb_purchase_order_fact_extension.py](../src/notebooks/nb_purchase_order_fact_extension.py) |
| **Stage** | Gold Layer |
| **Purpose** | Extends the Purchase Order fact table with additional derived columns or business rules. |
| **Parameters** | `PipelineRunId`, `SilverLakehouse`, `GoldLakehouse` |
| **%run deps** | — |
| **Calls** | `nb_log_event` |
| **Called by** | `nb_gold_orchestrator` |
| **Last modified** | 2026-04-02 |

---

#### nb_purchase_order_number_dim_extension
| | |
|---|---|
| **File** | [src/notebooks/nb_purchase_order_number_dim_extension.py](../src/notebooks/nb_purchase_order_number_dim_extension.py) |
| **Stage** | Gold Layer |
| **Purpose** | Extends Purchase Order Number dimension with additional attributes. |
| **Parameters** | `PipelineRunId`, `SilverLakehouse` |
| **%run deps** | — |
| **Calls** | `nb_log_event` |
| **Called by** | `nb_gold_orchestrator` |
| **Last modified** | 2026-04-02 |

---

#### nb_build_throughput
| | |
|---|---|
| **File** | [src/notebooks/nb_build_throughput.py](../src/notebooks/nb_build_throughput.py) |
| **Stage** | Gold / Reporting |
| **Purpose** | Triggers semantic model refresh via Power BI REST API. Resolves workspace/model IDs from parameters. |
| **Parameters** | `WorkspaceId`, `ModelName`, `ControlLakehouse`, `GoldLakehouse` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Fabric Pipeline: `pl_refresh_semantic_models` |
| **Last modified** | 2026-04-02 |

---

#### nb_apply_masking
| | |
|---|---|
| **File** | [src/notebooks/nb_apply_masking.py](../src/notebooks/nb_apply_masking.py) |
| **Stage** | Gold / Governance |
| **Purpose** | Applies PII column masking rules to Silver/Gold tables as defined in `control.ObjectConfig.PiiColumns` / `RequiresMasking`. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual / governance pipeline |
| **Last modified** | 2026-04-02 |

---

### Control & Logging

---

#### nb_log_event
| | |
|---|---|
| **File** | [src/notebooks/nb_log_event.py](../src/notebooks/nb_log_event.py) |
| **Stage** | Platform Control |
| **Purpose** | Central event logging notebook. Writes a row to `control.ControlLog` with pipeline run ID, pipeline/config IDs, event type, row count, error message, and watermark info. |
| **Parameters** | `PipelineRunId`, `PipelineID`, `ConfigID`, `ObjectName`, `EventType`, `RowsProcessed`, `ErrorMessage`, `WatermarkColumn`, `ControlLakehouseId` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | nb_bronze_onboarding, nb_gold_orchestrator, nb_create_date_dim, nb_create_dimdate_default, nb_create_summary_table, nb_configure_reporting_dimension, nb_create_purchase_invoice_fact, nb_purchase_order_fact_extension, nb_purchase_order_number_dim_extension |
| **Last modified** | 2026-04-02 |

---

#### nb_flush_log_queue
| | |
|---|---|
| **File** | [src/notebooks/nb_flush_log_queue.py](../src/notebooks/nb_flush_log_queue.py) |
| **Stage** | Control |
| **Purpose** | Drains the in-memory log queue to `control.ControlLog`. Used to batch-write log entries from parallel notebook sessions where direct Delta writes could cause ConcurrentAppendException. |
| **Parameters** | `ControlLakehouse`, `PipelineRunId` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | nb_orchestrator (end of pipeline run) |
| **Last modified** | 2026-04-02 |

---

#### nb_smoke_assert
| | |
|---|---|
| **File** | [src/notebooks/nb_smoke_assert.py](../src/notebooks/nb_smoke_assert.py) |
| **Stage** | CI/CD Smoke Testing |
| **Purpose** | Post-publish smoke test. Asserts that `control.ControlLog` contains the expected number of events for a given PipelineID since a given timestamp. Fails the pipeline if assertions are not met. |
| **Parameters** | `ControlLakehouse`, `PipelineID`, `RunAfterTimestamp`, `ExpectedCount` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Azure DevOps pipeline / post-publish validation step |
| **Last modified** | 2026-04-02 |

---

### Maintenance & Admin

---

#### nb_optimize
| | |
|---|---|
| **File** | [src/notebooks/nb_optimize.py](../src/notebooks/nb_optimize.py) |
| **Stage** | Maintenance |
| **Purpose** | Runs `OPTIMIZE` + `VACUUM` on Bronze, Silver, and Control Delta tables. Scheduled weekly to reclaim space and compact small files. |
| **Parameters** | `PipelineId`, `BronzeLakehouse`, `SilverLakehouse`, `ControlLakehouse` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Fabric Pipeline: `Weekly_Optimise` |
| **Last modified** | 2026-04-02 |

---

#### nb_platform_reset
| | |
|---|---|
| **File** | [src/notebooks/nb_platform_reset.py](../src/notebooks/nb_platform_reset.py) |
| **Stage** | Maintenance |
| **Purpose** | Drops and recreates all Delta tables across Bronze/Silver/Gold/Control Lakehouses. **Destructive** — use only in dev/reset scenarios. |
| **Parameters** | `PipelineRunId`, `BronzeLakehouse`, `SilverLakehouse`, `GoldLakehouse`, `ControlLakehouse` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | `nb_platform_setup` (when `RunReset=True`) |
| **Last modified** | 2026-04-02 |

---

#### nb_platform_reset_functions
| | |
|---|---|
| **File** | [src/notebooks/nb_platform_reset_functions.py](../src/notebooks/nb_platform_reset_functions.py) |
| **Stage** | Maintenance |
| **Purpose** | Helper functions for nb_platform_reset — shared drop/recreate logic. |
| **Parameters** | `DummyParam` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | `%run` from nb_platform_reset |
| **Last modified** | 2026-04-02 |

---

#### nb_drop_all_tables
| | |
|---|---|
| **File** | [src/notebooks/nb_drop_all_tables.py](../src/notebooks/nb_drop_all_tables.py) |
| **Stage** | Maintenance |
| **Purpose** | Drops all Delta tables in a specified Lakehouse. Supports `DryRun=True` to preview without executing. |
| **Parameters** | `LakehouseName`, `DryRun` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual |
| **Last modified** | 2026-04-02 |

---

#### nb_register_object
| | |
|---|---|
| **File** | [src/notebooks/nb_register_object.py](../src/notebooks/nb_register_object.py) |
| **Stage** | Maintenance |
| **Purpose** | Registers a new ObjectConfig row interactively. Optionally triggers nb_view_seeder and nb_bronze_to_silver for immediate onboarding. |
| **Parameters** | `ObjectName`, `Confirm`, `RunViewSeeder`, `RunB2S`, `PipelineRunId` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual |
| **Last modified** | 2026-04-02 |

---

#### nb_deregister_object
| | |
|---|---|
| **File** | [src/notebooks/nb_deregister_object.py](../src/notebooks/nb_deregister_object.py) |
| **Stage** | Maintenance |
| **Purpose** | Removes an ObjectConfig row and optionally drops Bronze/Silver tables. |
| **Parameters** | `ObjectName`, `ConfirmDrop`, `BronzeAction`, `SilverAction` |
| **%run deps** | `nb_deregister_functions` |
| **Calls** | — |
| **Called by** | Manual |
| **Last modified** | 2026-04-02 |

---

#### nb_deregister_functions
| | |
|---|---|
| **File** | [src/notebooks/nb_deregister_functions.py](../src/notebooks/nb_deregister_functions.py) |
| **Stage** | Maintenance |
| **Purpose** | Shared drop/deregistration helper functions used by nb_deregister_object. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | `%run` from nb_deregister_object |
| **Last modified** | 2026-04-23 |

---

#### nb_register_functions
| | |
|---|---|
| **File** | [src/notebooks/nb_register_functions.py](../src/notebooks/nb_register_functions.py) |
| **Stage** | Maintenance |
| **Purpose** | Batch object registration helper. Calls nb_view_seeder and nb_bronze_to_silver for new objects. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | `ViewSeeder`, `BronzeToSilver` |
| **Called by** | Manual |
| **Last modified** | 2026-04-23 |

---

#### nb_maintenance_objectconfig
| | |
|---|---|
| **File** | [src/notebooks/nb_maintenance_objectconfig.py](../src/notebooks/nb_maintenance_objectconfig.py) |
| **Stage** | Maintenance |
| **Purpose** | Interactive widget-based UI for editing `control.ObjectConfig` rows. |
| **Parameters** | — |
| **%run deps** | `nb_widget_library` |
| **Calls** | — |
| **Called by** | Manual (Fabric notebook UI) |
| **Last modified** | 2026-04-02 |

---

#### nb_capacity_scale
| | |
|---|---|
| **File** | [src/notebooks/nb_capacity_scale.py](../src/notebooks/nb_capacity_scale.py) |
| **Stage** | Platform |
| **Purpose** | Scales Fabric capacity SKU up/down via Azure REST API. Used for cost management — scale up before heavy runs, scale down after. |
| **Parameters** | `SubscriptionId`, `ResourceGroup`, `CapacityName`, `Action`, `TargetSku`, `PipelineRunId` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Pre/post pipeline wrapper |
| **Last modified** | 2026-04-02 |

---

#### nb_var_library_admin
| | |
|---|---|
| **File** | [src/notebooks/nb_var_library_admin.py](../src/notebooks/nb_var_library_admin.py) |
| **Stage** | 400_Config |
| **Purpose** | Interactive CRUD notebook for the `Platform_Config` Variable Library. Read/switch/update/add/delete variables. LibraryId resolved dynamically via `sempy_labs.list_variable_libraries()`. |
| **Parameters** | `ActiveValueSet`, `LibraryName`, `LibraryId` |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual |
| **Notes** | LibraryId dynamic resolution added 2026-04-25 (removed hardcoded GUID) |
| **Last modified** | 2026-04-25 |

---

#### nb_json_admin
| | |
|---|---|
| **File** | [src/notebooks/nb_json_admin.py](../src/notebooks/nb_json_admin.py) |
| **Stage** | Utilities |
| **Purpose** | Widget-based UI for editing JSON config files (e.g. `config/seed-dev.json`) stored in the workspace. |
| **Parameters** | — |
| **%run deps** | `nb_widget_library` |
| **Calls** | — |
| **Called by** | Manual |
| **Last modified** | 2026-04-02 |

---

#### nb_schema_explorer
| | |
|---|---|
| **File** | [src/notebooks/nb_schema_explorer.py](../src/notebooks/nb_schema_explorer.py) |
| **Stage** | Discovery |
| **Purpose** | Interactive schema browser for Bronze/Silver/Gold Lakehouses. Lists tables, columns, and row counts. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual |
| **Last modified** | 2026-04-23 |

---

### Reporting

---

#### nb_fix_reports
| | |
|---|---|
| **File** | [src/notebooks/nb_fix_reports.py](../src/notebooks/nb_fix_reports.py) |
| **Stage** | Reporting |
| **Purpose** | Applies hotfix patches to Power BI report definitions in the workspace. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual / post-deploy fix |
| **Last modified** | 2026-04-02 |

---

#### nb_fix_reports_complete
| | |
|---|---|
| **File** | [src/notebooks/nb_fix_reports_complete.py](../src/notebooks/nb_fix_reports_complete.py) |
| **Stage** | Reporting |
| **Purpose** | Full report repair notebook — applies all known report fixes and validates report item definitions. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | Manual |
| **Last modified** | 2026-04-25 |

---

### Shared Libraries (not deployed as standalone notebooks)

---

#### nb_utils_config
| | |
|---|---|
| **File** | [src/notebooks/nb_utils_config.py](../src/notebooks/nb_utils_config.py) |
| **Stage** | Core PySpark |
| **Purpose** | Core shared library. Inlined into all pipeline notebooks via `%run`. Resolves Variable Library config (Lakehouse names, EnvironmentId), sets Spark session config, provides `_ws_id`, `_in_fabric`, `control_lh`, and logging helpers. |
| **Parameters** | — |
| **%run deps** | — |
| **Calls** | — |
| **Called by** | `%run` from nb_bronze_to_silver, nb_conn_file, nb_conn_jdbc, nb_conn_rest, nb_landing_to_bronze, nb_notebook_generator, nb_orchestrator, nb_view_factory, nb_view_seeder |
| **Last modified** | 2026-04-23 |

---

#### nb_utils_views
| | |
|---|---|
| **File** | [src/notebooks/nb_utils_views.py](../src/notebooks/nb_utils_views.py) |
| **Stage** | Shared Library |
| **Purpose** | View DDL generation helpers: `build_view_sql()`, `create_or_replace_view()`, column mapping utilities. |
| **Called by** | `%run` from nb_view_factory, nb_view_seeder |
| **Last modified** | 2026-04-02 |

---

#### nb_utils_watermark
| | |
|---|---|
| **File** | [src/notebooks/nb_utils_watermark.py](../src/notebooks/nb_utils_watermark.py) |
| **Stage** | Shared Library |
| **Purpose** | Watermark read/write helpers: `get_watermark()`, `update_watermark()` against `control.Watermarks` Delta table. Used by nb_landing_to_bronze and nb_bronze_to_silver. |
| **Called by** | Inlined into ingestion notebooks |
| **Last modified** | 2026-04-24 |

---

#### nb_utils_schema
| | |
|---|---|
| **File** | [src/notebooks/nb_utils_schema.py](../src/notebooks/nb_utils_schema.py) |
| **Stage** | Shared Library |
| **Purpose** | Schema drift detection and reconciliation: `detect_and_reconcile_schema()`, column type coercion, nullable handling. |
| **Called by** | Inlined into nb_bronze_to_silver |
| **Last modified** | 2026-04-02 |

---

#### nb_utils_processing
| | |
|---|---|
| **File** | [src/notebooks/nb_utils_processing.py](../src/notebooks/nb_utils_processing.py) |
| **Stage** | Shared Library |
| **Purpose** | Processing utilities: deduplication, audit column injection, cleansing rule application, row validation. |
| **Called by** | Inlined into nb_bronze_to_silver |
| **Last modified** | 2026-04-24 |

---

#### nb_utils_fabric
| | |
|---|---|
| **File** | [src/notebooks/nb_utils_fabric.py](../src/notebooks/nb_utils_fabric.py) |
| **Stage** | Shared Library |
| **Purpose** | Fabric API helpers: workspace item listing, notebook publish, lakehouse ID resolution via `sempy_labs`. |
| **Called by** | nb_notebook_generator, nb_utils_publish |
| **Last modified** | 2026-04-24 |

---

#### nb_utils_publish *(utility-only — not published to Fabric)*
| | |
|---|---|
| **File** | [src/notebooks/nb_utils_publish.py](../src/notebooks/nb_utils_publish.py) |
| **Stage** | Shared Library (local scripts only) |
| **Purpose** | Notebook publication helpers used by `scripts/fabric_publish.py` at build time. Not deployed to Fabric. |
| **Called by** | `scripts/fabric_publish.py` |
| **Last modified** | 2026-03-28 |

---

#### nb_widget_library
| | |
|---|---|
| **File** | [src/notebooks/nb_widget_library.py](../src/notebooks/nb_widget_library.py) |
| **Stage** | Utilities |
| **Purpose** | ipywidgets-based UI component library. Provides dropdowns, text inputs, confirmation dialogs for interactive admin notebooks. |
| **Called by** | `%run` from nb_json_admin, nb_maintenance_objectconfig |
| **Last modified** | 2026-04-02 |

---

## Change History — Git Log (last 3 commits per notebook)

> Source: `git log --oneline -3 -- src/notebooks/<file>` run on `main` branch 2026-04-25.  
> `nb_utils_fabric.py` returned empty (file not yet committed to branch).

| Notebook | Commit 1 | Commit 2 | Commit 3 |
|---|---|---|---|
| nb_apply_masking | `93b6f8f` fix(hub): add missing %pip install | `4adc18f` fix: nb_apply_masking title suffix | `7e5cfed` Add new data pipelines |
| nb_bootstrap | `d203816` feat: schema support for B2S drift | `32f32c2` refactor: DDL-parsing schema reconciliation | `99d269e` fix: ConnectionConfig AuthMode migration |
| nb_bronze_onboarding | `0b46958` asd | — | — |
| nb_bronze_to_silver | `58570c2` refactor: %run ./nb_utils_config | `4b88eb4` refactor: migrate to %run pattern | `649a01d` docs: HOW IT WORKS block |
| nb_build_throughput | `93b6f8f` fix(hub): %pip install | `c23477a` Add new notebooks | `affb64d` feat: semantic model throughput |
| nb_capacity_scale | `93b6f8f` fix(hub): %pip install | `bcec0d6` feat: full redesign | `191d231` fix: backfill_watermark_column single MERGE |
| nb_catalog_sync | `93b6f8f` fix(hub): %pip install | `1262583` chore: replace hardcoded LH with VL | `755c423` refactor: move backfill_watermark_column |
| nb_configure_reporting_dimension | `2dfe37c` feat: parameterise LH names in Gold | `0b46958` asd | — |
| nb_conn_dataverse | `5a6907f` fix: role assignment endpoint | `06b7978` feat: code-first device-code bootstrap | `5551652` fix: remove broken user-bootstrap path |
| nb_conn_file | `58570c2` refactor: %run ./nb_utils_config | `4b88eb4` refactor: %run pattern | `93b6f8f` fix(hub): %pip install |
| nb_conn_jdbc | `58570c2` refactor: %run ./nb_utils_config | `4b88eb4` refactor: %run pattern | `93b6f8f` fix(hub): %pip install |
| nb_conn_rest | `58570c2` refactor: %run ./nb_utils_config | `4b88eb4` refactor: %run pattern | `313b092` feat: HiBob BASIC auth support |
| nb_conn_shortcut | `93b6f8f` fix(hub): %pip install | `1262583` chore: replace hardcoded LH with VL | `0b46958` asd |
| nb_create_date_dim | `9709922` feat: Silver-absent fallback + Gold LH param | `2dfe37c` feat: parameterise LH names | `0b46958` asd |
| nb_create_dimdate_default | `1588e48` feat: pure date-range dim_date | — | — |
| nb_create_dimdate | `93b6f8f` fix(hub): %pip install | `c23477a` Add new notebooks | `b0fdd74` feat: initial platform implementation |
| nb_create_purchase_invoice_fact | `2dfe37c` feat: parameterise LH names | `0b46958` asd | — |
| nb_create_summary_table | `2dfe37c` feat: parameterise LH names | `0b46958` asd | — |
| nb_deregister_functions | `93b6f8f` fix(hub): %pip install | `8e0d1fd` feat: multi-line description formatting | `f860237` fix: archive prefix, frontmatter parser |
| nb_deregister_object | `93b6f8f` fix(hub): %pip install | `1262583` chore: replace hardcoded LH with VL | `c010965` fix: support markdown cells |
| nb_drop_all_tables | `93b6f8f` fix(hub): %pip install | `2dfe37c` feat: parameterise LH names | `0b46958` asd |
| nb_env_setup | `ad84727` fix: %%configure JSON #-prefixed | `4287780` refactor: conform to Stage Notebook layout | `1588e48` feat: nb_create_dimdate_default |
| nb_fix_reports | `deafeb4` fix(wizard): remove external API scopes | — | — |
| nb_fix_reports_complete | `deafeb4` fix(wizard): remove external API scopes | — | — |
| nb_flush_log_queue | `8568534` feat: consolidate watermark into ControlLog | `0b46958` asd | `5d601cd` feat: Variable Library |
| nb_gold_candidate_detection | `1262583` chore: replace hardcoded LH with VL | `4de3695` fix: noqa-in-SQL ParseException | `a7301ea` fix: datetime rebase + Gold bootstrap |
| nb_gold_catalog_sync | `0b46958` asd | — | — |
| nb_gold_orchestrator | `0b46958` asd | — | — |
| nb_json_admin | `93b6f8f` fix(hub): %pip install | `bf0dd6d` fix: replace hardcoded GUIDs | `5d601cd` feat: Variable Library |
| nb_landing_to_bronze | `c53c455` refactor: migrate to %run pattern | `4b88eb4` refactor: %run ../_Shared pattern | `93b6f8f` fix(hub): %pip install |
| nb_log_event | `93b6f8f` fix(hub): %pip install | `0b46958` asd | `6597279` refactor: migrate control plane to LH |
| nb_maintenance_objectconfig | `93b6f8f` fix(hub): %pip install | `0b46958` asd | — |
| nb_notebook_generator | `d203816` feat: schema support for B2S drift | `c6d5353` refactor: generic LH name fallbacks | `b2fa3d9` fix: restore _WORKSPACE_ID constant |
| nb_optimize | `93b6f8f` fix(hub): %pip install | `c23477a` Add new notebooks | `b0fdd74` feat: initial platform |
| nb_orchestrator | `c53c455` refactor: migrate to %run pattern | `4b88eb4` refactor: %run ../_Shared | `93b6f8f` fix(hub): %pip install |
| nb_platform_bootstrapper | `01625f8` fix: KV url format & ARM check | `0e86d91` feat: deployment wizard infra | — |
| nb_platform_reset | `1d74181` feat: Hub deployment scripts | — | — |
| nb_platform_reset_functions | `1d74181` feat: Hub deployment scripts | — | — |
| nb_platform_setup | `1d74181` feat: Hub deployment scripts | — | — |
| nb_purchase_order_fact_extension | `2dfe37c` feat: parameterise LH names | `0b46958` asd | — |
| nb_purchase_order_number_dim_extension | `2dfe37c` feat: parameterise LH names | `0b46958` asd | — |
| nb_register_functions | `93b6f8f` fix(hub): %pip install | `0b46958` asd | — |
| nb_register_object | `983303f` fix: replace hardcoded db_control | `0b46958` asd | — |
| nb_schema_explorer | `93b6f8f` fix(hub): %pip install | `1262583` chore: replace hardcoded LH with VL | `dce623c` feat: sempy schema discovery + natural key audit |
| nb_seed_control_lh | `e37bdd5` refactor: remove hardcoded LH/workspace IDs | `93b6f8f` fix(hub): %pip install | `1262583` chore: replace hardcoded LH with VL |
| nb_shortcut_functions | `1d74181` feat: Hub deployment scripts | — | — |
| nb_silver_transform | `020585b` fix: apply_fact_transaction first-run CTAS | `deb377f` fix: Silver write fails no-schema LH | `9428c64` fix: default SilverSchema NULL → dbo |
| nb_smoke_assert | `93b6f8f` fix(hub): %pip install | `1262583` chore: replace hardcoded LH with VL | `8f47f6f` fix: 03_File_Connector UnknownError |
| nb_utils_config | `7b4583c` feat: create standalone notebook | `273089d` refactor: remove hardcoded GUIDs | `a61bea0` fix: remove invalid additionalLakehouses |
| nb_utils_fabric | *(no commits on this branch)* | — | — |
| nb_utils_processing | `55eeeea` fix: write_gold() use saveAsTable | `8568534` feat: consolidate watermark | `915b368` refactor: simplify nb_bronze_to_silver |
| nb_utils_publish | `16dc8b7` feat: auto-create missing target folders | `a8642dd` feat: workspace folder support via folderId | `b01e8c1` docs: Fabric CI/CD patterns |
| nb_utils_schema | `1310115` fix: VOID guard regression | `e49ad4b` fix: cast NullType/VOID to StringType | `915b368` refactor: simplify nb_bronze_to_silver |
| nb_utils_views | `93b6f8f` fix(hub): %pip install | `12817c1` feat: extract execute_view_ddl() | — |
| nb_utils_watermark | `93b6f8f` fix(hub): %pip install | `70fb5bd` fix: noqa comment killed watermark saves | `48a8d99` feat: backfill_watermark_column WatermarkColumnDataType |
| nb_var_library_admin | `ccf463b` fix: native ipywidgets (Monaco isolation) | `21fe1d6` feat: full CRUD for Platform_Config | — |
| nb_view_factory | `c53c455` refactor: migrate to %run pattern | `4b88eb4` refactor: %run ../_Shared | `93b6f8f` fix(hub): %pip install |
| nb_view_seeder | `d203816` feat: schema support for B2S drift | `a55e9a3` refactor: simplify parameters | `58570c2` refactor: %run ./nb_utils_config |
| nb_widget_library | `1d74181` feat: Hub deployment scripts | — | — |

---

## Open Items

| Notebook | Issue | TD Ref |
|---|---|---|
| nb_silver_transform | SCD2 delete-reinsert edge case | TD-031 |
| nb_silver_transform | Hash-based change detection not yet added | TD-035 |
| nb_silver_transform | V-Order + CDC not explicitly set on Silver tables | TD-036 |
| nb_landing_to_bronze | No filename timestamp sequencing for same-source backlogs | TD-037 |
| nb_conn_rest | HiBob BASIC auth on branch `claude/hibob-api-setup-WgSHk` — needs PR + merge + KV secret |  |
