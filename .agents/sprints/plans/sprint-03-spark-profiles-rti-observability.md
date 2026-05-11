---
sprint: 3
title: "GAP-03 Spark resource profiles + GAP-06 RTI observability"
gaps: [GAP-03, GAP-06]
effort: M + L
status: blocked_on_sprint_2
score_before: 352
score_after_estimate: 363
adr_required: []
adr_update: [ADR-032, ADR-041]
branch: feature/gap-03-spark-profiles-gap-06-rti
prerequisite: Sprint 2 merged
---

# Sprint 3 — Spark resource profiles + RTI observability

## Goals

| Gap | Deliverable | Done when |
|-----|-------------|-----------|
| GAP-03 | `apply_layer_spark_config()` honours `ResourceProfileId` from `EnvironmentConfig` | 3 new tests in `test_nb_utils_config.py` green |
| GAP-03 | `EnvironmentConfig` seed has `ResourceProfileId` rows for Bronze and Gold | Seed test green |
| GAP-06 | `EnableRTIObservability` flag in `EnvironmentConfig` | Config test green |
| GAP-06 | `nb_log_event.py` emits to Eventstream when flag on; Delta write always occurs | 4 new tests in `test_nb_log_event.py` green |
| GAP-06 | `infrastructure/modules/rti-workspace.bicep` provisions KQL DB | Bicep lints clean |
| GAP-06 | `scripts/13-deploy-rti-observability.ps1` deploys Activator alert rules | Script runs in smoke env |
| GAP-06 | `azure-pipelines.yml` has optional `Deploy_RTI` stage | Pipeline YAML valid |

---

## GAP-03 — Spark resource profiles per workload

### TDD Cycle 1 — `apply_layer_spark_config` sets resource profile when ID present

**Write tests** — `tests/test_nb_utils_config.py`, class `TestApplyLayerSparkConfigResourceProfile`:

```python
class TestApplyLayerSparkConfigResourceProfile(unittest.TestCase):

    def _make_spark(self):
        spark = MagicMock()
        spark.sparkContext = MagicMock()
        return spark

    def test_sets_resource_profile_when_id_provided(self):
        spark = self._make_spark()
        nb_utils_config.apply_layer_spark_config(
            spark, layer="BRONZE", resource_profile_id="rp-memory-optimised"
        )
        spark.sparkContext.setLocalProperty.assert_any_call(
            "spark.fabric.resourceProfile", "rp-memory-optimised"
        )

    def test_no_resource_profile_call_when_id_is_none(self):
        spark = self._make_spark()
        nb_utils_config.apply_layer_spark_config(
            spark, layer="BRONZE", resource_profile_id=None
        )
        # setLocalProperty may be called for other config but NOT for resourceProfile
        calls = [str(c) for c in spark.sparkContext.setLocalProperty.call_args_list]
        self.assertFalse(any("resourceProfile" in c for c in calls))

    def test_no_resource_profile_call_when_id_omitted(self):
        spark = self._make_spark()
        nb_utils_config.apply_layer_spark_config(spark, layer="GOLD")
        calls = [str(c) for c in spark.sparkContext.setLocalProperty.call_args_list]
        self.assertFalse(any("resourceProfile" in c for c in calls))
```

Run → **RED** (`apply_layer_spark_config` has no `resource_profile_id` param).

**Implement** — `src/notebooks/nb_utils_config.py`:

```python
def apply_layer_spark_config(spark, layer: str, resource_profile_id: str | None = None) -> None:
    """
    Apply layer-specific Spark session options.

    resource_profile_id: optional Fabric Resource Profile ID. When provided,
    requests a specific executor profile (e.g. memory-optimised for Bronze,
    compute-optimised for Gold V-Order). Falls back to capacity default when None.
    """
    layer_upper = layer.upper()

    # Existing layer config (V-Order, optimiseWrite, etc.) — unchanged
    if layer_upper == "GOLD":
        spark.conf.set("spark.microsoft.delta.optimizeWrite.enabled", "true")
        spark.conf.set("spark.microsoft.delta.optimizeWrite.binSize", "1073741824")
        spark.conf.set("spark.sql.parquet.vorder.enabled", "true")
    elif layer_upper in ("BRONZE", "SILVER"):
        spark.conf.set("spark.microsoft.delta.optimizeWrite.enabled", "true")

    # Resource profile injection — no-op if None (backwards compatible)
    if resource_profile_id:
        spark.sparkContext.setLocalProperty(
            "spark.fabric.resourceProfile", resource_profile_id
        )
```

Run → **GREEN**.

---

### TDD Cycle 2 — `EnvironmentConfig` seed carries `ResourceProfileId` rows

```python
class TestResourceProfileSeed(unittest.TestCase):

    def _load_seed(self):
        import json, os
        with open(os.path.join(os.path.dirname(__file__), "../config/seed-dev.json")) as f:
            return json.load(f)

    def test_bronze_resource_profile_id_row_present(self):
        env_rows = self._load_seed()["Data"]["EnvironmentConfig"]
        names = [r["ParameterName"] for r in env_rows]
        self.assertIn("BronzeResourceProfileId", names)

    def test_gold_resource_profile_id_row_present(self):
        env_rows = self._load_seed()["Data"]["EnvironmentConfig"]
        names = [r["ParameterName"] for r in env_rows]
        self.assertIn("GoldResourceProfileId", names)

    def test_resource_profile_ids_are_null_in_dev(self):
        env_rows = self._load_seed()["Data"]["EnvironmentConfig"]
        for row in env_rows:
            if row["ParameterName"] in ("BronzeResourceProfileId", "GoldResourceProfileId"):
                self.assertIsNone(row["ParameterValue"])
```

**Implement** — `config/seed-dev.json`, add to `EnvironmentConfig`:

```json
{"EnvName": "dev", "ParameterName": "BronzeResourceProfileId", "ParameterValue": null,
 "Description": "Fabric Resource Profile ID for Bronze ingestion notebooks. Null = capacity default."},
{"EnvName": "dev", "ParameterName": "GoldResourceProfileId",   "ParameterValue": null,
 "Description": "Fabric Resource Profile ID for Gold V-Order notebooks. Null = capacity default."}
```

Prod seed (for reference in docs — not auto-deployed):

```json
{"EnvName": "prod", "ParameterName": "BronzeResourceProfileId", "ParameterValue": "rp-memory-optimised"},
{"EnvName": "prod", "ParameterName": "GoldResourceProfileId",   "ParameterValue": "rp-compute-optimised"}
```

---

## GAP-06 — RTI observability layer

### TDD Cycle 3 — `nb_log_event` emits to Eventstream when `EnableRTIObservability` is set

Read `src/notebooks/nb_log_event.py` to understand current `log_event` signature before implementing.

**Write tests** — `tests/test_nb_log_event.py`, class `TestRTIEventstreamEmit`:

```python
class TestRTIEventstreamEmit(unittest.TestCase):

    def _make_spark(self, rti_enabled: bool = True):
        spark = MagicMock()
        env_row = MagicMock()
        env_row.__iter__ = MagicMock(return_value=iter([
            ("EnableRTIObservability", "true" if rti_enabled else "false"),
            ("RTIEventstreamEndpoint", "https://eventstream.fabric.microsoft.com/api/streams/pes-abc"),
        ]))
        spark.sql.return_value.collect.return_value = [env_row]
        write_chain = MagicMock()
        spark.createDataFrame.return_value.write = write_chain
        write_chain.format.return_value = write_chain
        write_chain.mode.return_value = write_chain
        return spark

    def test_delta_write_always_occurs(self):
        spark = self._make_spark(rti_enabled=False)
        with patch("nb_log_event._emit_to_eventstream") as mock_emit:
            nb_log_event.log_control_event(spark, "db_control", {"status": "SUCCESS"})
        spark.createDataFrame.return_value.write.format.assert_called()
        mock_emit.assert_not_called()

    def test_eventstream_emit_called_when_rti_enabled(self):
        spark = self._make_spark(rti_enabled=True)
        with patch("nb_log_event._emit_to_eventstream") as mock_emit:
            nb_log_event.log_control_event(spark, "db_control", {"status": "SUCCESS"})
        mock_emit.assert_called_once()

    def test_eventstream_emit_not_called_when_rti_disabled(self):
        spark = self._make_spark(rti_enabled=False)
        with patch("nb_log_event._emit_to_eventstream") as mock_emit:
            nb_log_event.log_control_event(spark, "db_control", {"status": "SUCCESS"})
        mock_emit.assert_not_called()

    def test_eventstream_failure_does_not_prevent_delta_write(self):
        spark = self._make_spark(rti_enabled=True)
        with patch("nb_log_event._emit_to_eventstream", side_effect=Exception("network error")):
            # Should not raise — Eventstream is best-effort
            nb_log_event.log_control_event(spark, "db_control", {"status": "SUCCESS"})
        spark.createDataFrame.return_value.write.format.assert_called()
```

Run → **RED**.

**Implement** — `src/notebooks/nb_log_event.py`, add RTI emit path:

```python
import requests as _requests

def _emit_to_eventstream(endpoint: str, event: dict) -> None:
    """Best-effort POST to an Eventstream custom endpoint. Never raises."""
    try:
        _requests.post(endpoint, json=event, timeout=5)
    except Exception:
        pass  # Eventstream is observability-only; never block the pipeline


def log_control_event(spark, control_lh: str, event: dict) -> None:
    """
    Write a control log event to the ControlLog Delta table.
    If EnableRTIObservability=true in EnvironmentConfig, also emit to Eventstream.
    """
    # ── Delta write (always) ────────────────────────────────────────────────
    df = spark.createDataFrame([event])
    (df.write
       .format("delta")
       .mode("append")
       .saveAsTable(f"{control_lh}.control.ControlLog"))

    # ── RTI Eventstream emit (best-effort, optional) ─────────────────────────
    try:
        env = {r["ParameterName"]: r["ParameterValue"]
               for r in spark.sql(
                   f"SELECT ParameterName, ParameterValue "
                   f"FROM {control_lh}.control.EnvironmentConfig"
               ).collect()}
        if env.get("EnableRTIObservability", "false").lower() == "true":
            endpoint = env.get("RTIEventstreamEndpoint", "")
            if endpoint:
                _emit_to_eventstream(endpoint, event)
    except Exception:
        pass  # never let observability path break the pipeline
```

Run → **GREEN**.

---

### TDD Cycle 4 — `EnvironmentConfig` seed has RTI flag rows

```python
def test_rti_observability_flag_in_seed(self):
    env_rows = self._load_seed()["Data"]["EnvironmentConfig"]
    names = [r["ParameterName"] for r in env_rows]
    self.assertIn("EnableRTIObservability", names)
    self.assertIn("RTIEventstreamEndpoint", names)
```

**Implement** — `config/seed-dev.json`:

```json
{"EnvName": "dev", "ParameterName": "EnableRTIObservability",   "ParameterValue": "false",
 "Description": "Set to 'true' to emit ControlLog events to the RTI Eventstream endpoint."},
{"EnvName": "dev", "ParameterName": "RTIEventstreamEndpoint",   "ParameterValue": null,
 "Description": "Custom Eventstream ingestion URL. Required when EnableRTIObservability=true."}
```

---

### RTI infrastructure — `infrastructure/modules/rti-workspace.bicep`

```bicep
// infrastructure/modules/rti-workspace.bicep
// Provisions a KQL Database (PeggyTelemetry) for RTI observability.
// Gated behind EnableRTIObservability feature flag — deploy only when needed.

param workspaceName string
param location string = resourceGroup().location
param kqlDatabaseName string = 'PeggyTelemetry'

resource kqlDatabase 'Microsoft.Kusto/clusters/databases@2023-08-15' = {
  // Note: KQL Database in Fabric is provisioned via Fabric REST API, not ARM.
  // This Bicep module is a placeholder — use scripts/13-deploy-rti-observability.ps1
  // to call the Fabric Items API directly.
  name: '${workspaceName}/${kqlDatabaseName}'
  location: location
  kind: 'ReadWrite'
  properties: {
    softDeletePeriod: 'P365D'
    hotCachePeriod: 'P31D'
  }
}

output kqlDatabaseId string = kqlDatabase.id
output kqlDatabaseName string = kqlDatabaseName
```

### RTI deployment — `scripts/13-deploy-rti-observability.ps1`

```powershell
# scripts/13-deploy-rti-observability.ps1
# Deploy RTI observability: KQL Database + Activator alert rules via Fabric REST API.
# Pre-condition: EnableRTIObservability=true in EnvironmentConfig.

param(
    [Parameter(Mandatory)][string]$WorkspaceId,
    [Parameter(Mandatory)][string]$Token,
    [string]$KqlDatabaseName = "PeggyTelemetry",
    [string]$EventstreamName = "ControlLogStream"
)

$headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
$base    = "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId"

# 1. Create KQL Database
Write-Host "[1/3] Creating KQL Database: $KqlDatabaseName"
$kqlBody = @{ displayName = $KqlDatabaseName; type = "KQLDatabase" } | ConvertTo-Json
$kql = Invoke-RestMethod "$base/kqlDatabases" -Method Post -Headers $headers -Body $kqlBody
Write-Host "  KQL Database ID: $($kql.id)"

# 2. Create Eventstream
Write-Host "[2/3] Creating Eventstream: $EventstreamName"
$esBody = @{ displayName = $EventstreamName; type = "Eventstream" } | ConvertTo-Json
$es = Invoke-RestMethod "$base/eventstreams" -Method Post -Headers $headers -Body $esBody
Write-Host "  Eventstream ID: $($es.id)"

# 3. Create Activator alert rules (anomaly detection on job duration)
Write-Host "[3/3] Configuring Activator alert rules"
$alertBody = @{
    displayName = "PeggyJobDurationAnomaly"
    type = "Activator"
    definition = @{
        rules = @(
            @{
                name       = "DurationRegression2Sigma"
                condition  = "avg(ElapsedSeconds) > baseline_avg + 2 * baseline_stddev over 60d"
                action     = "SendEmail"
                recipients = @("platform-alerts@delawaredev.co.uk")
            }
        )
    }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod "$base/activators" -Method Post -Headers $headers -Body $alertBody | Out-Null

Write-Host "[OK] RTI observability deployed."
Write-Host "Update EnvironmentConfig: RTIEventstreamEndpoint = <custom-endpoint-url-from-eventstream>"
```

### `azure-pipelines.yml` — optional Deploy_RTI stage

```yaml
# Add after Deploy_Prod stage, gated on variable:
- stage: Deploy_RTI
  displayName: 'Deploy RTI Observability (optional)'
  condition: and(succeeded(), eq(variables['ENABLE_RTI_OBSERVABILITY'], 'true'))
  dependsOn: Deploy_Prod
  jobs:
    - job: DeployRTI
      steps:
        - task: AzurePowerShell@5
          inputs:
            azureSubscription: $(SERVICE_CONNECTION)
            ScriptPath: scripts/13-deploy-rti-observability.ps1
            ScriptArguments: >
              -WorkspaceId $(PROD_WORKSPACE_GUID)
              -Token $(FABRIC_BEARER_TOKEN)
```

---

## Definition of Done

- [ ] `pytest tests/test_nb_utils_config.py -k "ResourceProfile"` — green
- [ ] `pytest tests/test_nb_log_event.py -k "RTI"` — green
- [ ] `pytest tests/` — full suite green
- [ ] `config/seed-dev.json` has `BronzeResourceProfileId`, `GoldResourceProfileId`, `EnableRTIObservability`, `RTIEventstreamEndpoint`
- [ ] `infrastructure/modules/rti-workspace.bicep` passes `az bicep build` lint
- [ ] `scripts/13-deploy-rti-observability.ps1` runs in smoke workspace (with `ENABLE_RTI_OBSERVABILITY=true`)
- [ ] `azure-pipelines.yml` `Deploy_RTI` stage present and gated on variable
