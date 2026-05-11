// Setup Hybrid Table
// Creates a table with both Import and DirectQuery partitions

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "FactSales";
var dateColumnName = "OrderDate";

// Hybrid configuration
// Import partitions: Recent data (last N days/months)
var importPeriods = 30;  // Keep last 30 days in memory
var importGranularity = "Day";  // "Day", "Month", "Year"

// DirectQuery partition: Historical data (everything older)
var directQueryName = "Historical";

// M expression template for partitions
// Use {0} for start date, {1} for end date placeholders
var mExpressionTemplate = @"
let
    Source = Sql.Database(""server.database.windows.net"", ""DatabaseName""),
    dbo_FactSales = Source{{[Schema=""dbo"",Item=""FactSales""]}}[Data],
    FilteredRows = Table.SelectRows(dbo_FactSales, each [OrderDate] >= {0} and [OrderDate] < {1})
in
    FilteredRows";

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

// ============================================================================
// CALCULATE PARTITION BOUNDARIES
// ============================================================================

var today = DateTime.Today;
var importStartDate = today.AddDays(-importPeriods);  // Adjust based on granularity

// ============================================================================
// CREATE IMPORT PARTITIONS
// ============================================================================

// Remove existing partitions
foreach (var partition in table.Partitions.ToList())
{
    partition.Delete();
}

// Create import partitions based on granularity
var importPartitions = new System.Collections.Generic.List<string>();

if (importGranularity == "Day")
{
    // One partition per day for recent data
    for (int i = 0; i < importPeriods; i++)
    {
        var partitionDate = today.AddDays(-i);
        var partitionName = "Import_" + partitionDate.ToString("yyyyMMdd");

        var startDate = "#datetime(" + partitionDate.Year + ", " + partitionDate.Month + ", " + partitionDate.Day + ", 0, 0, 0)";
        var endDate = "#datetime(" + partitionDate.AddDays(1).Year + ", " + partitionDate.AddDays(1).Month + ", " + partitionDate.AddDays(1).Day + ", 0, 0, 0)";

        var mExpression = mExpressionTemplate
            .Replace("{0}", startDate)
            .Replace("{1}", endDate);

        var partition = table.AddMPartition(partitionName, mExpression);
        partition.Mode = ModeType.Import;

        importPartitions.Add(partitionName);
    }
}
else if (importGranularity == "Month")
{
    // One partition per month for recent data
    var monthsToCreate = (int)Math.Ceiling((double)importPeriods / 30);

    for (int i = 0; i < monthsToCreate; i++)
    {
        var partitionMonth = today.AddMonths(-i);
        var firstDayOfMonth = new DateTime(partitionMonth.Year, partitionMonth.Month, 1);
        var partitionName = "Import_" + firstDayOfMonth.ToString("yyyyMM");

        var startDate = "#datetime(" + firstDayOfMonth.Year + ", " + firstDayOfMonth.Month + ", 1, 0, 0, 0)";
        var endDate = "#datetime(" + firstDayOfMonth.AddMonths(1).Year + ", " + firstDayOfMonth.AddMonths(1).Month + ", 1, 0, 0, 0)";

        var mExpression = mExpressionTemplate
            .Replace("{0}", startDate)
            .Replace("{1}", endDate);

        var partition = table.AddMPartition(partitionName, mExpression);
        partition.Mode = ModeType.Import;

        importPartitions.Add(partitionName);
    }
}

// ============================================================================
// CREATE DIRECTQUERY PARTITION (Historical Data)
// ============================================================================

var dqStartDate = "#datetime(2020, 1, 1, 0, 0, 0)";  // Historical data start
var dqEndDate = "#datetime(" + importStartDate.Year + ", " + importStartDate.Month + ", " + importStartDate.Day + ", 0, 0, 0)";

var dqMExpression = mExpressionTemplate
    .Replace("{0}", dqStartDate)
    .Replace("{1}", dqEndDate);

var dqPartition = table.AddMPartition(directQueryName, dqMExpression);
dqPartition.Mode = ModeType.DirectQuery;

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Hybrid Table Configuration Complete\n" +
     "====================================\n\n" +
     "Table: " + tableName + "\n" +
     "Mode: HYBRID (Import + DirectQuery)\n\n" +
     "Import Partitions: " + importPartitions.Count + "\n" +
     "  Coverage: Last " + importPeriods + " " + importGranularity.ToLower() + "(s)\n" +
     "  Names: " + string.Join(", ", importPartitions.Take(5)) +
     (importPartitions.Count > 5 ? "..." : "") + "\n\n" +
     "DirectQuery Partition: " + directQueryName + "\n" +
     "  Coverage: Historical data (before " + importStartDate.ToShortDateString() + ")\n\n" +
     "Benefits:\n" +
     "  - Recent data in memory (fast queries)\n" +
     "  - Historical data on-demand (no storage cost)\n" +
     "  - Queries combine both seamlessly");
