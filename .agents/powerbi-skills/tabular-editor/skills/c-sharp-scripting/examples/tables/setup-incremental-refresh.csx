// Setup Incremental Refresh
// Configures incremental refresh policy for a table with RangeStart/RangeEnd parameters
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

var tableName = "FactSales";
var dateColumnName = "OrderDate";  // Column name in the table (not DAX reference)

// Refresh window (how much recent data to refresh - use finer granularity)
var refreshPeriods = 30;             // Number of periods
var refreshGranularity = "Day";      // "Day", "Month", "Quarter", "Year"

// Storage window (how much historical data to keep - use coarser granularity for better compression)
var storagePeriods = 5;              // Number of periods
var storageGranularity = "Year";     // "Day", "Month", "Quarter", "Year"

// Advanced options
var incrementalPeriodsOffset = -1;   // Refresh complete periods only (-1 = include partial current period)

// RangeStart/RangeEnd default values
var rangeStartDefault = "#datetime(2020, 1, 1, 0, 0, 0)";
var rangeEndDefault = "#datetime(2025, 12, 31, 0, 0, 0)";

// ============================================================================
// VALIDATION
// ============================================================================

Info("=== Validating Configuration ===");

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

if (!table.Columns.Contains(dateColumnName))
{
    Error("Date column not found in table " + tableName + ": " + dateColumnName);
}

var dateColumn = table.Columns[dateColumnName];

if (dateColumn.DataType != DataType.DateTime)
{
    Error("Column is not DateTime type: " + dateColumnName + " (type: " + dateColumn.DataType + ")");
}

Info("Table: " + tableName);
Info("Date column: " + dateColumnName + " (DateTime)");

// Validate that table has an M partition
var partition = table.Partitions[0] as MPartition;
if (partition == null)
{
    Error("Table does not have an M partition. Incremental refresh requires M partitions.");
}

// ============================================================================
// CREATE RANGESTART AND RANGEEND PARAMETERS
// ============================================================================

Info("");
Info("=== Creating RangeStart and RangeEnd Parameters ===");

var rangeStartExists = Model.Expressions.Contains("RangeStart");
var rangeEndExists = Model.Expressions.Contains("RangeEnd");

if (!rangeStartExists)
{
    var rangeStart = Model.AddExpression("RangeStart");
    rangeStart.Kind = ExpressionKind.M;
    rangeStart.Expression = rangeStartDefault + @" meta
    [
        IsParameterQuery = true,
        IsParameterQueryRequired = true,
        Type = type datetime
    ]";
    Info("Created RangeStart parameter");
}
else
{
    Info("RangeStart parameter already exists");
}

if (!rangeEndExists)
{
    var rangeEnd = Model.AddExpression("RangeEnd");
    rangeEnd.Kind = ExpressionKind.M;
    rangeEnd.Expression = rangeEndDefault + @" meta
    [
        IsParameterQuery = true,
        IsParameterQueryRequired = true,
        Type = type datetime
    ]";
    Info("Created RangeEnd parameter");
}
else
{
    Info("RangeEnd parameter already exists");
}

// ============================================================================
// UPDATE SOURCE EXPRESSION WITH RANGESTART/RANGEEND FILTER
// ============================================================================

Info("");
Info("=== Building Source Expression with RangeStart/RangeEnd Filter ===");

var originalExpression = partition.Expression;

// Find the last step name in the M expression (the final "in X" statement)
var inIndex = originalExpression.LastIndexOf("in");
if (inIndex == -1)
{
    Error("Could not find 'in' clause in M expression. Unable to add filter automatically.");
}

// Extract the last step name (everything after "in" and before any newline/end)
var lastStepStart = inIndex + 2;  // Skip "in"
var lastStepName = originalExpression.Substring(lastStepStart).Trim();

// Remove any trailing comments or whitespace
if (lastStepName.Contains("\r") || lastStepName.Contains("\n"))
{
    var endLine = lastStepName.IndexOfAny(new char[] {'\r', '\n'});
    if (endLine > 0)
    {
        lastStepName = lastStepName.Substring(0, endLine).Trim();
    }
}

Info("Detected last step: " + lastStepName);

// Build the new M expression by adding a filter step before the final "in" clause
var beforeIn = originalExpression.Substring(0, inIndex).TrimEnd();

// Add the filter step
var filterStep = "    #\"Filtered Rows\" = Table.SelectRows(" + lastStepName + ", each [" + dateColumnName + "] >= RangeStart and [" + dateColumnName + "] < RangeEnd)";

var modifiedExpression = beforeIn + ",\r\n" + filterStep + "\r\nin\r\n    #\"Filtered Rows\"";

Info("Added RangeStart/RangeEnd filter to M expression");

// ============================================================================
// CONFIGURE INCREMENTAL REFRESH POLICY
// ============================================================================

Info("");
Info("=== Configuring Incremental Refresh Policy ===");

table.EnableRefreshPolicy = true;

// Map granularity strings to enum values
var refreshGranEnum = refreshGranularity == "Day" ? RefreshGranularityType.Day :
                      refreshGranularity == "Month" ? RefreshGranularityType.Month :
                      refreshGranularity == "Quarter" ? RefreshGranularityType.Quarter :
                      refreshGranularity == "Year" ? RefreshGranularityType.Year :
                      RefreshGranularityType.Day;

var storageGranEnum = storageGranularity == "Day" ? RefreshGranularityType.Day :
                      storageGranularity == "Month" ? RefreshGranularityType.Month :
                      storageGranularity == "Quarter" ? RefreshGranularityType.Quarter :
                      storageGranularity == "Year" ? RefreshGranularityType.Year :
                      RefreshGranularityType.Day;

// Configure refresh policy properties directly on table
table.IncrementalGranularity = refreshGranEnum;
table.IncrementalPeriods = refreshPeriods;
table.IncrementalPeriodsOffset = incrementalPeriodsOffset;

table.RollingWindowGranularity = storageGranEnum;
table.RollingWindowPeriods = storagePeriods;

// Set SourceExpression to the modified M expression with RangeStart/RangeEnd filter
table.SourceExpression = modifiedExpression;

// Set polling expression for change detection
table.PollingExpression = "List.Max(" + table.Name + "[" + dateColumnName + "])";

Info("Refresh policy configured:");
Info("  Refresh window: " + refreshPeriods + " " + refreshGranularity + "(s)");
Info("  Storage window: " + storagePeriods + " " + storageGranularity + "(s)");
Info("  Source column: " + dateColumnName);

// ============================================================================
// SUMMARY
// ============================================================================

Info("");
Info("=== Configuration Complete ===");
Info("Incremental refresh policy has been configured for: " + tableName);
Info("");
Info("Expected partition structure:");
Info("  ~" + refreshPeriods + " " + refreshGranularity + " partitions (recent data)");
Info("  ~" + storagePeriods + " " + storageGranularity + " partitions (historical data)");
Info("");
Info("Next Step: Use apply-refresh-policy.csx to create the partitions");
