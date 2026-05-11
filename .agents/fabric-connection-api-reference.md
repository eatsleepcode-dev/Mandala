# Fabric REST API — Create Shareable Cloud Connection (Parameterized)

Source: Gemini share https://g.co/gemini/share/2ecf86e853a1  
Saved: 2026-05-02

Parameterized function for a build pipeline. Token, connection name, source type,
and credentials are all injectable. Microsoft does not publish a single JSON dictionary
for connection types — the reference dict below is derived from the Fabric REST API schemas.

---

## Type Reference Dictionary

```python
FABRIC_CONNECTION_TYPES = {
    # ── Azure / Microsoft ────────────────────────────────────────────────────
    "AzureSQL": {
        "type": "Sql",
        "path_format": "<server_name>.database.windows.net;<database_name>",
        "supported_credentials": ["Basic", "OAuth2", "ServicePrincipal", "WorkspaceIdentity"],
        "cred_keys": ["username", "password"],
    },
    "AzureBlob": {
        "type": "AzureBlob",
        "path_format": "https://<account_name>.blob.core.windows.net/",
        "supported_credentials": ["Key", "OAuth2", "SharedAccessSignature"],
        "cred_keys": ["key"],
    },
    "ADLSGen2": {
        "type": "AzureDataLakeStorage",
        "path_format": "https://<account_name>.dfs.core.windows.net/<file_system>",
        "supported_credentials": ["Key", "OAuth2", "ServicePrincipal", "WorkspaceIdentity"],
        "cred_keys": ["key"],
    },
    "SharePointOnlineList": {
        "type": "SharePointOnlineList",                # confirmed via Microsoft fabric-toolbox CONNECTOR_MAPPING.md
        "path_format": "https://<tenant>.sharepoint.com/sites/<site>",
        "supported_credentials": ["OAuth2", "ServicePrincipal", "WorkspaceIdentity"],
        "cred_keys": [],
    },
    "Dataverse": {
        # Prefer the native "Link to Microsoft Fabric" integration when available
        # (auto-provisions a system-managed connection + OneLake shortcuts via Power Apps).
        # Create a manual SCC when: no native link has been set up, or you need pipeline
        # connectivity independent of the shortcut approach (e.g. Copy Data activity).
        # get_or_create_connection() handles both cases — if a matching name already exists
        # (from the native link), it is returned without modification.
        "type": "Dataverse",                           # ⚠️ UNCONFIRMED — not present in any public spec
        # or official example. The connectionDetails.type field has no enum constraint;
        # valid values are returned at runtime by:
        #   GET /v1/connections/supportedConnectionTypes
        # Likely candidates (ADF/Power Query legacy naming): "CommonDataService",
        # "Dataverse", "MicrosoftDataverse". Confirm on your tenant:
        #   resp = requests.get(f"{_FABRIC_API}/connections/{live_conn_id}", headers=_headers(token))
        #   print(resp.json()["connectionDetails"]["type"])
        "path_format": "https://<org>.crm.dynamics.com",
        "supported_credentials": ["OAuth2", "ServicePrincipal"],
        "cred_keys": [],                               # OAuth2: {"accessToken": "..."}
    },
    # ── Web / API ────────────────────────────────────────────────────────────
    "Web": {
        "type": "Web",
        "path_format": "https://<api_url>",
        "supported_credentials": ["Anonymous", "Basic", "Key"],
        "cred_keys": [],
    },
    # ── File transfer ────────────────────────────────────────────────────────
    "SFTP": {
        "type": "Sftp",                                # confirmed via Microsoft fabric-toolbox CONNECTOR_MAPPING.md
        "path_format": "<host>:<port>",                # e.g. sftp.example.com:22
        "supported_credentials": ["Basic", "Key"],     # Key = SSH private key
        "cred_keys": ["username", "password"],
    },
    # ── Third-party databases ────────────────────────────────────────────────
    "Snowflake": {
        "type": "Snowflake",
        "path_format": "<account_identifier>.snowflakecomputing.com;<warehouse>;<database>",
        "supported_credentials": ["Basic"],
        "cred_keys": ["username", "password"],
    },
    "Oracle": {
        "type": "Oracle",                              # confirmed via Microsoft fabric-toolbox CONNECTOR_MAPPING.md
        "path_format": "<host>:<port>/<service_name>",
        "supported_credentials": ["Basic"],
        "cred_keys": ["username", "password"],
    },
    "PostgreSQL": {
        "type": "PostgreSql",                          # confirmed — note casing (not "PostgreSQL")
        "path_format": "<host>:<port>;<database_name>",
        "supported_credentials": ["Basic"],
        "cred_keys": ["username", "password"],
    },
    "MySQL": {
        "type": "MySql",                               # confirmed — note casing (not "MySQL" or "MYSQL")
        "path_format": "<host>:<port>;<database_name>",
        "supported_credentials": ["Basic"],
        "cred_keys": ["username", "password"],
    },
}

# Type strings confirmed from Microsoft's official fabric-toolbox CONNECTOR_MAPPING.md
# (ADF→Fabric migration tool). Dataverse is excluded — it uses the native "Link to Microsoft
# Fabric" integration, not a standard SCC. See "Dataverse — Native OneLake Integration" section.
# Call GET /v1/connections/supportedConnectionTypes for the full runtime type list on your tenant.
```

---

## Core Helpers

```python
import requests
import json

_FABRIC_API = "https://api.fabric.microsoft.com/v1"


def _headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}


def list_connections(access_token: str) -> list[dict]:
    """Return all connections visible to the caller, handling pagination."""
    results = []
    url = f"{_FABRIC_API}/connections"
    while url:
        resp = requests.get(url, headers=_headers(access_token))
        resp.raise_for_status()
        data = resp.json()
        results.extend(data.get("value", []))
        url = data.get("continuationUri")          # None when last page
    return results


def get_connection_by_name(access_token: str, display_name: str) -> dict | None:
    """Return the first connection matching display_name, or None."""
    return next(
        (c for c in list_connections(access_token) if c["displayName"] == display_name),
        None,
    )
```

---

## Create (with structured error handling)

```python
def create_shareable_cloud_connection(
    access_token: str,
    display_name: str,
    source_type: str,
    path: str,
    credential_type: str,
    credentials_dict: dict,
    privacy_level: str = "Organizational",
    gateway_id: str | None = None,
    allow_notebook_access: bool = True,
    allow_gateway_usage: bool = False,
) -> dict:
    """
    Create a Shareable Cloud Connection.

    Args:
        access_token:          Entra ID Bearer token.
        display_name:          Connection name in the Fabric UI.
        source_type:           Exact Fabric type string from FABRIC_CONNECTION_TYPES.
        path:                  Connection string or URL path.
        credential_type:       'Basic', 'Key', 'OAuth2', 'Anonymous', 'ServicePrincipal',
                               'WorkspaceIdentity'.
        credentials_dict:      Credential key/value pairs — pass {} for WorkspaceIdentity
                               or Anonymous.
        privacy_level:         'None', 'Public', 'Organizational', 'Private'.
        gateway_id:            Optional VNet Data Gateway ID. When supplied, the connection
                               is bound to that gateway for firewalled sources.
        allow_notebook_access: Sets allowUsageInUserControlledCode (API default: false).
                               Must be True for notebookutils.getCredential() to work.
                               Cannot be changed after creation. Defaulted True here
                               because notebook access is the common case for this platform.
                               Note: only credential types listed in
                               supportedCredentialTypesForUsageInUserControlledCode for the
                               connection type are valid when this is True (e.g. SQL supports
                               Basic and WorkspaceIdentity; not all types support all creds).
        allow_gateway_usage:   Sets allowConnectionUsageInGateway. Set True when binding
                               to an on-premises or VNet Data Gateway.

    Returns:
        JSON response dict containing 'id'.

    Raises:
        PermissionError:  HTTP 401 or 403 — token invalid or insufficient permissions.
        ValueError:       HTTP 409 — connection with this name already exists.
        RuntimeError:     Any other non-201 response.
    """
    payload = {
        "displayName":                        display_name,
        "connectivityType":                   "ShareableCloud",
        "allowUsageInUserControlledCode":     allow_notebook_access,
        "allowConnectionUsageInGateway":      allow_gateway_usage,
        "connectionDetails": {"type": source_type, "path": path},
        "credentialDetails": {
            "credentialType":     credential_type,
            "credentials":        json.dumps(credentials_dict),  # must be stringified JSON
            "encryptionAlgorithm":"None",
            "privacyLevel":       privacy_level,
        },
    }
    if gateway_id:
        payload["gatewayId"] = gateway_id                 # bind to VNet Gateway

    resp = requests.post(f"{_FABRIC_API}/connections", headers=_headers(access_token), json=payload)

    if resp.status_code == 201:
        return resp.json()
    if resp.status_code in (401, 403):
        raise PermissionError(f"Auth failure creating '{display_name}': HTTP {resp.status_code} — {resp.text}")
    if resp.status_code == 409:
        raise ValueError(f"Connection '{display_name}' already exists (HTTP 409). Use get_or_create_connection().")
    raise RuntimeError(f"Failed to create '{display_name}': HTTP {resp.status_code} — {resp.text}")
```

---

## Idempotent Create (build pipeline pattern)

```python
def get_or_create_connection(
    access_token: str,
    display_name: str,
    source_type: str,
    path: str,
    credential_type: str,
    credentials_dict: dict,
    privacy_level: str = "Organizational",
    gateway_id: str | None = None,
    allow_notebook_access: bool = True,
    allow_gateway_usage: bool = False,
) -> tuple[dict, bool]:
    """
    Return (connection_dict, created: bool).
    If a connection with display_name already exists, returns it without modification.
    Otherwise creates it and returns the new record.
    Safe to call on every pipeline run — idempotent.
    """
    existing = get_connection_by_name(access_token, display_name)
    if existing:
        print(f"  [SCC] '{display_name}' already exists — id={existing['id']}")
        return existing, False

    conn = create_shareable_cloud_connection(
        access_token, display_name, source_type, path,
        credential_type, credentials_dict, privacy_level, gateway_id,
        allow_notebook_access=allow_notebook_access,
        allow_gateway_usage=allow_gateway_usage,
    )
    print(f"  [SCC] Created '{display_name}' — id={conn['id']}")
    return conn, True
```

---

## Example Usage

```python
# Lookup exact Fabric type from reference dict
fabric_type = FABRIC_CONNECTION_TYPES["AzureSQL"]["type"]   # "Sql"

new_conn = create_shareable_cloud_connection(
    access_token=access_token,
    display_name="Prod_Sales_DB_Connection",
    source_type=fabric_type,
    path="myserver.database.windows.net;mydatabase",
    credential_type="Basic",
    credentials_dict={"username": "admin_user", "password": "secure_password123!"},
    privacy_level="Organizational",
)
print(f"Created connection: {new_conn['id']}")
```

---

## credentials_dict by credentialType

```python
# Basic (username / password)
{"username": "db_user", "password": "s3cr3t"}

# Key (storage account key, SSH key, etc.)
{"key": "base64encodedkey=="}

# Service Principal
{"tenantId": "tenant-guid", "servicePrincipalId": "sp-client-id", "servicePrincipalKey": "sp-secret"}

# OAuth2 — delegated; token obtained via MSAL interactive/device flow
{"accessToken": "eyJ..."}

# WorkspaceIdentity — no credentials needed; Fabric manages the identity
{}

# Anonymous
{}
```

---

## Notes

- `credentials` in the payload must be a **stringified JSON string**, not a dict.
- `connectivityType` is always `"ShareableCloud"` for programmatic creation.
- `allowUsageInUserControlledCode: true` must be set at creation time to enable
  `notebookutils.connections.getCredential()`. API default is `false`; this library
  defaults to `True`. Cannot be changed via PATCH after creation.
  Not all credential types are valid when this flag is set — the supported subset is
  returned per connection type by `GET /v1/connections/supportedConnectionTypes` in the
  `supportedCredentialTypesForUsageInUserControlledCode` field (e.g. SQL: Basic + WorkspaceIdentity).
- `allowConnectionUsageInGateway: true` required when binding to an on-premises or VNet
  Data Gateway. Separate flag from notebook access; both can be set simultaneously.
- Expand `FABRIC_CONNECTION_TYPES` using the official Fabric REST API docs as new
  source types are onboarded (SFTP, Oracle, SharePoint, etc.).
- Relevant to: TD-030 (SharePoint connector), P5-A (SFTP), P5-C (Oracle/SQLMI JDBC).

---

## MSAL Authentication (Service Principal, with token caching)

MSAL caches tokens in memory automatically. Calling `acquire_token_for_client` on every
operation is safe and efficient — it returns the cached token until ~5 minutes before expiry,
then silently refreshes. No manual expiry tracking required for standard pipelines.

```python
import msal

CLIENT_ID     = "your_app_client_id"
CLIENT_SECRET = "your_app_client_secret"
TENANT_ID     = "your_tenant_id"

# Instantiate once per pipeline run; reuse for all API calls
_msal_app = msal.ConfidentialClientApplication(
    CLIENT_ID,
    authority=f"https://login.microsoftonline.com/{TENANT_ID}",
    client_credential=CLIENT_SECRET,
)

def get_access_token() -> str:
    """Returns a valid token, refreshing silently if near expiry."""
    result = _msal_app.acquire_token_for_client(
        scopes=["https://api.fabric.microsoft.com/.default"]
    )
    if "access_token" not in result:
        raise RuntimeError(f"Token acquisition failed: {result.get('error_description')}")
    return result["access_token"]
```

For very long-running pipelines (> 1 hour), wrap all API calls to re-call `get_access_token()`
on each request rather than caching the string — MSAL handles the rest.

---

## PowerShell — List Shareable Cloud Connections

```powershell
$token   = "<Your_Entra_ID_Bearer_Token>"
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

$response = Invoke-RestMethod -Method GET -Uri "https://api.fabric.microsoft.com/v1/connections" -Headers $headers
$response.value | Where-Object { $_.connectivityType -eq 'ShareableCloud' } | Format-Table displayName, id, connectivityType
```

---

## Update an Existing Connection

Replace `requests.post(url, ...)` with:

```python
requests.patch(f"https://api.fabric.microsoft.com/v1/connections/{connection_id}", headers=headers, json=payload)
```

Pass only the fields to modify in the payload.

---

## Grant Access — Role Assignments

Sharing an SCC means creating a **Role Assignment** that binds an Entra ID identity to the
connection. The endpoint is `POST /v1/connections/{connection_id}/roleAssignments`.

### Principal types

| `type` value | When to use |
|---|---|
| `"User"` | Individual human identity (Entra Object ID, not UPN) |
| `"Group"` | Entra ID Security Group — **recommended** for teams |
| `"ServicePrincipal"` | App Registration for pipeline automation |
| `"ServicePrincipalProfile"` | Multi-tenant service principal profiles |

### Role values

| `role` value | Permissions |
|---|---|
| `"User"` | Use the connection in pipelines/notebooks/semantic models; cannot view credentials or share |
| `"UserWithReshare"` | Use the connection **and** share it with other developers |
| `"Owner"` | Full admin — change credentials, delete the connection |

### Implementation

```python
def share_connection_with_group(
    access_token: str,
    connection_id: str,
    principal_object_id: str,
    principal_type: str = "Group",   # "User", "Group", "ServicePrincipal", "ServicePrincipalProfile"
    role: str = "User",              # "User", "UserWithReshare", "Owner"
) -> None:
    """
    Bind an Entra ID identity to an SCC via a role assignment.
    Call immediately after get_or_create_connection() in the build pipeline.
    """
    url = f"{_FABRIC_API}/connections/{connection_id}/roleAssignments"
    body = {
        "principal": {
            "id":   principal_object_id,
            "type": principal_type,
        },
        "role": role,
    }
    resp = requests.post(url, headers=_headers(access_token), json=body)
    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Failed to assign role on connection {connection_id}: "
            f"HTTP {resp.status_code} — {resp.text}"
        )
```

### Modifying or removing a role assignment

Both operations target the individual assignment by its ID:
`https://api.fabric.microsoft.com/v1/connections/{connection_id}/roleAssignments/{role_assignment_id}`

```python
# Upgrade a principal from User to Owner
requests.patch(
    f"{_FABRIC_API}/connections/{connection_id}/roleAssignments/{role_assignment_id}",
    headers=_headers(access_token),
    json={"role": "Owner"},
)

# Revoke access
requests.delete(
    f"{_FABRIC_API}/connections/{connection_id}/roleAssignments/{role_assignment_id}",
    headers=_headers(access_token),
)
```

The `role_assignment_id` is returned in the list response from
`GET /v1/connections/{connection_id}/roleAssignments`.

---

## VNet Data Gateway — Binding an SCC

Pass `gateway_id` to `create_shareable_cloud_connection()` or `get_or_create_connection()`.
The gateway ID is a GUID visible in the Fabric Admin Portal under
**Settings → Manage connections and gateways → VNet Data Gateways**.

```python
conn, created = get_or_create_connection(
    access_token=get_access_token(),
    display_name="Prod_SQL_ERP_UKWest",
    source_type="Sql",
    path="internal-sqlserver.corp.local;erp",
    credential_type="WorkspaceIdentity",
    credentials_dict={},
    gateway_id="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",   # VNet Gateway GUID
)
```

`gatewayId` is a **top-level field** in the request body — confirmed from the official
`microsoft/fabric-rest-api-specs` example `CreateVirtualNetworkGatewayConnection.json`.
There is no `gatewayObjectId` field; that name does not appear in the spec.

---

## Enterprise Best Practices

### Security and Authentication

- **Prefer Workspace Identities and Service Principals** over Basic / Key auth. Workspace Identities auto-manage the underlying SP — zero credential rotation.
- **Never hardcode credentials_dict** in scripts. Pull secrets from Azure Key Vault at pipeline runtime (ADO variable groups or GitHub Actions secrets).
- **VNet Data Gateway** — if sources are behind a firewall, bind the SCC to a Fabric VNet Gateway rather than opening public internet access.

### CI/CD and Environment Strategy

- **One SCC per environment** — `Dev_SQL_Sales`, `Test_SQL_Sales`, `Prod_SQL_Sales`. The deployment script selects the target path and connection name based on the current pipeline stage.
- **Handle the mapping gap** — because Fabric cannot programmatically bind a semantic model to an SCC, build a manual gate into your release process: pipeline alerts a release manager to map in the Fabric UI immediately after automated deployment succeeds.

### Governance and Access

- **Share via Entra ID security groups**, never individual users. Group membership handles joiner/leaver without touching the SCC directly.
- **Naming convention** — `[Env]_[SourceType]_[SystemName]_[Region]`, e.g. `PRD_AzureSQL_ERP_UKWest`. Without this the Fabric admin portal becomes unmanageable at scale.
- **`privacyLevel = "Organizational"`** as the default. Prevents accidental data leakage via query folding when mixing sources of different sensitivity levels.

---

## Using an SCC in a Fabric Data Pipeline

### Option A — Notebook Activity (Python automation)

1. Create a Fabric Notebook; paste the Python code into a cell.
2. Mark the variables cell as a **Parameter Cell** (cell menu → Toggle parameter cell) so the pipeline can inject values at runtime.
3. In the pipeline, add a **Notebook Activity** → Settings → select the notebook → expand **Base parameters** → map pipeline variables to notebook parameters.

### Option B — Web Activity (no Python)

Add a **Web Activity** directly in the pipeline:
- URL: `https://api.fabric.microsoft.com/v1/connections`
- Method: `POST`
- Body: JSON payload built with dynamic expressions
- Authentication: Service Principal

### Option C — Copy Data / Dataflow Gen2 (consuming an existing SCC)

1. Add a **Copy Data** activity.
2. Source tab → select data store type → **Connection** dropdown shows available SCCs.
3. Select the SCC — credentials are centrally managed, no further auth config needed.

---

## Parameterising Connection IDs in Pipelines

Fabric pipelines reference connections by **Connection ID (GUID)**, not display name.

### Finding the Connection ID

**Via UI:** Settings gear → Manage connections and gateways → ellipsis → Settings → copy Connection ID.

**Via Python:** The API response from `create_shareable_cloud_connection()` / `get_or_create_connection()` contains `id` — capture and store it:

```python
conn, created = get_or_create_connection(...)
connection_id = conn["id"]   # persist to ObjectConfig or pipeline metadata table
```

### Using it in the Pipeline

1. Pipeline canvas (empty area) → **Parameters** tab → add `String` parameter e.g. `SourceConnectionID`.
2. Set default to the Connection ID GUID.
3. In the Copy Data activity Source/Destination tab → enable **Dynamic content** on the Connection field.
4. Expression: `@pipeline().parameters.SourceConnectionID`

> **Internal Fabric items** (Lakehouse, Warehouse) use Workspace Item ID or Variable Library substitution — not SCC IDs. The GUID pattern applies only to external cloud connections (SQL, Snowflake, Web, etc.).

---

## Triggering a Pipeline with a Runtime Connection ID

Use **Run On Demand Item Job** (`POST .../jobs/instances?jobType=Pipeline`) to pass a
Connection ID parameter without modifying the pipeline's stored definition.

```python
def trigger_pipeline_with_connection(
    access_token: str,
    workspace_id: str,
    pipeline_id: str,
    connection_id: str,
    parameter_name: str = "SourceConnectionID",
) -> None:
    """
    Trigger a pipeline and inject the SCC ID as a runtime parameter.
    The pipeline must have a String parameter matching `parameter_name`.
    """
    url = (
        f"{_FABRIC_API}/workspaces/{workspace_id}/items/{pipeline_id}"
        f"/jobs/instances?jobType=Pipeline"
    )
    payload = {
        "executionData": {
            "parameters": {parameter_name: connection_id}
        }
    }
    resp = requests.post(url, headers=_headers(access_token), json=payload)
    if resp.status_code != 202:
        raise RuntimeError(
            f"Failed to trigger pipeline {pipeline_id}: "
            f"HTTP {resp.status_code} — {resp.text}"
        )
```

Use this for **daily operational runs** where the Connection ID is resolved at runtime
(e.g. from `control.ConnectionConfig`). No pipeline version history is written.

---

## Permanently Updating a Pipeline's Definition (CI/CD)

Fabric pipeline definitions are stored as Base64-encoded JSON (`pipeline-content.json`).
Use this to permanently rewrite a default parameter value or update a hardcoded connection
reference — appropriate for CI/CD deployments, not for routine pipeline runs.

**Pattern:** GET definition → decode Base64 → modify JSON dict → re-encode → POST updateDefinition.

```python
def update_pipeline_connection_parameter(
    access_token: str,
    workspace_id: str,
    pipeline_id: str,
    parameter_name: str,
    new_connection_id: str,
) -> None:
    """
    Permanently update a pipeline parameter's default value.
    Use for CI/CD deployments only — not for runtime parameter passing.
    """
    import base64, json

    hdrs = _headers(access_token)

    # 1. Download current definition
    get_resp = requests.post(
        f"{_FABRIC_API}/workspaces/{workspace_id}/items/{pipeline_id}/getDefinition",
        headers=hdrs,
    )
    get_resp.raise_for_status()
    parts = get_resp.json()["definition"]["parts"]
    content_b64 = next(p["payload"] for p in parts if p["path"] == "pipeline-content.json")

    # 2. Decode, modify, re-encode
    pipeline_json = json.loads(base64.b64decode(content_b64).decode("utf-8"))
    params = pipeline_json.get("properties", {}).get("parameters", {})
    if parameter_name not in params:
        raise ValueError(f"Parameter '{parameter_name}' not found in pipeline definition")
    params[parameter_name]["defaultValue"] = new_connection_id
    updated_b64 = base64.b64encode(
        json.dumps(pipeline_json).encode("utf-8")
    ).decode("utf-8")

    # 3. Push updated definition
    update_resp = requests.post(
        f"{_FABRIC_API}/workspaces/{workspace_id}/items/{pipeline_id}/updateDefinition",
        headers=hdrs,
        json={
            "definition": {
                "parts": [
                    {"path": "pipeline-content.json", "payload": updated_b64, "payloadType": "InlineBase64"}
                ]
            }
        },
    )
    if update_resp.status_code != 200:
        raise RuntimeError(
            f"Failed to update pipeline definition: HTTP {update_resp.status_code} — {update_resp.text}"
        )
```

**When to use each approach:**

| Method | When |
|---|---|
| Runtime trigger (`executionData.parameters`) | Daily ETL runs, dynamic routing, orchestration notebooks |
| Definition update (`updateDefinition`) | CI/CD deployment, migrating an SCC GUID after credential rotation, metadata-driven pipeline provisioning |

---

## Consuming an SCC from a Fabric Notebook (notebookutils)

`notebookutils` does **one thing** with SCCs: securely extract the underlying credentials
at runtime via `getCredential()`. It does not query the data source directly — you unwrap
the secret and pass it to a standard Python client (`pyodbc`, `azure.storage.blob`,
`requests`, etc.).

### Two prerequisites — both must be met before getCredential() works

**1. Code-First access flag — set via `allowUsageInUserControlledCode` in the API payload**
The SCC must have been created with `"allowUsageInUserControlledCode": true` in the
`POST /v1/connections` body. This is the API equivalent of checking "Allow Code-First
Artifacts like Notebooks to access this connection" in the UI.

This flag **cannot be changed after creation** — the connection must be recreated if it was
missed. `create_shareable_cloud_connection()` defaults `allow_notebook_access=True` so
API-provisioned connections are always notebook-accessible unless explicitly opted out.

> **This eliminates the UI requirement entirely.** CI/CD scripts using `get_or_create_connection()`
> with the default parameter produce connections that are immediately usable with
> `notebookutils.connections.getCredential()` — no developer needs to touch the Fabric UI.

**2. Manual per-notebook binding (cannot be automated)**
Holding the Connection ID is not sufficient. A developer must open the Notebook UI, open the
**Connections** pane on the left, find the SCC under "Global Permissions", and click
**Connect**. This creates a notebook-specific binding that authorises this notebook to
unwrap this connection. There is currently no public REST API to automate this step — it is
a manual click per notebook.

> This is the most significant operational constraint. Any deployment runbook that uses
> `getCredential()` must include a manual step for each new notebook.

### getCredential() — credential shape by auth type

| credentialType | credentialData keys returned |
|---|---|
| Basic | `username`, `password` |
| Key | `key` |
| OAuth2 / Token | `accessToken` (Bearer) |
| WorkspaceIdentity | token managed internally — verify exact shape |

### Example — SQL database via pyodbc

```python
import json
import notebookutils  # noqa: F821 — Fabric runtime only
import pyodbc

# Parameter cell variable — injected by pipeline at runtime
connection_id = "your-bound-connection-id"

# 1. Unwrap the SCC
secure_payload = notebookutils.connections.getCredential(connection_id)
cred_dict      = json.loads(secure_payload["credential"])

# 2. Extract credentials by name
username = next(item["value"] for item in cred_dict["credentialData"] if item["name"] == "username")
password = next(item["value"] for item in cred_dict["credentialData"] if item["name"] == "password")

# 3. Use with standard Python client — notebookutils is not involved beyond this point
conn_str = (
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=myserver.database.windows.net;"
    "Database=mydb;"
    f"Uid={username};Pwd={password};"
    "Encrypt=yes;"
)
db_conn = pyodbc.connect(conn_str)
```

### the platform integration pattern

Store the Connection ID in `control.ConnectionConfig.SCCConnectionId` (new column).
Connector notebooks use `getCredential()` if the ID is present, fall back to Key Vault
if not — allowing gradual migration.

```python
# In nb_conn_jdbc / nb_conn_rest / nb_conn_sharepoint:
conn_id = connection_config.get("SCCConnectionId")
if conn_id:
    creds = _get_scc_credentials(conn_id)   # notebookutils wrapper
else:
    creds = _get_kv_credentials(kv_url, secret_name)  # KV fallback
```

---

## Dataverse — Native OneLake Integration (Not SCC-based)

Dataverse has a specially optimised native integration with Fabric that bypasses the manual
SCC creation process entirely. Do not create a manual SCC for Dataverse.

### How it works

1. Go to **Power Apps Maker Portal** → select your Dataverse environment
2. Under Tables, choose **Analyze** → **Link to Microsoft Fabric**
3. Provide the target Fabric workspace ID
4. Microsoft automatically provisions a system-managed connection and drops **OneLake shortcuts**
   directly into the specified Lakehouse

### What you get

| Property | Detail |
|---|---|
| **Zero-ETL** | No data is copied — Spark and SQL endpoint query Dataverse storage directly |
| **Metadata resolution** | Choice columns, lookups, and option sets are resolved to readable values automatically; raw GUIDs are not exposed |
| **Security** | Respects Dataverse environment boundaries and table-level security without manual SP or credential management |
| **System-managed connection** | The provisioned connection is not visible as a standard SCC in the connections list; it is managed by the Dataverse–Fabric integration layer |

### Implication for automation

The "Link to Microsoft Fabric" step must be performed via the Power Apps portal UI or the
**Dataverse Fabric Link REST API** (a separate API surface from the Fabric connections API).
There is no `POST /v1/connections` call involved — the standard SCC provisioning scripts in
this document do not apply to Dataverse.

If you need to automate the linking step at scale (e.g. for many Dataverse environments),
use the **Dataverse Web API** or **Power Platform CLI** (`pac fabric link`), not the Fabric
Connections REST API.

### Connecting to Dataverse from pipelines and notebooks

Use `get_or_create_connection()` — it handles both cases:

- **Native link already set up:** The system-managed connection appears in `list_connections()` under the Dataverse environment display name. `get_or_create_connection()` finds it and returns it without modification.
- **No native link:** A standard SCC is created. Use this when you need pipeline connectivity independent of the shortcut approach (e.g. Copy Data activity, direct REST calls).

```python
conn, created = get_or_create_connection(
    access_token=get_access_token(),
    display_name="Prod_Dataverse_Sales",           # match the native link name if one exists
    source_type="Dataverse",                       # ⚠️ confirm type string on your tenant first
    path="https://contoso.crm.dynamics.com",
    credential_type="ServicePrincipal",
    credentials_dict={
        "tenantId":           "your-tenant-id",
        "servicePrincipalId": "sp-client-id",
        "servicePrincipalKey":"sp-secret",
    },
)
connection_id = conn["id"]
```

**If the native link exists and you just need the ID:**
```python
conn = get_connection_by_name(access_token, "<your Dataverse environment display name>")
print(conn["connectionDetails"]["type"])   # discover the actual type string
print(conn["id"])                          # store in ConnectionConfig.SCCConnectionId
```

Do not PATCH or DELETE a system-managed native-link connection. Role assignments
(`share_connection_with_group`) are safe to call on either type.

---

## ⚠️ Known Limitation — Semantic Model Binding

Programmatically **binding a semantic model to a Shareable Cloud Connection is not yet supported via API**.  
After deploying a new semantic model via CI/CD, a developer must manually map it in the Fabric UI:  
**Settings → Gateway and cloud connections → Maps to**

**XMLA workaround:** Enable XMLA read/write on the workspace, then use the Tabular Object Model
(TOM) via `pythonnet` or C# to script the data source mapping post-deployment. This is the only
path to automating semantic model connection binding today.

This affects any automated deployment pipeline that provisions both a semantic model and its connection.

---

## ⚠️ Architectural Constraint — SCCs Are NOT Copied by Workspace Deployment Pipelines

Fabric's built-in workspace deployment pipeline (Dev → Test → Prod) copies notebooks, lakehouses,
data pipelines, and semantic models. It does **not** copy Shareable Cloud Connections — they are
**tenant-level items**, not workspace items.

**Consequence:** Every environment must have its SCCs provisioned independently. A promotion that
deploys a pipeline from Test to Prod will succeed, but the Prod pipeline will reference a
non-existent or wrong Connection ID until the SCC is created and the pipeline definition is updated.

**Required deployment order:**
1. Run SCC provisioning script for the target environment (creates SCCs if absent; returns IDs)
2. Update pipeline definitions with the environment-specific Connection IDs (`updateDefinition`)
3. Run workspace deployment pipeline to promote other items

Skipping step 1 produces silent failures at pipeline runtime, not at deployment time — making
this easy to miss in testing.

---

## Required Service Principal Permissions

The SP running CI/CD scripts needs specific Fabric roles. Without these, all connection API
calls return `403`.

| Operation | Required permission |
|---|---|
| Create / PATCH / DELETE connections | **Fabric Administrator** role in the tenant, OR the SP must already be an **Owner** of the specific connection |
| List connections (`GET /v1/connections`) | Any authenticated Fabric user (returns only visible connections) |
| Assign roles on a connection | **Owner** of the connection |
| Trigger a pipeline job | **Contributor** or above on the workspace |
| Read/update pipeline definition | **Contributor** or above on the workspace |

**Recommended setup:**
- Grant the deploy SP **Fabric Administrator** in the tenant admin portal for the initial
  provisioning phase (SCC creation + role assignment).
- Immediately after creation, assign the SP as `"Owner"` on each connection it manages,
  then remove tenant admin if the principle of least privilege requires it.
- Store the SP `clientId`, `clientSecret`, and `tenantId` in Azure Key Vault; inject into
  CI/CD as pipeline secret variables — never in source control.

---

## SCC-as-Code — Declarative Connection Manifest

SCCs do not live in Git like notebooks do. Without an explicit pattern, they accumulate as
untracked manual UI creations. The solution is a **connections manifest** — a YAML file
checked into the infrastructure repo that declares the desired state of every SCC per environment.

### `connections.yml` (infrastructure repo)

```yaml
# credential_type: WorkspaceIdentity | Basic | Key | OAuth2 | ServicePrincipal | Anonymous
# privacy_level:   None | Public | Organizational | Private  (default: Organizational)
# {key} placeholders in name and path are resolved by deploy_connections(substitutions=...)

connections:

  - name: "{env}_SQL_ERP_UKWest"
    source_type: Sql
    path: "{erp_server};{erp_database}"
    credential_type: WorkspaceIdentity
    credentials: {}
    privacy_level: Organizational
    share_with_groups:
      - sg-data-engineers
      - sg-pipeline-runners

  - name: "{env}_ADLSGen2_Landing"
    source_type: AzureDataLakeStorage
    path: "https://{storage_account}.dfs.core.windows.net/landing"
    credential_type: WorkspaceIdentity
    credentials: {}
    privacy_level: Organizational
    share_with_groups:
      - sg-data-engineers

  - name: "{env}_SFTP_Supplier"
    source_type: Sftp
    path: "{sftp_host}"
    credential_type: Basic
    credentials: {}          # populated from Key Vault before deploy — see below
    privacy_level: Private
    share_with_groups:
      - sg-data-engineers
```

### Deploy with `nb_utils_scc`

`load_connections_manifest()` validates every entry into a typed `ConnectionSpec` at load time,
reporting all errors before any API call. `deploy_connections()` is idempotent — existing
connections are reused without modification.

```python
from nb_utils_scc import get_sp_token, load_connections_manifest, deploy_connections

token = get_sp_token(client_id, client_secret, tenant_id)

specs = load_connections_manifest("connections.yml")

# Populate credentials from Key Vault for non-anonymous types.
for spec in specs:
    if spec.credential_type == "Basic":
        spec.credentials = {
            "username": kv.get_secret(f"{spec.name}-username"),
            "password": kv.get_secret(f"{spec.name}-password"),
        }
    elif spec.credential_type == "ServicePrincipal":
        spec.credentials = {
            "tenantId":     tenant_id,
            "clientId":     kv.get_secret("sp-client-id"),
            "clientSecret": kv.get_secret("sp-client-secret"),
        }

connection_ids = deploy_connections(
    token,
    specs,
    substitutions={
        "env":             "prod",
        "erp_server":      "prod-sql.corp.local",
        "erp_database":    "erp_prod",
        "storage_account": "prodadls",
        "sftp_host":       "sftp.supplier.com",
    },
    group_object_ids={
        "sg-data-engineers":   "<entra-oid>",
        "sg-pipeline-runners": "<entra-oid>",
    },
)
# connection_ids → {"prod_SQL_ERP_UKWest": "<guid>", "prod_ADLSGen2_Landing": "<guid>", ...}
```

The returned `{name: id}` dict is written to a deployment artifact (e.g. `connection_ids.json`)
consumed by the next pipeline stage that updates pipeline definitions and the control table.

### ConnectionSpec fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | str | ✓ | — | Supports `{key}` substitutions |
| `source_type` | str | ✓ | — | Fabric type string; discover via `list_supported_connection_types()` |
| `path` | str | ✓ | — | Connection path/URL; format varies by type; supports `{key}` substitutions |
| `credential_type` | str | ✓ | — | One of: `Basic`, `Key`, `OAuth2`, `Anonymous`, `ServicePrincipal`, `WorkspaceIdentity` |
| `credentials` | dict | | `{}` | Key/value pairs; leave `{}` in YAML, populate from KV before deploy |
| `privacy_level` | str | | `"Organizational"` | One of: `None`, `Public`, `Organizational`, `Private` |
| `gateway_id` | str \| None | | `None` | GUID of On-Premises or VNet Gateway |
| `share_with_groups` | list[str] | | `[]` | Group names; must be keys in `group_object_ids` |

---

## Credential Rotation

When a password expires or a service principal secret is rotated, update the SCC credentials
in-place using PATCH. The SCC ID does not change — downstream items (pipelines, notebooks,
semantic models) automatically use the new credentials without any reconfiguration.

```python
def rotate_connection_credentials(
    access_token: str,
    connection_id: str,
    new_credentials_dict: dict,
    credential_type: str | None = None,
) -> None:
    """
    Update credentials on an existing SCC without changing its ID.
    Pull new_credentials_dict from Key Vault immediately before calling.
    """
    import json
    payload: dict = {
        "credentialDetails": {
            "credentials": json.dumps(new_credentials_dict),
        }
    }
    if credential_type:
        payload["credentialDetails"]["credentialType"] = credential_type

    resp = requests.patch(
        f"{_FABRIC_API}/connections/{connection_id}",
        headers=_headers(access_token),
        json=payload,
    )
    if resp.status_code not in (200, 204):
        raise RuntimeError(
            f"Failed to rotate credentials on {connection_id}: "
            f"HTTP {resp.status_code} — {resp.text}"
        )
```

**Bulk rotation pattern** — for SP secrets that expire every 90 days across many SCCs:

```python
def bulk_rotate_service_principal_credentials(
    access_token: str,
    new_sp_secret: str,
    tenant_id: str,
    sp_client_id: str,
    target_name_prefix: str = "",   # rotate only connections matching this prefix
) -> None:
    new_creds = {
        "tenantId": tenant_id,
        "servicePrincipalId": sp_client_id,
        "servicePrincipalKey": new_sp_secret,
    }
    for conn in list_connections(access_token):
        if target_name_prefix and not conn["displayName"].startswith(target_name_prefix):
            continue
        cred_type = conn.get("credentialDetails", {}).get("credentialType", "")
        if cred_type != "ServicePrincipal":
            continue
        rotate_connection_credentials(access_token, conn["id"], new_creds, "ServicePrincipal")
        print(f"  Rotated: {conn['displayName']}")
```

Trigger via an Azure Function or Fabric pipeline on a schedule aligned with the SP secret
expiry. Zero downtime — the existing credentials remain valid until the PATCH succeeds.

---

## DELETE — Decommissioning a Connection

```python
def delete_connection(access_token: str, connection_id: str) -> None:
    """
    Permanently delete an SCC. All downstream items referencing this connection ID
    will fail at runtime. Ensure all references are updated before calling.
    """
    resp = requests.delete(
        f"{_FABRIC_API}/connections/{connection_id}",
        headers=_headers(access_token),
    )
    if resp.status_code not in (200, 204):
        raise RuntimeError(
            f"Failed to delete connection {connection_id}: "
            f"HTTP {resp.status_code} — {resp.text}"
        )
```

Always run the blue-green migration pattern (below) before deleting. Never delete an SCC
that is still referenced by a live pipeline or notebook.

---

## Blue-Green SCC Migration

Use when replacing an SCC entirely — new server, new credential type, new service principal.
The old ID must remain live until all references are updated and validated.

```python
def migrate_connection(
    access_token: str,
    old_connection_id: str,
    new_display_name: str,
    new_source_type: str,
    new_path: str,
    new_credential_type: str,
    new_credentials_dict: dict,
    workspace_id: str,
    pipeline_ids: list[str],
    parameter_name: str = "SourceConnectionID",
    delete_old: bool = False,
) -> str:
    """
    1. Create new SCC alongside the old one.
    2. Update all pipeline definitions to reference the new ID.
    3. Optionally delete the old SCC.
    Returns the new connection ID.
    """
    # 1. Create new SCC
    new_conn = create_shareable_cloud_connection(
        access_token, new_display_name,
        new_source_type, new_path,
        new_credential_type, new_credentials_dict,
    )
    new_id = new_conn["id"]
    print(f"  Created new SCC: {new_id}")

    # 2. Update all pipeline definitions
    for pipeline_id in pipeline_ids:
        update_pipeline_connection_parameter(
            access_token, workspace_id, pipeline_id, parameter_name, new_id
        )
        print(f"  Updated pipeline {pipeline_id}")

    # 3. Clean up old SCC (only after validation)
    if delete_old:
        delete_connection(access_token, old_connection_id)
        print(f"  Deleted old SCC: {old_connection_id}")

    return new_id
```

**Migration runbook:**
1. Run with `delete_old=False` — new SCC live, old SCC still exists
2. Validate pipelines run successfully against the new connection
3. Re-run with `delete_old=True` — or delete manually once confident

---

## Audit — Connection Inventory and Role Report

```python
def audit_connections(access_token: str) -> list[dict]:
    """
    Return a full report of all visible connections and their role assignments.
    Write to a DataFrame or JSON file for compliance review.
    """
    report = []
    for conn in list_connections(access_token):
        conn_id = conn["id"]

        # Fetch role assignments for this connection
        ra_url = f"{_FABRIC_API}/connections/{conn_id}/roleAssignments"
        ra_resp = requests.get(ra_url, headers=_headers(access_token))
        role_assignments = ra_resp.json().get("value", []) if ra_resp.ok else []

        report.append({
            "id":               conn_id,
            "displayName":      conn["displayName"],
            "connectivityType": conn.get("connectivityType"),
            "sourceType":       conn.get("connectionDetails", {}).get("type"),
            "credentialType":   conn.get("credentialDetails", {}).get("credentialType"),
            "roles": [
                {
                    "principalId":   ra["principal"]["id"],
                    "principalType": ra["principal"]["type"],
                    "role":          ra["role"],
                }
                for ra in role_assignments
            ],
        })
    return report


def print_audit_report(access_token: str) -> None:
    report = audit_connections(access_token)
    for conn in sorted(report, key=lambda c: c["displayName"]):
        print(f"\n{conn['displayName']} ({conn['sourceType']} / {conn['credentialType']})")
        print(f"  ID: {conn['id']}")
        if conn["roles"]:
            for r in conn["roles"]:
                print(f"  {r['role']:20s} {r['principalType']:20s} {r['principalId']}")
        else:
            print("  (no role assignments)")
```

Run on a schedule (e.g. weekly Fabric pipeline) and write to a Delta table for trend analysis.

### Activity Log — SCC lifecycle events

Every SCC management action generates an audit event in the Fabric/Power BI Activity Log.

**Audited event names:**

| `Activity` value | Trigger |
|---|---|
| `CreateConnection` | New SCC created |
| `UpdateConnection` | SCC patched (credentials, display name, gateway) |
| `DeleteConnection` | SCC deleted |
| `ShareConnection` | Role assignment added or modified |
| `BindToGateway` | SCC attached to VNet or On-Premises Gateway |

**Log payload fields per event:**

| Field | Content |
|---|---|
| Actor | Entra ID UPN (human) or Service Principal ID (automation) |
| Item | Connection ID + display name |
| Target | Workspace ID (if applicable) + connection type (e.g. `Sql`, `Web`) |
| Timestamp | UTC ISO-8601 |
| IP Address | Source IP of the actor |

**Extract via Python (daily ingest to Delta):**

⚠️ **Prerequisites:** The Service Principal must have either the **Fabric Administrator** role in
Entra ID, or be explicitly enabled under Fabric Admin Portal → Tenant settings → Developer settings
→ **Allow service principals to use read-only admin APIs**.

⚠️ **24-hour hard limit:** The API will not accept a time window larger than one day. For 30-day
history, loop day-by-day. The field name for the event type is `Operation` (not `Activity`).

```python
import msal
import requests
from datetime import datetime, timedelta

_SCC_OPERATIONS = {
    "CreateConnection", "UpdateConnection", "DeleteConnection",
    "ShareConnection", "BindToGateway",
}

def fetch_scc_audit_events(
    client_id: str,
    client_secret: str,
    tenant_id: str,
    lookback_hours: int = 24,   # max 24 — API hard limit per call
) -> list[dict]:
    """
    Fetch SCC lifecycle events from the Fabric/Power BI Activity Log.
    Scope: https://analysis.windows.net/powerbi/api/.default (not api.fabric.microsoft.com)
    """
    app = msal.ConfidentialClientApplication(
        client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
        client_credential=client_secret,
    )
    token = app.acquire_token_for_client(
        scopes=["https://analysis.windows.net/powerbi/api/.default"]
    )["access_token"]
    hdrs = {"Authorization": f"Bearer {token}"}

    end   = datetime.utcnow()
    start = end - timedelta(hours=lookback_hours)
    url   = (
        "https://api.powerbi.com/v1.0/myorg/admin/activityevents"
        f"?startDateTime='{start.strftime('%Y-%m-%dT%H:%M:%S')}Z'"
        f"&endDateTime='{end.strftime('%Y-%m-%dT%H:%M:%S')}Z'"
    )

    all_events: list[dict] = []
    while url:
        resp = requests.get(url, headers=hdrs)
        if resp.status_code != 200:
            raise RuntimeError(f"Activity log request failed: HTTP {resp.status_code} — {resp.text}")
        data = resp.json()
        all_events.extend(data.get("activityEventEntities", []))
        url = data.get("continuationUri")

    return [e for e in all_events if e.get("Operation") in _SCC_OPERATIONS]


def save_audit_events_to_delta(events: list[dict], spark) -> None:
    """Write events to a daily-partitioned Delta table (Fabric Notebook context)."""
    if not events:
        return
    table_name = f"audit_connection_events_{datetime.utcnow().strftime('%Y%m%d')}"
    df = spark.createDataFrame(events)
    df.write.format("delta").mode("append").saveAsTable(table_name)
    print(f"Saved {len(events)} events to {table_name}")
```

**Key payload fields per event:**

| Field | Content |
|---|---|
| `Operation` | Event name (e.g. `CreateConnection`) |
| `UserId` | Entra UPN (human) or Service Principal ID (automation) |
| `ItemName` | SCC display name |
| `ObjectId` | Connection ID (GUID) |
| `CreationTime` | UTC ISO-8601 timestamp |

**Consumption paths:**
- **Compliance officers:** Microsoft Defender / Purview portal → Audit → filter on Power BI / Fabric activities
- **Data engineers:** Run `fetch_scc_audit_events()` daily from a Fabric pipeline; append to `control.SccAuditLog` Delta table; build a Power BI report for connection sprawl monitoring and change detection

**Important distinction — management vs data query auditing:**
The Activity Log records *management* events (who created/changed/deleted the connection).
It does **not** record individual queries made through the connection. To audit the actual SQL
or API calls routed through an SCC, enable auditing at the **source system** (e.g. Azure SQL
Database Auditing, ADLS diagnostic logs). The identity recorded in the source system log will
be the Service Principal or Workspace Identity established by the SCC — not the end user.

---

## Multi-Tenant Provisioning

For a multi-tenant SaaS deployment (ADR-031 three-repo pattern), each customer tenant needs
its own SCCs provisioned using that tenant's credentials.

```python
def provision_tenant_connections(
    tenant_configs: list[dict],  # [{tenant_id, client_id, client_secret, substitutions, group_ids}]
    manifest_path: str,
) -> dict[str, dict]:
    """
    Provision connections for each tenant using per-tenant service principals.
    Returns {tenant_id: {connection_name: connection_id}}.
    """
    results = {}
    for tenant in tenant_configs:
        # Each tenant has its own SP — build a separate MSAL app
        app = msal.ConfidentialClientApplication(
            tenant["client_id"],
            authority=f"https://login.microsoftonline.com/{tenant['tenant_id']}",
            client_credential=tenant["client_secret"],
        )
        token_result = app.acquire_token_for_client(
            scopes=["https://api.fabric.microsoft.com/.default"]
        )
        token = token_result["access_token"]

        ids = deploy_connections(
            manifest_path=manifest_path,
            env=tenant["env"],
            substitutions=tenant["substitutions"],
            group_object_ids=tenant["group_ids"],
            access_token=token,
        )
        results[tenant["tenant_id"]] = ids
        print(f"  Tenant {tenant['tenant_id']}: {len(ids)} connections provisioned")

    return results
```

Store per-tenant SP credentials in a Key Vault per tenant or in a central vault with
tenant-namespaced secret names (e.g. `fabric-sp-secret-{tenant_id}`).

---

## Advanced — OneLake Shortcuts via SCC

SCCs power Fabric **Shortcuts**, which virtualise external storage (S3, GCS, ADLS) inside a
Lakehouse without data movement. Spark and the SQL endpoint query the external data directly
through the SCC.

```python
def create_onelake_shortcut(
    access_token: str,
    workspace_id: str,
    lakehouse_id: str,
    shortcut_name: str,
    shortcut_path: str,        # path inside the lakehouse (e.g. "Tables/external_sales")
    target_type: str,          # "AdlsGen2", "AmazonS3", "GoogleCloudStorage"
    target_location: str,      # e.g. "https://account.dfs.core.windows.net/container/path"
    connection_id: str,        # SCC that holds the credentials for the external storage
) -> dict:
    """
    Create a OneLake shortcut backed by an SCC. The SCC must have the appropriate
    credential type for the target (e.g. Key or OAuth2 for ADLS, Key for S3).
    """
    url = (
        f"{_FABRIC_API}/workspaces/{workspace_id}/lakehouses/{lakehouse_id}/shortcuts"
    )
    payload = {
        "path":        shortcut_path,
        "name":        shortcut_name,
        "target": {
            "type":         target_type,
            "location":     target_location,
            "connectionId": connection_id,
        },
    }
    resp = requests.post(url, headers=_headers(access_token), json=payload)
    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Failed to create shortcut '{shortcut_name}': "
            f"HTTP {resp.status_code} — {resp.text}"
        )
    return resp.json()
```

Shortcuts created via API are managed the same as UI-created shortcuts. Deleting the SCC
breaks all shortcuts that reference it — always delete shortcuts before decommissioning
their backing connection.

---

## Tenant Governance Controls

These are admin-level settings in the Fabric Admin Portal that affect SCC behaviour
across the whole tenant. They are not configurable via REST API — they require a
Fabric Administrator in the portal.

| Setting | Location | Effect |
|---|---|---|
| **Share cloud connections** (on/off) | Tenant settings → Export and sharing | Disables `UserWithReshare` — prevents non-owners from resharing connections |
| Restrict sharing to specific groups | Tenant settings → Export and sharing | Only named Entra groups can reshare SCCs |
| **Data connection rules** | Admin center → Data connection rules | Enforce network routing — e.g. `*.database.windows.net` must route through VNet Gateway X |
| **Connection creation** | Tenant settings | Can restrict who may create new connections (e.g. only Fabric Administrators) |

Document which tenant settings are active in each environment. A connection that can be
created in Dev may fail in Prod if the Prod tenant has stricter policies.

**Activity log** — every SCC create/patch/delete/share event is recorded. Query via:
```
GET https://api.powerbi.com/v1.0/myorg/admin/activityevents?startDateTime=...&endDateTime=...
```
Filter on `Operation` values: `CreateConnection`, `UpdateConnection`, `DeleteConnection`,
`ShareConnection`, `BindToGateway`. Route to a Delta table for 90-day compliance retention.


