# Prompt: Wire HiBob (Bob HR) into the REST connector

## Context

Peggy already ships a generic, config-driven REST ingestion notebook at
`src/notebooks/nb_conn_rest.py`. It reads connection metadata from
`control.IngestionSource` / `control.ConnectionConfig` / `control.IngestionConfig`,
resolves a secret from Key Vault, paginates (`CURSOR` / `OFFSET` / `LINK_HEADER` /
`SINGLE`), and lands raw JSON as Parquet under
`Files/{source}/{entity}/YYYY/MM/DD/{yyyyMMdd_HHmmss}/`.

Goal: add **HiBob** (`https://apidocs.hibob.com/`) as a new REST source that
pulls employees into Landing → Bronze on the daily schedule, with zero new
notebooks and the minimum code change to the connector.

Working branch: `claude/hibob-api-setup-WgSHk`.

---

## HiBob API facts (verify against https://apidocs.hibob.com/)

| Item | Value |
|---|---|
| Production base URL | `https://api.hibob.com/v1` |
| Sandbox base URL | Same host — HiBob issues a **separate sandbox tenant** to paying customers via their CSM. No public/anonymous test API exists. Service User credentials are per-tenant, so sandbox gets its own ID/token pair. |
| Auth scheme | **HTTP Basic** — NOT Bearer. Header: `Authorization: Basic <base64(ServiceUserId:Token)>` |
| Service User creation | Bob admin console → Integrations → Service Users. Issues a `Service User ID` (looks like an email-ish string) and a `Token` (opaque secret). Both required; treat both as secret. |
| Primary endpoint | `GET /v1/profiles` → returns all active employees in one response, no pagination. Response envelope: `{"employees": [ ... ]}`. Rate limit: 40 req/min. |
| Alternative endpoints | `POST /v1/people/search` (50 req/min, filter body, supports cursor pagination). **Out of scope for v1** — stick with GET /v1/profiles. |
| Custom tables | `GET /v1/people/{employeeId}/custom-tables/{tableId}` — N+1 per employee. **Out of scope.** |
| Rate limit | Primary endpoint: 40 req/min per Service User. Daily `/v1/profiles` is 1 request, so well under the cap. |
| Webhooks | Real-time events (new hire, termination). **Out of scope** — separate notebook, different runtime model. |

> Anything above that you cannot confirm from the HiBob docs, flag in the PR
> description rather than silently shipping.

---

## Change set

### 1. `src/notebooks/nb_conn_rest.py` — add `BASIC` auth mode

Current `fetch_page` hardcodes `Authorization: Bearer {api_key}` at line ~52.
Extend to branch on an `AuthMode` read from the connection config.

Storage convention: when `AuthMode = "BASIC"`, the Key Vault secret holds the
credential pair as a single string `"ServiceUserId:Token"`. Split on the first
colon and pass to `requests.auth.HTTPBasicAuth`. This keeps Peggy's
one-secret-per-source convention.

```python
# nb_conn_rest.py — replace fetch_page + thread auth_mode through paginate()

from requests.auth import HTTPBasicAuth

def fetch_page(url: str, api_key: str, params: dict | None = None,
               auth_mode: str = "BEARER") -> requests.Response:
    """GET a single page, raising on non-2xx.

    auth_mode:
      BEARER (default)  – sends 'Authorization: Bearer {api_key}'
      BASIC             – splits api_key on ':' → HTTPBasicAuth(user, token)
      NONE / empty key  – no auth header (anonymous, e.g. Mockerito)
    """
    headers = {"Accept": "application/json"}
    auth = None
    mode = (auth_mode or "BEARER").upper()

    if api_key and mode == "BEARER":
        headers["Authorization"] = f"Bearer {api_key}"
    elif api_key and mode == "BASIC":
        user, _, token = api_key.partition(":")
        if not token:
            raise ValueError(
                "BASIC auth expects secret formatted as 'ServiceUserId:Token'"
            )
        auth = HTTPBasicAuth(user, token)
    # mode == "NONE" or empty api_key → send no auth

    response = requests.get(url, headers=headers, params=params or {}, auth=auth)
    response.raise_for_status()
    return response
```

Then thread `auth_mode` through `paginate()` (read from `conn.get("AuthMode", "BEARER")`)
and through `run_rest_ingestion()` (read from `conn_cfg`). Only those three call sites
change — keep the signature of `ingest_rest_source` backwards-compatible by
reading auth mode from `conn` rather than adding a parameter.

### 2. `tests/test_nb_conn_rest.py` — add BASIC auth coverage

Add to `TestFetchPage`:

```python
@patch('nb_conn_rest.requests.get')
def test_sends_basic_auth_when_mode_basic(self, mock_get):
    mock_get.return_value = _resp(200, {"value": []})
    nb_conn_rest.fetch_page(
        "https://api.hibob.com/v1/people",
        "svc-user-id:opaque-token",
        auth_mode="BASIC",
    )
    call_kwargs = mock_get.call_args[1]
    self.assertIsNotNone(call_kwargs.get("auth"))
    # No Bearer header should be set under BASIC
    self.assertNotIn("Authorization", call_kwargs["headers"])

@patch('nb_conn_rest.requests.get')
def test_basic_auth_rejects_unseparated_secret(self, mock_get):
    with self.assertRaises(ValueError):
        nb_conn_rest.fetch_page(
            "https://api.hibob.com/v1/people",
            "missing-colon-token",
            auth_mode="BASIC",
        )
```

Update `_conn_config(...)` helper to accept an `auth_mode="BEARER"` kwarg and
include `"AuthMode": auth_mode` in the returned dict so the new code path is
exercised in an end-to-end `TestIngestRestSource` case too.

### 3. `control.ConnectionConfig` schema — add `AuthMode` column

Two files carry this schema and must stay in sync:

**`fab-dev/200_Storage/z_arch/db_control.SQLDatabase/control/Tables/ConnectionConfig.sql`**

```sql
ALTER TABLE [control].[ConnectionConfig]
    ADD [AuthMode] NVARCHAR (20) NULL;
```

(or edit the `CREATE TABLE` DDL directly if the DB is re-provisioned from scratch).

**`src/notebooks/nb_bootstrap.py`** — update the `CREATE TABLE IF NOT EXISTS control.ConnectionConfig` DDL around line 121:

```python
"""CREATE TABLE IF NOT EXISTS control.ConnectionConfig (
    ConnectionID INT, SourceID INT, KeyVaultSecretName STRING,
    ConnectionString STRING, FabricConnectionId STRING,
    PaginationMode STRING, DataKey STRING, JdbcDriver STRING,
    AbfssPath STRING, BaseUrl STRING, AuthMode STRING
) USING DELTA
TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true')""",
```

Existing rows will get `NULL` → connector defaults to `"BEARER"`, so behaviour is unchanged.

### 4. `config/seed-dev.json` — add the HiBob rows

Append the three rows below to the existing arrays. IDs chosen to not collide
with current seed values (100, 200, 903–909). Pick `SourceID = 300`,
`ConnectionID = 3`, `ConfigID = 300`.

```jsonc
// IngestionSource[]
{
  "SourceID": 300,
  "SourceName": "HIBOB_API",
  "SourceType": "REST",
  "CreatedDate": "2026-04-22T00:00:00Z"
}

// ConnectionConfig[]
{
  "ConnectionID": 3,
  "SourceID": 300,
  "KeyVaultSecretName": "kv-hibob-service-user",
  "ConnectionString": "https://api.hibob.com/v1",
  "FabricConnectionId": null,
  "PaginationMode": "SINGLE",
  "DataKey": "employees",
  "AuthMode": "BASIC",
  "BaseUrl": "https://api.hibob.com/v1",
  "_comment": "HiBob (Bob HR). HTTP Basic with ServiceUserId:Token stored as one KV secret. /v1/people returns full active-employee roster under 'employees' key — no pagination."
}

// IngestionConfig[]
{
  "ConfigID": 300,
  "SourceID": 300,
  "ObjectName": "profiles",
  "WatermarkColumn": null,
  "SyncType": "FULL",
  "_comment": "GET /v1/profiles — full daily refresh of active employees. URL built as {BaseUrl}/{ObjectName.lower()} = https://api.hibob.com/v1/profiles."
}
```

Notes:
- `ObjectName` is lowercased in URL construction (`nb_conn_rest.py:277`), so
  `"profiles"` is the safe value.
- `SyncType: "FULL"` — HiBob doesn't expose a watermark column on `/v1/profiles`;
  the full roster is small (~1 req).
- To also ingest inactive/terminated employees, use the `/v1/people/search` endpoint
  with a POST body filter — requires connector enhancement to support POST method + JSON body.

### 5. Live-update path for an already-seeded Control LH

`nb_bootstrap.py` seeds from JSON with `mode("overwrite")` +
`overwriteSchema=true`, which re-writes the whole table. For a running
environment you usually want an **additive** update that doesn't rebuild
everything. Run this one-shot PySpark cell against the Control LH:

```python
# Run inside a Fabric notebook attached to db_control.
# Safe to re-run: MERGE patterns are idempotent on primary key.
from pyspark.sql import Row

control_lh = "db_control"

# --- IngestionSource --------------------------------------------------------
src_df = spark.createDataFrame([Row(
    SourceID=300, SourceName="HIBOB_API", SourceType="REST",
    CreatedDate=__import__("datetime").datetime.fromisoformat("2026-04-22T00:00:00+00:00"),
)])
src_df.createOrReplaceTempView("_hibob_src")
spark.sql(f"""
    MERGE INTO {control_lh}.control.IngestionSource tgt
    USING _hibob_src src
    ON tgt.SourceID = src.SourceID
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")

# --- ConnectionConfig -------------------------------------------------------
conn_df = spark.createDataFrame([Row(
    ConnectionID=3, SourceID=300,
    KeyVaultSecretName="kv-hibob-service-user",
    ConnectionString="https://api.hibob.com/v1",
    FabricConnectionId=None,
    PaginationMode="SINGLE", DataKey="employees",
    JdbcDriver=None, AbfssPath=None,
    BaseUrl="https://api.hibob.com/v1",
    AuthMode="BASIC",
)])
conn_df.createOrReplaceTempView("_hibob_conn")
spark.sql(f"""
    MERGE INTO {control_lh}.control.ConnectionConfig tgt
    USING _hibob_conn src
    ON tgt.ConnectionID = src.ConnectionID
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")

# --- IngestionConfig --------------------------------------------------------
cfg_df = spark.createDataFrame([Row(
    ConfigID=300, SourceID=300, ObjectName="profiles",
    WatermarkColumn=None, SyncType="FULL",
    SourcePath=None, FileFormat=None,
    RelativeUrl=None, Method="GET",
    PaginationRules=None, CustomQuery=None,
    RequiresNotebook=False,
)])
cfg_df.createOrReplaceTempView("_hibob_cfg")
spark.sql(f"""
    MERGE INTO {control_lh}.control.IngestionConfig tgt
    USING _hibob_cfg src
    ON tgt.ConfigID = src.ConfigID
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")

# Smoke verify
spark.sql(f"""
    SELECT s.SourceName, c.BaseUrl, c.AuthMode, c.DataKey, ic.ObjectName, ic.SyncType
    FROM   {control_lh}.control.IngestionSource s
    JOIN   {control_lh}.control.ConnectionConfig c USING (SourceID)
    JOIN   {control_lh}.control.IngestionConfig ic USING (SourceID)
    WHERE  s.SourceID = 300
""").show(truncate=False)
```

If `AuthMode` does not yet exist on the Delta table (bootstrap not re-run),
add it first:

```sql
ALTER TABLE db_control.control.ConnectionConfig ADD COLUMNS (AuthMode STRING);
```

### 6. Key Vault secret

Name: `kv-hibob-service-user`
Value (single string): `<ServiceUserID>:<Token>`

Create in the dev vault (`KeyVaultUrl` in `EnvironmentConfig` →
`https://kv-<client>-dev-oo3ou.vault.azure.net/`). The connector resolves this via
`nb_utils_config.get_secret()` which already supports Fabric `notebookutils`,
env-var fallback (`KV_HIBOB_SERVICE_USER`), and `DefaultAzureCredential`.

### 7. Wire into the daily runbook (optional, explicit)

`nb_conn_rest` is already registered as `StepID: 3` / `StepID: 11` in
`RunbookStep`. The 15-minute REST step on the daily pipeline (`PipelineID 1000`,
`StepID 3`, `IsActive: false`) should be flipped to `IsActive: true` once HiBob
is the first real REST consumer. No new step row is needed — `nb_conn_rest`
iterates every row in `IngestionConfig` joined to a REST source, so adding
HiBob alone activates it for the pipeline.

---

## Validation

1. `python -m pytest tests/test_nb_conn_rest.py -v` — all existing tests plus
   the two new BASIC-auth cases pass.
2. Local smoke (no Fabric): `KV_HIBOB_SERVICE_USER='id:token' python -c "from
   src.notebooks.nb_conn_rest import fetch_page; print(fetch_page('https://api.hibob.com/v1/people', 'id:token', auth_mode='BASIC').status_code)"`
   → `200`.
3. Fabric smoke: run `02_REST_Connector` pipeline with `SourceName=HIBOB_API`;
   confirm rows land under
   `Files/HIBOB_API/people/YYYY/MM/DD/<ts>/` and `ControlLog` shows `SUCCESS`
   with non-zero `RowsProcessed`.
4. Query `SELECT COUNT(*) FROM lh_landing.default.<parquet path>` — should
   match the employee count reported by the Bob UI.

---

## Out of scope (follow-up tickets)

- `POST /v1/people/search` with filter body → requires `Method=POST` and
  `CustomQuery`/body support in `nb_conn_rest`.
- Per-employee `/v1/people/{id}/custom-tables/{tableId}` → requires a new
  "iterate then sub-fetch" pattern; not a generic REST shape.
- Webhooks → listener notebook + Fabric Eventstream, separate branch.
- Silver/Gold modelling of employee data → `nb_bronze_to_silver` + `ObjectConfig`
  row for `people` with PII masking rules (Email, Phone, DOB, NationalID).

---

## Acceptance checklist

- [ ] `nb_conn_rest.py` supports `AuthMode in {BEARER, BASIC}`; default preserves existing behaviour
- [ ] Unit tests cover BASIC-auth happy path and malformed-secret error
- [ ] `control.ConnectionConfig` has `AuthMode` column in SQL DDL and bootstrap Delta DDL
- [ ] `config/seed-dev.json` contains HiBob rows (SourceID 300 / ConnectionID 3 / ConfigID 300)
- [ ] Key Vault secret `kv-hibob-service-user` created in dev vault
- [ ] Smoke run lands non-empty `people` parquet in Landing with `SUCCESS` ControlLog entry
- [ ] PR description flags any HiBob doc details that could not be confirmed
