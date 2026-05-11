# the platform Data Platform — Feature Plan
## "Best Fabric Framework: Easiest to Deploy, Easiest to Use"

> Created: 2026-04-25  
> Basis: FMD Framework capability comparison + the platform current state + user-guided setup vision  
> Principle: **Everything in FMD, plus better. Every interaction guided by a notebook wizard.**

---

## Vision

> A developer or data engineer can clone this repo, run one notebook, and have a fully operational medallion data platform in their Fabric workspace within 30 minutes — with zero knowledge of the internals required.
>
> Once deployed, adding a new data source takes 5 minutes and zero code.

---

## Guiding Principles

1. **Wizard-first** — every operational action (deploy, add source, register object, fix an issue) has a guided notebook
2. **Zero hardcoded config** — all environment references live in Variable Library or control tables
3. **Self-describing** — the platform documents itself; control tables are the source of truth
4. **Idempotent everywhere** — every notebook is safe to re-run; no side-effects on repeated execution
5. **Observable by default** — every run logs events, failures surface immediately, health is queryable
6. **Delta-native** — no external SQL DB dependency (advantage over FMD); control store stays in Delta

---

## Current State vs Target State

| Capability | FMD | the platform Now | the platform Target |
|---|---|---|---|
| Deployment experience | Fabric CLI scripts + markdown guide | Multiple notebooks, manual sequence | **Single wizard notebook — guided step by step** |
| Source onboarding | Bulk SQL introspection pipeline | Manual seed-dev.json + bootstrap | **Guided wizard: type → test → introspect → register** |
| SCD strategies | SCD2 only | SCD0/1/2/FACT-TXN/SNAPSHOT | Same (already ahead) |
| Change detection | Hash-based (MD5) | Column comparison | **Hash-based for SCD2 (TD-035)** |
| Delta optimisation | V-Order + CDF explicit | Not set | **Explicit V-Order + CDF on Silver writes (TD-036)** |
| Observability | 3 audit tables | ControlLog + manual queries | **Health dashboard notebook + semantic model** |
| Data quality | 4 cleansing utilities + custom NB | Cleansing rules + masking | **Cleansing wizard + DQ scorecard notebook** |
| Connectors | JDBC/ADLS/REST/SFTP/FTP/Oracle/SQLMI/ADF | JDBC/REST/File/Dataverse/Shortcut | **+ SFTP/FTPS, SharePoint, Oracle/SQLMI JDBC** |
| Business domains | Separate Gold workspaces + scaffold | Single Gold LH | **Domain scaffold wizard + multi-workspace support** |
| Workspace identity | Yes (primary auth model) | SPN (TD-032 open) | **Workspace Identity as default (TD-032)** |
| Connection testing | None (discover at runtime) | None | **Pre-flight connection test notebook** |
| Schema exploration | None | nb_schema_explorer | Keep + enhance |
| Taskflow | Yes (Fabric native) | No | **Taskflow definitions for all major pipelines** |
| CI/CD | Fabric CLI import | ADO pipeline + build scripts | **Keep ADO + add Fabric CLI alternative** |

---

## Feature Pillars & Roadmap

---

### PILLAR 1 — Zero-Friction Deployment

**Goal:** A new engineer runs one notebook and the platform is live.  
**Success metric:** Full dev deployment in < 30 minutes from a blank Fabric workspace.

---

#### P1-A: `nb_deploy_wizard.py` — Master Deployment Wizard *(new)*

Interactive step-by-step deployment notebook. Replaces the current manual sequence of nb_env_setup → nb_bootstrap → nb_seed_control_lh → nb_platform_setup.

**Wizard steps:**
```
Step 1: Environment Profile
  ├── Workspace name / ID (auto-detected from notebookutils.runtime)
  ├── Environment prefix (dev / test / prod)
  └── Capacity check (verify F-SKU ≥ F2)

Step 2: Lakehouse Setup
  ├── Check existing / create: Bronze, Silver, Gold, Control LHs
  ├── Resolve or create Variable Library (Platform_Config)
  └── Write LH names + IDs to Variable Library

Step 3: Key Vault Configuration
  ├── KV URL input
  ├── Test KV connectivity (fetch a known secret or list secrets)
  └── Store KV URL in Variable Library

Step 4: Control Schema Bootstrap
  ├── Run nb_bootstrap (idempotent DDL)
  └── Show table count confirmation

Step 5: Seed Control Data
  ├── Detect environment (dev/test/prod)
  ├── Load matching seed-{env}.json
  └── Show seeded row counts per table

Step 6: Environment Validation
  ├── Run nb_environment_validator
  └── Show green/amber/red health summary

Step 7: Summary
  └── Print deployment report (workspace, LH IDs, VL status, seed status)
```

**Design notes:**
- Uses `ipywidgets` for interactive input (matching nb_var_library_admin pattern)
- Each step is skippable if already completed (idempotent guard checks)
- Final summary is a copy-pasteable markdown block for runbook documentation

---

#### P1-B: `nb_environment_validator.py` — Pre-flight & Post-deploy Validator *(new)*

Standalone notebook callable from wizard or independently. Checks:

| Check | Pass condition |
|---|---|
| Variable Library present | `Platform_Config` resolves with `list_variable_libraries()` |
| All 4 Lakehouses exist | IDs resolvable via sempy_labs |
| Control tables present | All 12 control.* tables exist in Control LH |
| KV accessible | Test secret fetch (configurable secret name) |
| Spark environment set | Environment not `Default` (or configured) |
| ObjectConfig rows > 0 | At least 1 active object registered |
| Watermarks table writable | Insert + delete test row |

**Output:** Colour-coded pass/fail table. Returns a `ValidationResult` dict for programmatic use from nb_deploy_wizard.

**Parameters:** `ControlLakehouse`, `KeyVaultUrl`, `SkipKVCheck` (default False)

---

#### P1-C: Environment-per-seed-file pattern *(enhancement to existing)*

Currently: one `seed-dev.json`.  
Target: `config/seed-{env}.json` (already partially present). nb_deploy_wizard detects env from `EnvPrefix` variable and loads the right file.

Add: `config/seed-template.json` — empty-but-documented template for new environment onboarding.

---

#### P1-D: Fabric CLI deployment path *(new `scripts/`)*

Parallel to ADO pipeline: `scripts/deploy_fabric_cli.sh` that uses `fab` CLI to:
- Create workspaces
- Import all platform items
- Assign capacity
- Set Variable Library values

This makes the platform CLI-deployable like FMD, but retaining ADO pipeline as primary.

---

### PILLAR 2 — One-Command Source Onboarding

**Goal:** Adding a new data source requires no code changes and no JSON editing.  
**Success metric:** New JDBC source fully registered and first load complete in < 5 minutes.

---

#### P2-A: `nb_source_wizard.py` — Guided Source Registration *(new)*

Single notebook that walks through registering a completely new data source end-to-end.

**Wizard flow:**
```
Step 1: Source Type
  └── [JDBC | REST | File | Dataverse | Shortcut]

Step 2: Connection Details  (branching by type)
  JDBC:  server, database, auth type (SQL/SPN/KV), KV secret name
  REST:  base URL, auth mode (BEARER/BASIC), KV secret name, pagination mode
  File:  ADLS path, file format, delimiter
  Dataverse: org URL, SPN details

Step 3: Connection Test
  └── Run nb_connection_test inline — show success/failure

Step 4: Schema Introspection  (JDBC only)
  ├── List tables in source schema
  ├── User selects tables to onboard
  └── Infer PKs, data types, incremental column candidates

Step 5: Object Configuration
  ├── Show proposed ObjectConfig rows (pre-populated from introspection)
  ├── User edits: SCD type, PK column, watermark column, cleansing rules
  └── Confirm

Step 6: Write to Control Tables
  ├── Insert ConnectionConfig row
  ├── Insert IngestionConfig rows
  ├── Insert ObjectConfig rows
  └── Run nb_catalog_sync to verify

Step 7: First Load (optional)
  └── Trigger connector notebook immediately for selected objects
```

---

#### P2-B: `nb_connection_test.py` — Connection Health Check *(new)*

Standalone notebook (also called inline by nb_source_wizard):

| Source type | Test performed |
|---|---|
| JDBC | `spark.read.jdbc()` with `SELECT 1` query; surface driver error with friendly message |
| REST | `requests.get(base_url, headers=auth_headers)` — show status code, response time |
| File/ADLS | `mssparkutils.fs.ls(path)` — surface permission errors clearly |
| Dataverse | OData `$top=1` fetch |
| KV secret | `mssparkutils.credentials.getSecret()` — surface `SecretNotFound` vs `AccessDenied` |

**Parameters:** `SourceName` (lookup from control tables) or inline params for ad-hoc test.

---

#### P2-C: `nb_jdbc_introspect.py` — SQL Schema Introspection *(new, covers TD-038)*

Equivalent to FMD's `PL_TOOLING_POST_ASQL_TO_FMD`. Takes a JDBC connection and source schema, returns proposed metadata rows.

**Inputs:** `ConnectionName`, `SourceSchema`, `TableFilter` (optional regex), `KeyVaultUrl`

**Outputs:**
- DataFrame of `(table_name, columns, pk_candidates, row_count, has_updated_at)`
- Widget to review/edit PK and watermark columns
- Button: "Write to ObjectConfig" → inserts rows with `IsActive=False` (review-before-enable pattern)
- Button: "Write to IngestionConfig" → inserts connector config rows

**PK inference logic:**
1. Check `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` for PRIMARY KEY constraints
2. If none: check column names matching `*Id`, `*Key`, `*No` patterns
3. Flag uncertainty with amber warning

---

#### P2-D: Cleansing Rule Wizard *(enhancement to nb_maintenance_objectconfig)*

Extend the existing widget UI with a "Cleansing Rules" tab:
- Add/remove rules per object
- Rule types: `NORMALIZE_TEXT`, `COLUMN_SPLIT`, `NULL_FILL`, `DATETIME_PARSE` (matching FMD's 4 utilities)
- Preview rule effect on sample data before saving

---

### PILLAR 3 — Silver Processing Quality

**Goal:** Correct, performant, and observable Silver writes for all SCD strategies.

---

#### P3-A: Hash-based change detection in SCD2 *(TD-035)*

Add `HashedPKColumn` and `HashedNonKeyColumns` (MD5) to the Silver Delta table schema.

**Changes in `nb_silver_transform.py`:**
```python
from pyspark.sql.functions import md5, concat_ws, col

def _add_hash_columns(df, pk_cols, non_key_cols):
    return df \
        .withColumn("_hash_pk", md5(concat_ws("|", *[col(c) for c in pk_cols]))) \
        .withColumn("_hash_nk", md5(concat_ws("|", *[col(c) for c in non_key_cols])))
```

`apply_scd2()` change detection becomes:
```python
# Before: direct column-by-column join comparison
# After: single hash column comparison → O(1) per row vs O(N columns)
changed = silver.join(staging, on="_hash_pk") \
    .filter(col("silver._hash_nk") != col("staging._hash_nk"))
```

**Control table change:** Add `HashedNonKeyColumns` (comma-separated) to `ObjectConfig`. If empty, fall back to current column-by-column comparison (backward compatible).

---

#### P3-B: Explicit V-Order + Change Data Feed on Silver tables *(TD-036)*

In `nb_silver_transform.py`, all Silver Delta write operations add:
```python
spark.conf.set("spark.microsoft.delta.optimizeWrite.enabled", "true")
spark.conf.set("spark.microsoft.delta.optimizeWrite.binSize", "1073741824")
```

On first-run table creation (CTAS path), add Delta properties:
```python
delta_props = {
    "delta.enableChangeDataFeed": "true",
    "delta.autoOptimize.optimizeWrite": "true",  
    "delta.autoOptimize.autoCompact": "true"
}
```

For existing tables (ALTER TABLE path), add migration guard in nb_bootstrap (runs once via `IF NOT EXISTS` property check).

---

#### P3-C: SCD2 delete-and-reinsert fix *(TD-031)*

In `apply_scd2()`: when a source row reappears after a soft-delete (`IsDeleted=True`), current logic creates a duplicate active row rather than reactivating the existing closed record.

**Fix:** Before the main MERGE, check for records where `_hash_pk` exists in Silver with `IsCurrent=False AND IsDeleted=True` and the source has the same key. Reopen the record (set `IsCurrent=True`, `IsDeleted=False`, `RecordEndDate=NULL`) rather than inserting a new row.

---

#### P3-D: Filename timestamp sequencing in landing-to-Bronze *(TD-037)*

In `nb_landing_to_bronze.py`, when multiple files exist for the same `SourceName`, process them in chronological order based on `YYYYMMDDHHMM` prefix in filename.

```python
def _sort_files_chronologically(file_list: list[str]) -> list[str]:
    """Extract YYYYMMDDHHMM prefix, sort ascending. Non-timestamped files sort last."""
    import re
    def extract_ts(f):
        m = re.search(r'(\d{12})', f)
        return m.group(1) if m else "999999999999"
    return sorted(file_list, key=extract_ts)
```

---

### PILLAR 4 — World-Class Observability

**Goal:** Engineers can answer "what happened in last night's run?" in under 60 seconds, without writing SQL.

---

#### P4-A: `nb_platform_health.py` — Operational Health Dashboard *(new)*

Single-cell-run notebook that prints a complete operational snapshot:

**Sections:**
1. **Last Run Summary** — most recent pipeline run per PipelineID: start time, end time, duration, rows processed, status
2. **Error Log** — last 10 errors with ObjectName, EventType, ErrorMessage, timestamp
3. **Data Freshness** — per-object: watermark value, last processed timestamp, rows in Silver table
4. **Table Health** — row counts and last-modified times for all Silver Delta tables
5. **Connector Status** — last successful run per SourceName for JDBC/REST/File connectors
6. **Volume Trends** — rows processed per day for last 7 days (ASCII bar chart via `pandas`)

**Parameters:** `ControlLakehouse`, `DaysBack` (default 7), `PipelineFilter` (optional)

---

#### P4-B: `nb_data_quality_scorecard.py` — DQ Scorecard *(new)*

Per-object DQ metrics notebook:

| Metric | Description |
|---|---|
| Null rate | % null values per column, flagged if > threshold |
| Duplicate rate | Duplicate PKs in Silver (should be 0 for SCD tables) |
| Schema drift events | Count of schema changes in last 30 days from ControlLog |
| Cleansing rule hit rate | % rows where cleansing rules triggered |
| SCD2 churn rate | % rows where non-key hash changed (indicates upstream instability) |

**Output:** HTML table with RAG status per metric. Designed to be embedded in a Fabric Report.

---

#### P4-C: Platform Semantic Model *(new — Fabric item)*

A semantic model on top of `control.ControlLog` + `control.ObjectConfig` + `control.Watermarks` providing:
- Pipeline run history
- Object health over time
- Connector volume trends

This replaces ad-hoc SQL queries for operational monitoring. Template model definition stored in `SemanticModels/Platform_Control/`.

> Already partially present: `PBIR - Platform Control/` in the workspace — extend this.

---

#### P4-D: Structured logging enhancements to `nb_log_event.py`

Add two new fields to the `ControlLog` Delta table:
- `DurationSeconds` (BIGINT) — computed from pipeline start/end rather than per-event
- `SourceRowCount` / `SinkRowCount` — distinguish input vs output row counts for transformation quality tracking

Add `nb_log_event` call to nb_landing_to_bronze (currently not logged).

---

### PILLAR 5 — Connector Expansion

**Goal:** Match FMD's connector coverage. Add SharePoint as first-class the platform differentiator.

---

#### P5-A: `nb_conn_sftp.py` — SFTP + FTPS Connector *(new)*

Config-driven SFTP and FTPS file ingestion into Landing Lakehouse.

**Control table additions:** `ConnectionConfig.Protocol` ∈ `{SFTP, FTPS}`, `ConnectionConfig.Port`

**Implementation:** `paramiko` library for SFTP; stdlib `ftplib.FTP_TLS` for FTPS (no extra dependency).
`Protocol` column in `ConnectionConfig` routes to the correct transport. Both produce identical
Parquet landing output — same format as `nb_conn_file.py`.

**Parameters:** `PipelineRunId`, `SourceName`, `LandingLakehouse`, `KeyVaultUrl`

---

#### P5-B: `nb_conn_sharepoint.py` — SharePoint / OneDrive Connector *(new, covers TD-030)*

Graph API-based SharePoint list and document library ingestion.

**Auth:** Service Principal (client_credentials grant) with `Sites.Read.All` scope. Secret from KV.

**Modes:**
1. **List mode** — read SharePoint List items as tabular data → Parquet landing
2. **File mode** — download files from Document Library → Landing LH files zone

**Control table additions:** `IngestionConfig.SharePointSiteUrl`, `IngestionConfig.ListOrLibraryName`

---

#### P5-C: Oracle/SQLMI JDBC support *(enhancement to `nb_conn_jdbc.py`)*

JDBC connector already supports SQL Server. Extend driver handling:
```python
DRIVER_MAP = {
    "sqlserver": "com.microsoft.sqlserver.jdbc.SQLServerDriver",
    "oracle":    "oracle.jdbc.OracleDriver",      # ojdbc11.jar
    "sqlmi":     "com.microsoft.sqlserver.jdbc.SQLServerDriver",  # same driver, different URL format
    "mysql":     "com.mysql.cj.jdbc.Driver",
    "postgres":  "org.postgresql.Driver"
}
```

Add `ConnectionConfig.DriverType` column (migration guard in nb_bootstrap). Default `sqlserver` for backward compatibility.

**Spark resource profile note:** FMD April 2026 release added spark resource profiles for heavy JDBC loads. Add `ResourceProfile` column to `ObjectConfig` to allow per-object executor memory sizing.

---

#### P5-D: ADF / Synapse pipeline trigger *(deferred — backlog)*

`nb_conn_adf.py` — would trigger an ADF pipeline run and poll for completion before writing status
to ControlLog.

**Decision:** ADF is an edge-case for customers mid-migration. Target state is Fabric-native
pipelines. This item will not be implemented unless a specific customer requires a hybrid
ADF+Fabric topology. Removed from Sprint 15 scope.

---

### PILLAR 6 — Business Domain / Gold Layer

**Goal:** Enable domain-driven Gold layer development with scaffold-and-go tooling.

---

#### P6-A: `nb_domain_scaffold.py` — Gold Domain Wizard *(new)*

Guided notebook for creating a new business domain.

**Steps:**
```
Step 1: Domain Definition
  ├── Domain name (e.g. "HumanResources", "Finance", "Sales")
  ├── Source Silver tables to include
  └── Gold Lakehouse target (existing or new)

Step 2: Fact/Dimension Detection
  ├── Run nb_gold_candidate_detection on selected tables
  ├── Display detected fact/dimension candidates
  └── User confirms or overrides classification

Step 3: Scaffold Generation
  ├── Generate stub notebook: nb_gold_{domain}_{table}.py
  │   ├── Header/stage/description cells
  │   ├── Read from Silver section
  │   ├── Transform placeholder section
  │   └── Write to Gold section using write_gold() helper
  ├── Add new RunbookStep rows for generated notebooks
  └── Publish notebooks to Fabric workspace

Step 4: Semantic Model Stub
  └── Generate SemanticModels/{DomainName}/ folder with empty model definition
```

**Gold notebook template** (`templates/nb_gold_domain_table_template.py`):
```python
# title: nb_gold_{DOMAIN}_{TABLE}
# stage: Gold Layer — {Domain}
# description: {Table} transformation for {Domain} domain.

%%configure
# ... standard VL config ...

# COMMAND ----------
# %% [markdown]
# ## HOW IT WORKS
# Reads Silver.{table} → applies {classification} pattern → writes Gold.{table}

# COMMAND ----------
# %% [parameters]
PipelineRunId = ""
SilverLakehouse = ""
GoldLakehouse = ""

# COMMAND ----------
%run ./nb_utils_config

# COMMAND ----------
# --- Read Silver ---
df = spark.table(f"{silver_lh}.silver.{source_table}")

# --- TODO: Add business logic here ---

# --- Write Gold ---
write_gold(df, gold_lh=GoldLakehouse, table_name="{target_table}")
```

---

#### P6-B: Gold write helper `write_gold()` standardisation *(enhancement)*

Currently `write_gold()` is in `nb_utils_processing.py` but not consistently used by all Gold notebooks. Standardise:
- All Gold notebooks use `write_gold(df, gold_lh, table_name, write_mode="overwrite")`
- Add `write_mode` options: `overwrite` (full refresh), `merge` (incremental by PK), `append`
- Log row count to nb_log_event after write

---

#### P6-C: Multi-workspace Gold support *(design)*

For enterprise scenarios (separate Gold workspaces per domain, like FMD):
- Add `GoldWorkspaceId` to `ObjectConfig`
- `write_gold()` resolves the target LH across workspaces using sempy_labs `resolve_lakehouse_id(workspace_id=GoldWorkspaceId)`
- nb_domain_scaffold can target a different workspace

This is a design change — implement only if multi-workspace topology is required. Add as TD until needed.

---

### PILLAR 7 — Security & Identity

---

#### P7-A: Workspace Identity migration *(TD-032)*

Replace SPN-based auth with Workspace Identity for all Fabric-to-Fabric calls (JDBC to Fabric SQL DB, sempy_labs calls, KV access).

**Changes:**
1. nb_conn_jdbc: add `WorkspaceIdentity` auth option (no KV secret needed for Fabric SQL sources)
2. nb_env_setup: remove SPN credential fields when `AuthModel=WorkspaceIdentity`
3. nb_deploy_wizard Step 3: detect whether workspace has a managed identity, offer as default

---

#### P7-B: Least-privilege KV secret naming convention

Enforce a naming convention for KV secrets to enable Lakehouse-scoped access policies:
```
<client>-{env}-{source-name}-{credential-type}
# e.g. <client>-<env>-d365fo-jdbc-password
#      <client>-<env>-hibob-api-token
```

Document in [OPERATIONS.md](./OPERATIONS.md) and validate in nb_environment_validator.

---

### PILLAR 8 — Taskflow Integration

**Goal:** Replace Pipeline-orchestrated notebook chains with Fabric Taskflow where appropriate.

---

#### P8-A: Taskflow definitions for main pipelines *(new)*

Create `Taskflows/` directory with Taskflow item definitions for:

| Taskflow | Replaces |
|---|---|
| `TF_Daily_Platform_Refresh` | `10_Daily_Platform_Refresh` pipeline (nb_orchestrator chain) |
| `TF_Daily_Landing_Refresh` | `00_Daily_Landing_Refresh` (connector fan-out) |
| `TF_Gold_Runner` | `10_Gold_Runner` pipeline |
| `TF_Weekly_Optimise` | `Weekly_Optimise` pipeline |

Taskflow provides native Fabric UI for dependency visualisation — easier to debug than runMultiple DAGs.

**Note:** Taskflow and Pipeline approaches coexist; Taskflow is additive. Existing pipelines remain functional.

---

## Implementation Roadmap

### Phase 1 — Deployment Excellence *(target: 2 weeks)*

| Item | Notebook | Effort | Priority |
|---|---|---|---|
| Master deployment wizard | `nb_deploy_wizard.py` (new) | L | P0 |
| Pre-flight validator | `nb_environment_validator.py` (new) | M | P0 |
| Seed file per env pattern | `config/seed-{env}.json` + template | S | P0 |
| SCD2 bug fix | `nb_silver_transform.py` (TD-031) | S | P0 |
| Connection test notebook | `nb_connection_test.py` (new) | M | P1 |

---

### Phase 2 — Source Onboarding Wizard *(target: 2 weeks)*

| Item | Notebook | Effort | Priority |
|---|---|---|---|
| Source registration wizard | `nb_source_wizard.py` (new) | L | P0 |
| SQL schema introspection | `nb_jdbc_introspect.py` (new, TD-038) | M | P0 |
| Hash-based SCD2 detection | `nb_silver_transform.py` (TD-035) | M | P1 |
| Filename timestamp ordering | `nb_landing_to_bronze.py` (TD-037) | S | P1 |

---

### Phase 3 — Observability *(target: 1 week)*

| Item | Notebook | Effort | Priority |
|---|---|---|---|
| Platform health dashboard | `nb_platform_health.py` (new) | M | P0 |
| DQ scorecard | `nb_data_quality_scorecard.py` (new) | M | P1 |
| Platform semantic model | Extend `PBIR - Platform Control/` | M | P1 |
| Structured logging fields | `nb_log_event.py` + nb_bootstrap DDL | S | P1 |
| V-Order + CDF on Silver | `nb_silver_transform.py` (TD-036) | S | P2 |

---

### Phase 4 — Connector Expansion *(target: 2 weeks)*

| Item | Notebook | Effort | Priority |
|---|---|---|---|
| SharePoint connector | `nb_conn_sharepoint.py` (new, TD-030) | M | P1 |
| SFTP connector | `nb_conn_sftp.py` (new) | M | P1 |
| Oracle/SQLMI JDBC | `nb_conn_jdbc.py` (enhance) | S | P2 |
| Spark resource profiles | `nb_conn_jdbc.py` + `ObjectConfig` DDL | S | P2 |
| ADF trigger | `nb_conn_adf.py` (new) | M | P3 |

---

### Phase 5 — Gold Domain Framework *(target: 2 weeks)*

| Item | Notebook | Effort | Priority |
|---|---|---|---|
| Domain scaffold wizard | `nb_domain_scaffold.py` (new) | L | P1 |
| Gold notebook template | `templates/nb_gold_domain_table_template.py` (new) | S | P1 |
| `write_gold()` standardisation | `nb_utils_processing.py` (enhance) | S | P1 |

---

### Phase 6 — Security & Taskflow *(target: 1 week)*

| Item | Effort | Priority |
|---|---|---|
| Workspace Identity (TD-032) | M | P2 |
| KV secret naming convention | S | P2 |
| Taskflow definitions (4 flows) | M | P2 |
| Fabric CLI deploy script | M | P3 |

---

## New Notebook Inventory

All notebooks to be created. Each follows the standard source layout (header + `%%configure` + `%%configure` + stage cells).

| File | Title | Stage | Phase |
|---|---|---|---|
| `nb_deploy_wizard.py` | nb_deploy_wizard | Deployment | 1 |
| `nb_environment_validator.py` | nb_environment_validator | Deployment | 1 |
| `nb_connection_test.py` | nb_connection_test | Connectors | 1 |
| `nb_source_wizard.py` | nb_source_wizard | Connectors | 2 |
| `nb_jdbc_introspect.py` | nb_jdbc_introspect | Connectors | 2 |
| `nb_platform_health.py` | nb_platform_health | Observability | 3 |
| `nb_data_quality_scorecard.py` | nb_data_quality_scorecard | Observability | 3 |
| `nb_conn_sftp.py` | nb_conn_sftp | Connectors | 4 |
| `nb_conn_sharepoint.py` | nb_conn_sharepoint | Connectors | 4 |
| `nb_conn_adf.py` | nb_conn_adf | Connectors | 4 |
| `nb_domain_scaffold.py` | nb_domain_scaffold | Gold Layer | 5 |

---

## Control Table Changes Required

| Table | Change | Needed by |
|---|---|---|
| `control.ConnectionConfig` | Add `Protocol` (SFTP, SHAREPOINT, ADF), `Port` | P4 SFTP |
| `control.ConnectionConfig` | Add `DriverType` (sqlserver/oracle/postgres/mysql) | P4 JDBC |
| `control.ObjectConfig` | Add `HashedNonKeyColumns` (CSV string) | P3 TD-035 |
| `control.ObjectConfig` | Add `ResourceProfile` (small/medium/large) | P4 JDBC |
| `control.ObjectConfig` | Add `GoldWorkspaceId` (nullable) | P5 multi-workspace |
| `control.ControlLog` | Add `DurationSeconds`, `SourceRowCount`, `SinkRowCount` | P3 logging |
| `control.CleansingRules` | Add `NormalizeText`, `ColumnSplit`, `NullFill`, `DatetimeParse` rule types | P2 wizard |

All changes implemented as migration guards in nb_bootstrap (`ALTER TABLE IF NOT EXISTS COLUMN`).

---

## What Makes the platform Better Than FMD

| Dimension | FMD | the platform Target |
|---|---|---|
| **Control store** | SQL DB (external dependency, ODBC in notebooks) | Delta LH (zero extra dependency, Fabric-native) |
| **SCD strategies** | SCD2 only | SCD0/1/2/FACT-TXN/FACT-SNAPSHOT |
| **Deployment UX** | CLI + markdown guide (developer-only) | Guided wizard notebook (anyone can deploy) |
| **Source onboarding** | Manual metadata entry or bulk SQL tool | Wizard with live connection test + SQL introspection |
| **Dataverse** | Custom notebook pattern | Native `nb_conn_dataverse.py` |
| **Bronze auto-discovery** | Not present | `nb_catalog_sync.py` |
| **DQ scorecard** | Cleansing utilities (no scorecard) | DQ scorecard notebook |
| **Observability** | 3 audit tables (queryable) | Health dashboard + semantic model |
| **Fan-out pattern** | File grouping (complex) | FanOutSource:ObjectConfig (clean) |

---

## Tech Debt Summary (this plan addresses)

| TD | Title | Phase |
|---|---|---|
| TD-031 | SCD2 delete-reinsert bug | Phase 1 |
| TD-030 | SharePoint connector | Phase 4 |
| TD-032 | Workspace Identity migration | Phase 6 |
| TD-035 | Hash-based SCD2 detection | Phase 2 |
| TD-036 | V-Order + CDF on Silver tables | Phase 3 |
| TD-037 | Filename timestamp sequencing | Phase 2 |
| TD-038 | SQL source schema introspection | Phase 2 |
