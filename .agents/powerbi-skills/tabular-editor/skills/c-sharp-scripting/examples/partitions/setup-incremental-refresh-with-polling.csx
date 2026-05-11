// Setup Incremental Refresh with Polling Expression
// Configures incremental refresh with custom polling for detecting data changes

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "FactSales";
var dateColumnName = "OrderDate";

// Refresh windows
var refreshPeriods = 7;
var refreshGranularity = "Day";
var storagePeriods = 1095;
var storageGranularity = "Day";

// Polling expression for detecting data changes
var usePollingExpression = true;
var pollingExpressionType = "maxdate";  // "maxdate", "checksum", "custom"

// Custom polling expression (if pollingExpressionType = "custom")
var customPollingExpression = @"
let
    Source = FactSales,
    MaxDate = List.Max(Source[OrderDate])
in
    MaxDate";

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

if (!table.Columns.Contains(dateColumnName))
{
    Error("Date column not found: " + dateColumnName);
}

// ============================================================================
// CREATE RANGESTART/RANGEEND PARAMETERS
// ============================================================================

if (!Model.Expressions.Contains("RangeStart"))
{
    var rangeStart = Model.AddExpression("RangeStart");
    rangeStart.Kind = ExpressionKind.M;
    rangeStart.Expression = @"#datetime(2023, 1, 1, 0, 0, 0) meta
    [
        IsParameterQuery = true,
        IsParameterQueryRequired = true,
        Type = type datetime
    ]";
}

if (!Model.Expressions.Contains("RangeEnd"))
{
    var rangeEnd = Model.AddExpression("RangeEnd");
    rangeEnd.Kind = ExpressionKind.M;
    rangeEnd.Expression = @"#datetime(2025, 12, 31, 0, 0, 0) meta
    [
        IsParameterQuery = true,
        IsParameterQueryRequired = true,
        Type = type datetime
    ]";
}

// ============================================================================
// CONFIGURE REFRESH POLICY
// ============================================================================

table.EnableRefreshPolicy = true;

var refreshGranEnum = refreshGranularity == "Day" ? RefreshGranularityType.Day :
                      refreshGranularity == "Month" ? RefreshGranularityType.Month :
                      refreshGranularity == "Quarter" ? RefreshGranularityType.Quarter :
                      RefreshGranularityType.Year;

var storageGranEnum = storageGranularity == "Day" ? RefreshGranularityType.Day :
                      storageGranularity == "Month" ? RefreshGranularityType.Month :
                      storageGranularity == "Quarter" ? RefreshGranularityType.Quarter :
                      RefreshGranularityType.Year;

table.RefreshPolicy.IncrementalGranularity = refreshGranEnum;
table.RefreshPolicy.IncrementalPeriods = refreshPeriods;
table.RefreshPolicy.IncrementalPeriodsOffset = -1;

table.RefreshPolicy.RollingWindowGranularity = storageGranEnum;
table.RefreshPolicy.RollingWindowPeriods = storagePeriods;

table.RefreshPolicy.SourceExpression = dateColumnName;

// ============================================================================
// SETUP POLLING EXPRESSION
// ============================================================================

if (usePollingExpression)
{
    string pollingExpression = "";

    if (pollingExpressionType == "maxdate")
    {
        // Default: Check max date in the date column
        pollingExpression = @"
let
    Source = " + tableName + @",
    MaxDate = List.Max(Source[" + dateColumnName + @"])
in
    MaxDate";
    }
    else if (pollingExpressionType == "checksum")
    {
        // Alternative: Use checksum/row count to detect changes
        pollingExpression = @"
let
    Source = " + tableName + @",
    RowCount = Table.RowCount(Source)
in
    RowCount";
    }
    else if (pollingExpressionType == "custom")
    {
        pollingExpression = customPollingExpression;
    }

    table.RefreshPolicy.PollingExpression = pollingExpression;
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var summary = "Configured Incremental Refresh with Polling\n" +
              "============================================\n\n" +
              "Table: " + tableName + "\n" +
              "Date Column: " + dateColumnName + "\n\n" +
              "Refresh Window: " + refreshPeriods + " " + refreshGranularity + "(s)\n" +
              "Storage Window: " + storagePeriods + " " + storageGranularity + "(s)\n\n";

if (usePollingExpression)
{
    summary += "Polling Expression Type: " + pollingExpressionType + "\n" +
              "Polling Expression:\n" + table.RefreshPolicy.PollingExpression + "\n\n" +
              "Detect Data Changes: ENABLED\n" +
              "- Only refreshes partitions when polling expression value changes\n" +
              "- Reduces unnecessary refresh operations\n";
}
else
{
    summary += "Detect Data Changes: DISABLED\n" +
              "- All partitions in refresh window will be processed\n";
}

summary += "\nNEXT STEP: Add RangeStart/RangeEnd filter to M partition";

Info(summary);
