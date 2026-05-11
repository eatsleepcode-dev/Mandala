// Refresh Partitions by Pattern
// Batch refresh partitions across multiple tables using pattern matching

// ============================================================================
// CONFIGURATION
// ============================================================================

// Table filter
var tableMode = "single";  // "single", "pattern", "all"
var tableName = "FactSales";  // For single mode
var tablePattern = "Fact*";  // For pattern mode

// Partition filter
var partitionPattern = "*_2024*";  // Wildcard pattern for partition names

// Refresh type
var refreshType = "automatic";

// ============================================================================
// BUILD PARTITION LIST
// ============================================================================

var tablesToSearch = new System.Collections.Generic.List<Table>();

if (tableMode == "single")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }
    tablesToSearch.Add(Model.Tables[tableName]);
}
else if (tableMode == "pattern")
{
    var tableRegex = "^" + tablePattern.Replace("*", ".*").Replace("?", ".") + "$";
    tablesToSearch.AddRange(
        Model.Tables.Where(t =>
            System.Text.RegularExpressions.Regex.IsMatch(t.Name, tableRegex))
    );
}
else if (tableMode == "all")
{
    tablesToSearch.AddRange(Model.Tables);
}

// Find matching partitions
var partitionsToRefresh = new System.Collections.Generic.List<Partition>();
var partitionRegex = "^" + partitionPattern.Replace("*", ".*").Replace("?", ".") + "$";

foreach (var table in tablesToSearch)
{
    var matchingPartitions = table.Partitions.Where(p =>
        System.Text.RegularExpressions.Regex.IsMatch(p.Name, partitionRegex)
    );

    partitionsToRefresh.AddRange(matchingPartitions);
}

if (partitionsToRefresh.Count == 0)
{
    Error("No partitions found matching pattern: " + partitionPattern);
}

// ============================================================================
// BUILD AND EXECUTE TMSL
// ============================================================================

var databaseName = Model.Database.Name;
var tmslObjects = new System.Text.StringBuilder();
tmslObjects.Append("[");

for (int i = 0; i < partitionsToRefresh.Count; i++)
{
    var partition = partitionsToRefresh[i];

    if (i > 0) tmslObjects.Append(",");

    tmslObjects.Append(@"
      {
        ""database"": """ + databaseName + @""",
        ""table"": """ + partition.Table.Name + @""",
        ""partition"": """ + partition.Name + @"""
      }");
}

tmslObjects.Append(@"
    ]");

var tmsl = @"{
  ""refresh"": {
    ""type"": """ + refreshType + @""",
    ""objects"": " + tmslObjects.ToString() + @"
  }
}";

try
{
    // Group by table for reporting
    var byTable = partitionsToRefresh.GroupBy(p => p.Table.Name)
        .Select(g => g.Key + " (" + g.Count() + ")")
        .ToList();

    Info("Refreshing partitions matching pattern: " + partitionPattern + "\n\n" +
         "Tables affected: " + tablesToSearch.Count + "\n" +
         "Partitions to refresh: " + partitionsToRefresh.Count + "\n\n" +
         "Breakdown by table:\n" + string.Join("\n", byTable.Select(s => "  - " + s)));

    var startTime = DateTime.Now;

    ExecuteCommand(tmsl);

    var duration = DateTime.Now - startTime;

    Info("✓ Batch partition refresh completed\n\n" +
         "Pattern: " + partitionPattern + "\n" +
         "Partitions refreshed: " + partitionsToRefresh.Count + "\n" +
         "Tables affected: " + tablesToSearch.Count + "\n" +
         "Duration: " + duration.TotalSeconds.ToString("F1") + " seconds");
}
catch (Exception ex)
{
    Error("✗ Batch partition refresh failed:\n" + ex.Message);
}
