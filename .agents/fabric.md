---
description: load fabric coding rules and golden templates for this session
---

# /fabric — Load Fabric Coding Rules

This workflow loads the platform Fabric Engineering Standards into the active session
context so that all subsequent Fabric code generation follows the correct patterns.

<!-- turbo-all -->

## Steps

1. Read the Fabric LLM Prompt Guide

```powershell
Get-Content "docs\fabric-llm-prompt-guide.md"
```

2. Confirm rules are loaded

Echo confirmation to the user that the Fabric rules are active for this session,
listing the most important ones as a quick reminder:

---

## 🏗️ Architecture — Medallion

- **Three lakehouses**: `lh_bronze`, `lh_silver`, `db_control`
- **Control LH** is always the default Lakehouse — set via `%%configure` using **Variable Library** (see below)
- Schema convention: `control.*`, `profiling.*`, `landing.*`, `quarantine.*`
- Gold tables live in `lh_gold` (not yet provisioned — pending business review session)

## 🗃️ Variable Library — Environment Config (TD-027)

> **GA confirmed** — Microsoft Fabric supports injecting Variable Library values directly into `%%configure`, including `defaultLakehouse`. Source: [official docs](https://learn.microsoft.com/fabric/data-engineering/author-execute-notebook#spark-session-configuration-magic-command)

The Variable Library (`Platform_Config`) is a **workspace-scoped** key-value store. DEV workspace holds `*` names; PROD holds `PROD_*`. Notebook source code is **identical** across environments.

> ⚠️ **Library name:** The item is `Platform_Config` — NOT `VL`. The `notebookutils.variableLibrary.get()` API requires **two arguments**: `get(libraryName, variableName)`.

### `%%configure` cell — default lakehouse via Variable Library

```json
%%configure
{
  "defaultLakehouse": {
    "name": { "variableName": "$(/**/Platform_Config/ControlLakehouse)" }
  }
}
```

- `Platform_Config` = name of the Variable Library item in the workspace
- **`id` is optional** — name alone is sufficient within the same workspace
- `workspaceId` only needed if the lakehouse is in a different workspace
- All variable values must be **String type** in the Variable Library

### `# %% [parameters]` cell — runtime Variable Library references

Two approaches — use `getLibrary()` when reading multiple variables:

```python
# %% [parameters]
# getLibrary() — clean pattern for reading multiple values from same library
try:
    _vl              = notebookutils.variableLibrary.getLibrary("Platform_Config")  # noqa: F821
    ControlLakehouse = _vl.ControlLakehouse
    BronzeLakehouse  = _vl.BronzeLakehouse
    SilverLakehouse  = _vl.SilverLakehouse
    WorkspaceId      = _vl.WorkspaceId
except NameError:
    # Local dev — notebookutils not available; use dev defaults
    ControlLakehouse = "db_control"
    BronzeLakehouse  = "lh_bronze"
    SilverLakehouse  = "lh_silver"
    WorkspaceId      = "1a801c80-fb8a-4e2f-8f0b-9d5336149427"
```

Or use `get()` for a single value — **must use full reference format**:

```python
# get() requires the full reference string: $(/**/LibraryName/VariableName)
ControlLakehouse = notebookutils.variableLibrary.get("$(/**/Platform_Config/ControlLakehouse)")
```

> ⚠️ `get("ControlLakehouse")` → `InvalidReferenceFormat`. The bare variable name is **not** a valid reference.
> ⚠️ `get("Platform_Config", "ControlLakehouse")` → `TypeError: takes 1 positional argument`. The API is single-arg only.

### Variable Library seeding — `nb_bootstrap`

`nb_bootstrap` seeds the Variable Library after `EnvironmentConfig` is written (non-fatal
if the `VL` item does not exist yet):

```python
_vl_values = {
    "ControlLakehouse": control_lh_arg,
    "BronzeLakehouse":  f"{env_prefix}_lh_bronze",
    "SilverLakehouse":  f"{env_prefix}_lh_silver",
    "WorkspaceId":      workspace_id or "",
}
try:
    _vl = notebookutils.variableLibrary
    for _key, _val in _vl_values.items():
        if _val:
            _vl.set("VL", _key, _val)
except Exception as _vl_err:
    print(f"WARN: Could not seed Variable Library VL — {_vl_err}")
```

### Code-first provisioning — `08b-provision-variable-library.ps1`

The Variable Library item can be **fully created and seeded via REST API** — no manual UI step
required. Run this once per workspace on initial provisioning:

```powershell
# Creates VL and pushes variables.json definition for the target environment
.\scripts\08b-provision-variable-library.ps1 -WorkspaceId "<workspace-guid>" -Env dev
```

The script:
- Creates the `VL` item if it does not exist
- Pushes `variables.json` with the correct `*_DEV_*` / `*_UAT_*` / `*_PROD_*` lakehouse names
- Polls the LRO `Operation-Location` until `Succeeded`
- Is idempotent — safe to re-run

See `docs/fabric-cicd-patterns.md` § 8 for full pattern documentation.

### Required `EnvironmentConfig` keys (add to `seed-dev.json`)

Name-only is sufficient — GUIDs are optional but listed here for reference (resolved 2026-03-15 via MCP).

| Key | Value (DEV) | GUID (optional, for reference) |
|---|---|---|
| `ControlLakehouse` | `db_control` | `ee6b15cf-8ef0-4276-b9e6-c4dba7ee7958` |
| `BronzeLakehouse` | `lh_bronze` | `ed58bb52-a59e-45a0-ad0c-39a07f3b51c0` |
| `SilverLakehouse` | `lh_silver` | `718517c4-1fc3-4199-b417-c2f1ff6b53c4` |
| `WorkspaceId` | `1a801c80-fb8a-4e2f-8f0b-9d5336149427` | — |


## 🔧 Fabric API / Notebook Rules

- Use `notebookutils` — never `dbutils`, never `mssparkutils.notebook`
- V-Order on every Delta write: `.option("parquet.vorder.enabled", "true")`
- Pipeline exit: `notebook.exit(json.dumps({...}))` — always JSON
- Pipeline JSON activity type: `"NotebookReference"` (not ADF `DatabricksNotebook`)
- No DML via JDBC against the SQL Analytics Endpoint — use `saveAsTable()`
- Notebooks deployed via `scripts/build_notebooks.py` (auto-discovers `src/notebooks/*.py`)
- **Build output paths:**
  - `workspace/notebooks/` — intermediate build artefacts (gitignored, staging area only)
  - `fabric_service/` — **Fabric Git-tracked path** (`directoryName: "/fabric_service"` in workspace git connection)
  - Notebooks live under `fabric_service/300_Notebooks/{layer}/nb_foo.Notebook/`
  - Always copy built notebooks to `fabric_service/` before committing:
    ```powershell
    py scripts/build_notebooks.py --force
    Copy-Item workspace\notebooks\nb_foo.Notebook\* fabric_service\300_Notebooks\330_Transform\nb_foo.Notebook\ -Force
    git add fabric_service/
    git commit -m "build: nb_foo → fabric_service"
    git push
    # Then in Fabric: Source Control → Updates → Update All
    ```
  - OR push directly via REST API with LRO polling (bypasses Git sync entirely):
    ```powershell
    $resp = Invoke-WebRequest -Uri ".../notebooks/{id}/updateDefinition" -Method POST ...
    $pollUrl = [string]($resp.Headers["Location"] | Select-Object -First 1)  # Headers are arrays!
    do { Start-Sleep 4; $r = Invoke-RestMethod $pollUrl ...; Write-Host $r.status } while ($r.status -notin "Succeeded","Failed")
    ```
- **Source-controlled notebooks:** use `.py` format only — clean Git diffs, Fabric Git sync compatible
- **Dynamically generated notebooks** (`nb_SQL_vw_*`): use `nbformat` + `.ipynb` BUT strip cell IDs:
  ```python
  nb = nbf.v4.new_notebook()
  for cell in nb.cells: cell.pop('id', None)  # Remove cell IDs — Fabric rejects nbformat 4.5 cell-ID validation
  payload_path = "notebook-content.ipynb"
  ```
- Pipeline JSON activity type: `"NotebookReference"` (not ADF `DatabricksNotebook`)
- No DML via JDBC against the SQL Analytics Endpoint — use `saveAsTable()`
- **`# %% [markdown]` cells work in `.py` source** — the build script hoists them before `%%configure`
  automatically.
- **Canonical `.py` source format** — every content line MUST have a `# ` prefix:
  ```python
  # %% [markdown]
  # ## Section Heading
  # Body text with **bold** and `code` works fine.
  # Another line.
  ```
  Lines that lack the `# ` prefix are treated as Python code and silently dropped from the
  rendered markdown cell — the heading disappears but no error is raised.
- **Do NOT use em dashes (`—`), backticks, or block-quotes inside markdown cell content** — these
  can trigger `PyToIPynbFailure` on cell conversion. Use plain ASCII dashes (`-` or `–`) instead.
- **Canonical MARKDOWN cell format** (discovered from `NM_Markdown` reference notebook):
  ```
  # MARKDOWN ********************
                                    <- blank line after marker (required)
  # content lines
  
                                    <- TWO trailing blank lines (required)
  ```
- **`%run` magic must be alone in its cell** — no trailing comments, no adjacent code in the same `# %%` block.
- **Magic cells (`%run`, `%%configure`) must NOT carry `"tags": ["parameters"]`** in their METADATA.
  The build script guards this via the `is_magic` check.
- **LRO error detail is now surfaced in `publish_notebooks.ps1`** — failures show `errorCode`
  (e.g. `PyToIPynbFailure`) and message in red rather than just `LRO: Failed`.

## 📦 Fabric Item Definition Architecture (Notebook Deployment)

Fabric has **two distinct notebook formats** — understanding which to use is critical:

| Scenario | Format | Path in `parts[]` | Notes |
|---|---|---|---|
| **Git sync** (source of truth) | `.py` source | `notebook-content.py` | What `build_notebooks.py` generates |
| **REST API `updateDefinition`** | `.py` source | `notebook-content.py` | Works for existing items — Fabric accepts both |
| **REST API `createItem`** (new) | `.ipynb` JSON | `notebook-content.ipynb` | Official Item Definition format |

### Papermill Parameter Cells (Fabric standard)

Fabric uses the **Papermill** standard for notebook parameterisation. Papermill is an **open-source Python library** maintained by the [nteract](https://github.com/nteract) community.

**Official Resources:**
- **Documentation:** [papermill.readthedocs.io](https://papermill.readthedocs.io/)
- **GitHub Repository:** [github.com/nteract/papermill](https://github.com/nteract/papermill)
- **Parameterization Spec:** [papermill.readthedocs.io/en/latest/usage-parameterize.html](https://papermill.readthedocs.io/en/latest/usage-parameterize.html)

**The Papermill rules:**

- One cell must carry `"tags": ["parameters"]` in its metadata
- That cell contains the **default values** — it's a regular code cell
- At pipeline runtime, Fabric **injects an override cell immediately after** the tagged cell
- The tagged cell is NOT replaced — defaults remain visible in the notebook

**Local testing with Papermill:**

You can install Papermill locally to test parameter injection before deploying to Fabric:

```bash
# Install
pip install papermill

# CLI usage — inject parameters and execute
papermill local_notebook.ipynb output_notebook.ipynb \
  -p BronzeLakehouse "lh_bronze" \
  -p PipelineRunId "test-run-001"

# Python API usage — programmatic execution
import papermill as pm

pm.execute_notebook(
   'nb_bronze_to_silver.ipynb',
   'output_notebook.ipynb',
   parameters=dict(
       BronzeLakehouse='lh_bronze',
       SilverLakehouse='lh_silver',
       PipelineRunId='test-run-001'
   )
)
```

When run locally, Papermill generates an `output_notebook.ipynb` file showing the execution results and the injected parameter cell. **In Fabric, the Spark backend runs a managed version of `pm.execute_notebook()` when you trigger a notebook via Pipeline**, capturing outputs and displaying them in run history.

**In our `.py` source format** this is expressed as:

```
# %% [parameters]
BronzeLakehouse  = "lh_bronze"
ControlLakehouse = "db_control"
PipelineRunId    = ""
```

The build script (`build_notebooks.py`) detects `# %% [parameters]` and emits:

```
# META   "tags": ["parameters"]
```

on that cell — NOT on the inlined `nb_utils_config` utility cell.

#### Detailed JSON Structure (for code-first notebook generation)

When programmatically constructing a notebook's `.ipynb` JSON payload, the parameter cell must have this exact structure:

```json
{
  "cell_type": "code",
  "metadata": {
    "tags": [
      "parameters"
    ]
  },
  "source": [
    "# Default values (Fabric will override these at runtime)\n",
    "BronzeLakehouse = 'lh_bronze'\n",
    "SilverLakehouse = 'lh_silver'\n",
    "ControlLakehouse = 'db_control'\n",
    "PipelineRunId = ''"
  ],
  "outputs": [],
  "execution_count": null
}
```

**How the override mechanism works:**

1. **The Tag:** `"tags": ["parameters"]` signals to Fabric that this cell contains baseline configuration
2. **The Override:** When triggered via Data Pipeline or Execution API with runtime parameters, Fabric automatically generates a **new, hidden cell** containing the injected runtime variables
3. **Placement:** The injected cell is placed **immediately after** the tagged cell
4. **Execution:** Because notebooks run top-to-bottom, the injected cell executes second, overwriting the default variables with live values from the API/Pipeline

**Base64 encoding for API publishing:**

When publishing via Fabric **Create Item** REST API, encode the complete `.ipynb` JSON to Base64:

```json
{
  "displayName": "MyParameterizedNotebook",
  "type": "Notebook",
  "definition": {
    "format": "ipynb",
    "parts": [
      {
        "path": "notebook-content.ipynb",
        "payload": "<BASE64_ENCODED_IPYnb_STRING_HERE>",
        "payloadType": "InlineBase64"
      }
    ]
  }
}
```

> ⚠️ **Best Practice:** Always define default values in your parameter cell's `source` array. If you leave it blank, code-first notebooks will fail when run manually from Fabric UI without pipeline parameters.

### REST API Create Pattern (`.ipynb` format)

When creating a **net-new** notebook via API (no existing item ID), use `ipynb` format:

```python
payload = {
    "displayName": "nb_foo",
    "type": "Notebook",
    "definition": {
        "format": "ipynb",
        "parts": [
            {"path": "notebook-content.ipynb", "payload": "<base64_ipynb>", "payloadType": "InlineBase64"},
            {"path": ".platform",              "payload": "<base64_platform>", "payloadType": "InlineBase64"}
        ]
    }
}
```

The `.platform` file binds the default Lakehouse at creation time — no manual UI step needed.

> ✅ **TD-016 RESOLVED (2026-03-11):** Use `scripts/deploy_notebook_ipynb.py` instead of
> `publish_notebooks.ps1` for all notebooks that use pipeline parameter injection.
> This script sends `.ipynb` format which preserves `{"tags": ["parameters"]}` cell metadata
> through the `updateDefinition` API. The parser bug (`_parse_built_notebook` back-patch)
> and the parameters cell hoisting in `build_notebooks.py` are also fixed.
>
> **Deploy command:**
> ```powershell
> py scripts/build_notebooks.py --force
> & "C:\Users\scottm\AppData\Local\Programs\Python\Python311\python.exe" `
>     scripts/deploy_notebook_ipynb.py --notebooks nb_bronze_to_silver
> ```
>
> `publish_notebooks.ps1` remains valid for notebooks **without** parameter injection.

### Notebook Validation (Code-First CI/CD)

When programmatically generating `.ipynb` notebooks for Fabric, validate the JSON structure, parameter tags, and Python code **before** pushing to the API. This prevents deployment failures and catches errors early.

**Best-practice validation sequence:**

1. Generate the `.ipynb` JSON
2. Run `nbformat.validate()` — ensures JSON won't break Fabric
3. Run `papermill.inspect_notebook()` — verifies parameter cell is tagged correctly
4. Run `ruff check` — ensures no broken Python code
5. Base64 encode and push to Fabric API

#### 1. Validating Papermill Parameters (`papermill --inspect`)

Papermill has a built-in inspector that scans the JSON structure, finds the tagged cell, and returns the parameters it discovered.

**CLI usage:**
```bash
papermill --inspect your_notebook.ipynb
# Prints parameter dictionary if tag found; empty if missing/malformed
```

**Python API (for CI/CD pipelines):**
```python
import papermill as pm

# Returns dictionary of inferred parameters
params = pm.inspect_notebook('your_notebook.ipynb')
print(params)
# Example output: {'BronzeLakehouse': 'lh_bronze', 'PipelineRunId': ''}
```

#### 2. Validating Notebook JSON Schema (`nbformat`)

The official Jupyter `nbformat` library validates `.ipynb` JSON against the schema Fabric uses to render notebooks. Catches missing required keys or malformed structure.

```bash
pip install nbformat
```

```python
import nbformat
from nbformat.validator import NotebookValidationError

# Load your generated notebook JSON
with open('your_generated_notebook.ipynb', 'r') as f:
    nb = nbformat.read(f, as_version=4)

try:
    # Validates against official Jupyter schema
    nbformat.validate(nb)
    print("✅ Notebook JSON is valid!")
except NotebookValidationError as e:
    print(f"❌ Schema violation: {e}")
```

#### 3. Linting Python Code Inside Cells (`ruff`)

**Ruff (recommended)** — modern, blazing-fast linter written in Rust with native `.ipynb` support:

```bash
pip install ruff

# Find syntax/linting errors in notebook cells
ruff check your_notebook.ipynb

# Auto-format code inside JSON
ruff format your_notebook.ipynb
```

**nbQA (legacy)** — bridge for traditional linters (`flake8`, `black`, `pylint`):

```bash
pip install nbqa flake8
nbqa flake8 your_notebook.ipynb
```

#### Example: Complete Validation Pipeline

```python
import nbformat
import papermill as pm
import subprocess

def validate_notebook(path: str) -> bool:
    """Validate notebook before pushing to Fabric API."""
    try:
        # 1. JSON schema validation
        with open(path, 'r') as f:
            nb = nbformat.read(f, as_version=4)
        nbformat.validate(nb)
        print(f"✅ {path}: Valid JSON schema")
        
        # 2. Parameter tag validation
        params = pm.inspect_notebook(path)
        if not params:
            print(f"⚠️  {path}: No parameters cell found")
        else:
            print(f"✅ {path}: Parameters detected: {list(params.keys())}")
        
        # 3. Python linting
        result = subprocess.run(['ruff', 'check', path], capture_output=True)
        if result.returncode != 0:
            print(f"❌ {path}: Ruff found issues:\n{result.stdout.decode()}")
            return False
        print(f"✅ {path}: Python code is clean")
        
        return True
    except Exception as e:
        print(f"❌ {path}: Validation failed: {e}")
        return False

# Usage in CI/CD
if validate_notebook('workspace/notebooks/nb_foo.Notebook/notebook-content.ipynb'):
    # Safe to encode and push to Fabric
    pass
```


## ⚡ Spark Session Config — `apply_layer_spark_config()`

Always call `apply_layer_spark_config(spark, "SILVER"|"GOLD"|"BRONZE", {})` once per notebook.
This sets all the following (defined in `nb_utils_config.py`):

```python
# All layers — set by apply_layer_spark_config()
spark.conf.set("spark.databricks.delta.optimizeWrite.enabled", "true")

# Ancient datetime fix (D365 F&O mserp_* tables contain 1753-01-01, 1900-01-01 sentinel dates)
# CORRECTED = write as-is; safe because all our readers are Spark 3+ / Fabric only
spark.conf.set("spark.sql.parquet.datetimeRebaseModeInWrite", "CORRECTED")
spark.conf.set("spark.sql.parquet.datetimeRebaseModeInRead",  "CORRECTED")
spark.conf.set("spark.sql.avro.datetimeRebaseModeInWrite",    "CORRECTED")
spark.conf.set("spark.sql.avro.datetimeRebaseModeInRead",     "CORRECTED")

# Silver + Gold only
spark.conf.set("spark.databricks.delta.autoCompact.enabled", "true")
spark.conf.set("spark.microsoft.delta.merge.lowShuffle.enabled", "true")
```

> ⚠️ **Do NOT set `datetimeRebaseModeInWrite = LEGACY`** — this shifts dates and produces
> wrong values for D365 sentinel dates. Always use `CORRECTED`.

## 🗃️ Control Tables — Schemas

### `control.ObjectConfig`
Primary source of truth for all managed tables (Bronze → Silver).
Key columns: `ObjectName`, `NaturalKeyColumns`, `SilverSchema`, `CleansingRules`,
`RequiresMasking`, `SCDType`, `FactTableType`, `SourceSystem`

### `control.ViewScript`
Holds SQL definitions for Silver views and generated notebooks.
Extended columns (added via migration guard in `nb_bootstrap`):
`ExecutionModeOverride`, `SchemaHash`, `DriftDetected`, `LastGenerated`

### `control.GoldObject`
Candidate dim/fact stubs detected by `nb_gold_candidate_detection`.
Key columns: `ObjectID`, `SourceTable`, `ObjectName`, `ObjectType` (dim/fact),
`FactType`, `SCDType`, `BusinessLogicStatus` (pending/review/confirmed), `IsActive`

> Gold notebooks are **only generated** after `BusinessLogicStatus = 'confirmed'` and `IsActive = True`.
> Never generate Gold SQL from a `pending` row.

### `control.GoldRelationship`
FK graph — fact → dim links.
Key columns: `RelationshipID`, `FactObjectID`, `DimObjectID`,
`FactFKColumn`, `DimSKColumn`, `RelationshipType`, `IsConfirmed`

### `profiling.ColumnStats` / `profiling.KeyCandidates` / `profiling.Relationships`
Bronze profiling output — used by `nb_gold_candidate_detection` to enrich heuristics.

## 🔒 Migration Guard Pattern (`nb_bootstrap`)

When adding columns to existing Delta tables, always use the idempotent helper:

```python
def _add_column_if_missing(spark, table_fqn: str, col_name: str, col_type: str):
    """Add a column to an existing Delta table only if it is not already present."""
    try:
        existing = {f.name for f in spark.table(table_fqn).schema.fields}
        if col_name not in existing:
            spark.sql(f"ALTER TABLE {table_fqn} ADD COLUMNS ({col_name} {col_type})")
            print(f"  [MIGRATE] Added {col_name} ({col_type}) to {table_fqn}")
        else:
            print(f"  [SKIP]    {col_name} already exists in {table_fqn}")
    except Exception as e:
        print(f"  [WARN]    Could not add {col_name} to {table_fqn}: {e}")
```

## 📓 Notebook Inventory

| Notebook | Stage | Status |
|---|---|---|
| `nb_bootstrap` | Infrastructure | ✅ Live — creates all control + profiling tables; seeds from `Files/config/seed-dev.json` |
| `nb_orchestrator` | Orchestration | ✅ Live — DAG via `runMultiple()`, reads `control.RunbookStep`, 600s cell timeout |
| `nb_seed_control_lh` | Infrastructure | ✅ Live — seeds ObjectConfig/ShortcutConfig from legacy SQL DB; RunbookConfig via direct INSERT |
| `nb_landing_to_bronze` | Bronze | ✅ Live |
| `nb_bronze_to_silver` | Silver | ✅ Live — SCD-1 MERGE + soft-delete |
| `nb_view_seeder` | Silver / Bronze | ✅ Live — layer-aware (SILVER \| BRONZE); discovers tables, generates `vw_*` passthrough views with delete filter, registers in `control.ViewScript` (MERGE, idempotent). Domain grouping and SQL notebook publishing removed — owned by `nb_notebook_generator`. |
| `nb_catalog_sync` | Control | ✅ Live — syncs `ObjectConfig` from Dataverse |
| `nb_conn_shortcut` | Connectors | ✅ Live — interactive UI notebook. Section 1: `EnvConfigEditor` CRUD widget for `env_variables.json`. Section 2: `D365TableEditor` CRUD grid for `D365_table_list.csv` (auto-loads on Run All, add/edit/delete rows, Import CSV). Section 3: Spark execution — resolves GUIDs, creates shortcuts, writes ControlLog. Section 4: `explore_dataverse_entities()` diagnostic helper (on-demand only). |
| `nb_conn_jdbc` | Connectors | ✅ Live |
| `nb_conn_rest` | Connectors | ✅ Live |
| `nb_conn_file` | Connectors | ✅ Live |
| `nb_gold_candidate_detection` | Gold Discovery | ✅ Built — awaiting first run post-Bootstrap |
| `nb_flush_log_queue` | Control | ✅ Live — reads `Files/log_queue/{run_id}/` JSON files written by parallel nb_bronze_to_silver sessions; bulk-INSERTs into ControlLog in one transaction. Runs after ForEach in 00_Daily_Ingestion_Pipeline (TD-015). |
| `nb_notebook_generator` | Silver Automation | ✅ Live — Variable Library + schema drift + Fabric REST publish (`.py` format; TD-004: migrate to `nbformat`) |
| `nb_gold_generator` | Gold Build | 🔲 Priority 3 — needs business review first |
| `nb_deregister_functions` | Maintenance | ✅ Live — business logic for deregistering objects (preview, archive, drop). Loaded at runtime by `nb_deregister_object` via `%run`. |
| `nb_deregister_object` | Maintenance | ✅ Live — UI shell only (4 cells: `%%configure`, `%run nb_deregister_functions`, params, dispatch). Filterable picker with auto-refresh after live execute. Source list unions ObjectConfig + Bronze + Silver tables. |

## 🐛 Known D365 Data Quirks

| Issue | Cause | Fix |
|---|---|---|
| `WRITE_ANCIENT_DATETIME` | `mserp_*` tables contain `1753-01-01` / `1900-01-01` sentinel dates | `datetimeRebaseModeInWrite = CORRECTED` in `apply_layer_spark_config()` |
| `DELTA_MERGE_UNRESOLVED_EXPRESSION` on `_updated_at` | Silver table written before audit columns existed | Migration guard in `merge_scd1_soft_delete()` adds missing cols via `ALTER TABLE` |
| `DELTA_CONFLICT_SET_COLUMN` on `_updated_at` | `_updated_at` appeared in both business col loop AND explicit audit SET clause | Fixed: explicit disjoint split — `business_cols` excludes all audit cols |
| `No natural key detected — SCD-0 overwrite` | Table has no `*id` / `*_key` column pattern | Add `NaturalKeyColumns` to `ObjectConfig` for the affected table |
| `LRO:Failed` on notebook createItem | Sent `notebook-content.ipynb` with nbformat 4.5 cell IDs — Fabric rejects `cell_id` field | For generated notebooks: strip cell IDs after build (`for cell in nb.cells: cell.pop('id', None)`). For source-controlled notebooks: always use `notebook-content.py` format. |
| `LRO:Failed` on createItem with SQL cells | Used `"language": "sql"` in cell METADATA block | Fabric CI/CD format rejects SQL-language cells. Use Python cells with `spark.sql(DDL)` instead. |
| `LRO:Failed` with `PyToIPynbFailure` | Source `.py` contains a `# %% [markdown]` cell where content lines are missing the `# ` prefix, OR contains em dashes / backticks / blockquotes | **Fix:** ensure every content line inside a `# %% [markdown]` block starts with `# `. Lines without the prefix are treated as Python, causing the converter to fail. Avoid em dashes (`—`) — use plain `-` or `–`. |
| `LRO:Failed` with `PyToIPynbFailure` — parameters tag on magic cell | Build script tagged a `%run` or `%%configure` cell as `"parameters"` | Fixed: `is_magic` check in `build_notebooks.py` skips magic cells when assigning the parameters tag. |
| `No active RunbookSteps found for PipelineID=X` | `seed-dev.json` not uploaded to OneLake before nb_bootstrap ran; bootstrap `mode("overwrite")` wiped rows seeded by nb_seed_control_lh | Run `publish_notebooks.ps1 -UploadSeed` then re-run nb_bootstrap. Add all runbook rows to `seed-dev.json` — it is the single source of truth. |
| `RowsProcessed column cannot be resolved` in ControlLog INSERT | nb_seed_control_lh seeded ControlLog from legacy SQL DB with `overwriteSchema=True`, reverting to 5-column schema | Remove ControlLog from JDBC seed — it is an operational log whose schema is owned by nb_bootstrap (`CREATE OR REPLACE TABLE`). |
| `runMultiple` timeout after 90s | Default `timeoutPerCellInSeconds=90` too short for notebooks that call Fabric REST API | Set `timeoutPerCellInSeconds=600` in `build_dag()` or via `TimeoutPerCellSeconds` in `control.RunbookStep`. |
| `ModuleNotFoundError: No module named 'nb_utils_publish'` | build script inlines utility but doesn't strip the sentinel `from nb_utils_publish import ...` line | Fixed in `build_notebooks.py`: `_strip_publish_import()` removes the line for notebooks where utility is inlined. |
| `_coerce_row` fails on seed-dev.json rows with extra keys (`_comment`, `Description`) | Dict iteration hits unknown keys not in table schema | Fixed: `_coerce_row` now iterates schema fields (not row keys) — missing → None, extra → ignored. |
| `ConcurrentAppendException` on ControlLog during parallel ForEach | Fabric enforces Serializable isolation; concurrent `log_execution_end` UPDATEs conflict with blind INSERTs from other sessions | **TD-015 fix:** each nb_bronze_to_silver session writes a JSON file to `Files/log_queue/{run_id}/` (no Delta, no conflicts). nb_flush_log_queue runs after ForEach and bulk-INSERTs all queue files in one transaction. `_safe_log_start`/`_safe_log_end` wrappers make all ControlLog writes non-fatal as defensive fallback. |
| Fabric Git sync blocked by `MissingDependency` for `02_REST_Connector`/`03_File_Connector` | These pipelines reference notebook IDs that no longer exist in the workspace | Pre-existing issue unrelated to our notebooks. Use `updateDefinition` REST API or manually update individual notebooks. Does NOT block nb_bronze_to_silver or pipeline updates. |

## 📐 Build Order (Current)

```
Runbook 40 — Platform (nb_orchestrator PipelineID=40)
  Step 401 → nb_view_seeder        parallel   600s timeout
  Step 402 → nb_notebook_generator after: nb_view_seeder  600s timeout
  Step 403 → nb_catalog_sync       after: nb_view_seeder  600s timeout

Priority 1  ✅ DONE
├── ✅ nb_bootstrap              — GoldObject, GoldRelationship, profiling schema, ViewScript migration
├── ✅ nb_orchestrator           — DAG via runMultiple(), seeds from control.RunbookStep
├── ✅ nb_view_seeder            — Silver table discovery, view DDL, ViewScript population
├── ✅ nb_notebook_generator    — Variable Library + schema drift detection + Fabric REST publish
└── ✅ nb_gold_candidate_detection — ported + schema-aligned

Priority 2  (CI/CD — can run in parallel)
├── 🔲 scripts/validate_parameters.py
├── 🔲 scripts/smoke_test_pipeline.py
├── 🔲 workspace/azure-pipelines.yml
└── 🔲 TD-0## 🚀 Publish Workflow

```powershell
# 1. Build source notebooks → workspace/ intermediate artefacts
$env:PYTHONPATH = ".;src"
py scripts/build_notebooks.py --force

# 2. Copy to Fabric Git-tracked path and push
Copy-Item workspace\notebooks\nb_foo.Notebook\* fabric_service\300_Notebooks\330_Transform\nb_foo.Notebook\ -Force
$git = "C:\Users\scottm\AppData\Local\Programs\Git\bin\git.exe"
& $git add fabric_service/
& $git commit -m "build: nb_foo → fabric_service"
& $git push
# Then in Fabric: Source Control → Updates → Update All

# --- OR: bypass Git sync, push directly via REST API (instant) ---
$token = (az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv)
$ws    = "1a801c80-fb8a-4e2f-8f0b-9d5336149427"
$nbId  = "3d46e725-734c-43b3-8705-75b46f188784"   # nb_bronze_to_silver — look up others via GET /notebooks
$content  = Get-Content "workspace\notebooks\nb_foo.Notebook\notebook-content.py" -Raw -Encoding UTF8
$platform = Get-Content "workspace\notebooks\nb_foo.Notebook\.platform"           -Raw -Encoding UTF8
$body = @{ definition = @{ parts = @(
    @{ path="notebook-content.py"; payload=[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content));  payloadType="InlineBase64" }
    @{ path=".platform";           payload=[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($platform)); payloadType="InlineBase64" }
)}} | ConvertTo-Json -Depth 5
$resp    = Invoke-WebRequest -Uri "https://api.fabric.microsoft.com/v1/workspaces/$ws/notebooks/$nbId/updateDefinition" `
    -Method POST -Headers @{ Authorization="Bearer $token"; "Content-Type"="application/json" } -Body $body
$pollUrl = [string]($resp.Headers["Location"] | Select-Object -First 1)   # Headers["Location"] is an array!
do { Start-Sleep 4; $r = Invoke-RestMethod $pollUrl -Headers @{ Authorization="Bearer $token" }
     Write-Host $r.status } while ($r.status -notin "Succeeded","Failed","Cancelled")

# 3. Seed upload (if config changed)
# .\scripts\publish_notebooks.ps1 -UploadSeed

# 4. Re-run nb_bootstrap in Fabric to apply seed-dev.json changes
# 5. Run nb_orchestrator with _pipeline_id = 40
```

> ⚠️ **Two output paths exist — know which one matters:**
> - `workspace/notebooks/` — **gitignored** — staging area only (REST API source)
> - `fabric_service/` — **Git-tracked** — Fabric reads from here on `Update All`
>
> `directoryName` in the workspace Git connection = `/fabric_service`
> Always commit notebook changes to `fabric_service/` for Fabric Source Control to pick them up.

> **seed-dev.json**: source of truth in `config/seed-dev.json`.
> Must be uploaded to `db_control/Files/config/` before nb_bootstrap runs.
> Use `-UploadSeed` flag to do this automatically.

## 🔐 Dataverse Workspace Permissions (<client>-<env> SPA)

Notebooks accessing `dmo_*` Bronze tables follow OneLake shortcuts into the
Dataverse-managed lakehouse. The SPA must be registered in the **Power Platform
Admin Centre → Dataverse environment → Application Users** with the following
roles to avoid `403 AccessDeniedException` on `_delta_log` reads.

| Property | Value |
|---|---|
| **Entra ID App Name** | `<client>-<env>` |
| **App ID (Client ID)** | `308f7497-fbe5-4f5f-aa60-707ec88c6725` |
| **State** | Active |
| **Dataverse Org** | `org9eaa614e` |

### Required Security Roles (6)

| Role | Type | Business Unit |
|---|---|---|
| Basic User | Direct | org9eaa614e |
| DataLakeWorkspaceAppAccess | Direct | org9eaa614e |
| Dataverse Search Role | Direct | org9eaa614e |
| DV-MetadataService-Role | Direct | org9eaa614e |
| Service Reader | Direct | org9eaa614e |
| Synapse Link Service Access | Direct | org9eaa614e |

> ⚠️ **Without `DataLakeWorkspaceAppAccess` + `Synapse Link Service Access`**, Spark
> receives a `403 Forbidden` when resolving `_delta_log` for any Dataverse shortcut
> table in `lh_bronze`. This causes the object to be logged as `FAILED` in
> the queue file and the notebook to raise a `RuntimeError` (pipeline marks activity
> as **Failed**).
>
> **To re-apply:** Power Platform Admin Centre → Environments → the platform Dev →
> Settings → Users + Permissions → Application Users → select `<client>-<env>` →
> Edit security roles.
