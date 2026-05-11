// Refresh Partition(s)
// Refreshes single partition, multiple partitions, or all partitions in a table

// ============================================================================
// CONFIGURATION
// ============================================================================

var refreshMode = "single";  // "single", "multiple", "all", "pattern"

// Single partition
var tableName = "FactSales";
var partitionName = "Year_2024";

// Multiple partitions (for "multiple" mode)
var partitionNames = new string[] { "Year_2023", "Year_2024", "Q1_2024" };

// Pattern matching (for "pattern" mode)
var partitionPattern = "Year_202*";  // Wildcard pattern

// Refresh type
var refreshType = "automatic";  // "automatic", "full", "dataOnly", "calculate"

// ============================================================================
// BUILD PARTITION LIST
// ============================================================================

var partitionsToRefresh = new System.Collections.Generic.List<Partition>();

if (refreshMode == "single")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    var table = Model.Tables[tableName];

    if (!table.Partitions.Contains(partitionName))
    {
        Error("Partition not found: " + partitionName + " in table " + tableName);
    }

    partitionsToRefresh.Add(table.Partitions[partitionName]);
}
else if (refreshMode == "multiple")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    var table = Model.Tables[tableName];

    foreach (var pName in partitionNames)
    {
        if (table.Partitions.Contains(pName))
        {
            partitionsToRefresh.Add(table.Partitions[pName]);
        }
        else
        {
            Info("Warning: Partition not found: " + pName);
        }
    }
}
else if (refreshMode == "all")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    var table = Model.Tables[tableName];
    partitionsToRefresh.AddRange(table.Partitions);
}
else if (refreshMode == "pattern")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    var table = Model.Tables[tableName];
    var regex = "^" + partitionPattern.Replace("*", ".*").Replace("?", ".") + "$";

    partitionsToRefresh.AddRange(
        table.Partitions.Where(p =>
            System.Text.RegularExpressions.Regex.IsMatch(p.Name, regex))
    );
}

if (partitionsToRefresh.Count == 0)
{
    Error("No partitions found to refresh");
}

// ============================================================================
// BUILD AND EXECUTE TMSL
// ============================================================================

var databaseName = Model.Database.Name;

// Build TMSL objects array
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
    Info("Refreshing " + partitionsToRefresh.Count + " partition(s)...\n\n" +
         "Partitions:\n" + string.Join("\n", partitionsToRefresh.Select(p => "  - " + p.Table.Name + "/" + p.Name).Take(10)) +
         (partitionsToRefresh.Count > 10 ? "\n  ... and " + (partitionsToRefresh.Count - 10) + " more" : ""));

    var startTime = DateTime.Now;

    ExecuteCommand(tmsl);

    var duration = DateTime.Now - startTime;

    Info("✓ Partition refresh completed\n\n" +
         "Partitions refreshed: " + partitionsToRefresh.Count + "\n" +
         "Refresh type: " + refreshType + "\n" +
         "Duration: " + duration.TotalSeconds.ToString("F1") + " seconds");
}
catch (Exception ex)
{
    Error("✗ Partition refresh failed:\n" + ex.Message);
}
