// Setup Custom Partitions
// Creates multiple custom partitions without incremental refresh

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "FactSales";
var partitioningScheme = "yearly";  // "yearly", "monthly", "quarterly", "custom"

// Date range for partitions
var startYear = 2020;
var endYear = 2024;

// M expression template (use {0} for start, {1} for end placeholders)
var mExpressionTemplate = @"
let
    Source = Sql.Database(""server.database.windows.net"", ""DatabaseName""),
    dbo_FactSales = Source{{[Schema=""dbo"",Item=""FactSales""]}}[Data],
    FilteredRows = Table.SelectRows(dbo_FactSales, each [OrderDate] >= {0} and [OrderDate] < {1})
in
    FilteredRows";

// Custom partition definitions (for "custom" scheme)
// Format: { Name, StartDate, EndDate }
var customPartitions = new[] {
    new { Name = "Q1_2024", Start = new DateTime(2024, 1, 1), End = new DateTime(2024, 4, 1) },
    new { Name = "Q2_2024", Start = new DateTime(2024, 4, 1), End = new DateTime(2024, 7, 1) },
    new { Name = "Q3_2024", Start = new DateTime(2024, 7, 1), End = new DateTime(2024, 10, 1) },
    new { Name = "Q4_2024", Start = new DateTime(2024, 10, 1), End = new DateTime(2025, 1, 1) }
};

// Delete existing partitions before creating new ones
var deleteExisting = true;

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

// ============================================================================
// DELETE EXISTING PARTITIONS
// ============================================================================

if (deleteExisting)
{
    var existingCount = table.Partitions.Count;
    foreach (var partition in table.Partitions.ToList())
    {
        partition.Delete();
    }
    Info("Deleted " + existingCount + " existing partition(s)");
}

// ============================================================================
// CREATE PARTITIONS
// ============================================================================

var createdPartitions = new System.Collections.Generic.List<string>();

if (partitioningScheme == "yearly")
{
    // One partition per year
    for (int year = startYear; year <= endYear; year++)
    {
        var partitionName = "Year_" + year;
        var startDate = new DateTime(year, 1, 1);
        var endDate = new DateTime(year + 1, 1, 1);

        var startDateExpr = "#datetime(" + startDate.Year + ", " + startDate.Month + ", " + startDate.Day + ", 0, 0, 0)";
        var endDateExpr = "#datetime(" + endDate.Year + ", " + endDate.Month + ", " + endDate.Day + ", 0, 0, 0)";

        var mExpression = mExpressionTemplate
            .Replace("{0}", startDateExpr)
            .Replace("{1}", endDateExpr);

        table.AddMPartition(partitionName, mExpression);
        createdPartitions.Add(partitionName);
    }
}
else if (partitioningScheme == "quarterly")
{
    // One partition per quarter
    for (int year = startYear; year <= endYear; year++)
    {
        for (int quarter = 1; quarter <= 4; quarter++)
        {
            var partitionName = "Q" + quarter + "_" + year;
            var startMonth = (quarter - 1) * 3 + 1;
            var startDate = new DateTime(year, startMonth, 1);
            var endDate = startDate.AddMonths(3);

            var startDateExpr = "#datetime(" + startDate.Year + ", " + startDate.Month + ", " + startDate.Day + ", 0, 0, 0)";
            var endDateExpr = "#datetime(" + endDate.Year + ", " + endDate.Month + ", " + endDate.Day + ", 0, 0, 0)";

            var mExpression = mExpressionTemplate
                .Replace("{0}", startDateExpr)
                .Replace("{1}", endDateExpr);

            table.AddMPartition(partitionName, mExpression);
            createdPartitions.Add(partitionName);
        }
    }
}
else if (partitioningScheme == "monthly")
{
    // One partition per month
    for (int year = startYear; year <= endYear; year++)
    {
        for (int month = 1; month <= 12; month++)
        {
            var partitionName = year + "_" + month.ToString("00");
            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var startDateExpr = "#datetime(" + startDate.Year + ", " + startDate.Month + ", " + startDate.Day + ", 0, 0, 0)";
            var endDateExpr = "#datetime(" + endDate.Year + ", " + endDate.Month + ", " + endDate.Day + ", 0, 0, 0)";

            var mExpression = mExpressionTemplate
                .Replace("{0}", startDateExpr)
                .Replace("{1}", endDateExpr);

            table.AddMPartition(partitionName, mExpression);
            createdPartitions.Add(partitionName);
        }
    }
}
else if (partitioningScheme == "custom")
{
    // Use custom partition definitions
    foreach (var partDef in customPartitions)
    {
        var startDateExpr = "#datetime(" + partDef.Start.Year + ", " + partDef.Start.Month + ", " + partDef.Start.Day + ", 0, 0, 0)";
        var endDateExpr = "#datetime(" + partDef.End.Year + ", " + partDef.End.Month + ", " + partDef.End.Day + ", 0, 0, 0)";

        var mExpression = mExpressionTemplate
            .Replace("{0}", startDateExpr)
            .Replace("{1}", endDateExpr);

        table.AddMPartition(partDef.Name, mExpression);
        createdPartitions.Add(partDef.Name);
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Custom Partitions Created\n" +
     "==========================\n\n" +
     "Table: " + tableName + "\n" +
     "Scheme: " + partitioningScheme + "\n" +
     "Partitions created: " + createdPartitions.Count + "\n\n" +
     "Partition names:\n" + string.Join("\n", createdPartitions.Take(20)) +
     (createdPartitions.Count > 20 ? "\n... and " + (createdPartitions.Count - 20) + " more" : "") + "\n\n" +
     "Benefits:\n" +
     "  - Parallel refresh of partitions\n" +
     "  - Selective refresh (only changed periods)\n" +
     "  - Better query performance (partition elimination)");
