// Refresh Table
// Refreshes data in a specific table using TMSL

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

var tableName = "FactSales";

// Refresh type
// "automatic" - Let engine decide (recommended)
// "full" - Clear and reload all data
// "dataOnly" - Reload data without recalculating
// "calculate" - Recalculate only (no data reload)
var refreshType = "automatic";

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var databaseName = Model.Database.Name;

// ============================================================================
// BUILD AND EXECUTE TMSL
// ============================================================================

var tmsl = @"{
  ""refresh"": {
    ""type"": """ + refreshType + @""",
    ""objects"": [
      {
        ""database"": """ + databaseName + @""",
        ""table"": """ + tableName + @"""
      }
    ]
  }
}";

try
{
    Info("Refreshing table: " + tableName + "\nType: " + refreshType + "\n\nExecuting TMSL...");

    ExecuteCommand(tmsl);

    Info("✓ Table refresh completed successfully\n\n" +
         "Table: " + tableName + "\n" +
         "Refresh type: " + refreshType);
}
catch (Exception ex)
{
    Error("✗ Table refresh failed:\n" + ex.Message + "\n\nTable: " + tableName);
}
