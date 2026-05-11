// Refresh Model
// Refreshes the entire semantic model using TMSL

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// Refresh type
// "automatic" - Let engine decide (recommended)
// "full" - Clear and reload all data + recalculate everything
// "calculate" - Recalculate only (no data reload)
// "dataOnly" - Reload all data without recalculating
// "clearValues" - Remove all data but keep structure
// "defragment" - Optimize storage (no data changes)
var refreshType = "full";

// ============================================================================
// BUILD AND EXECUTE TMSL
// ============================================================================

var databaseName = Model.Database.Name;

var tmsl = @"{
  ""refresh"": {
    ""type"": """ + refreshType + @""",
    ""objects"": [
      {
        ""database"": """ + databaseName + @"""
      }
    ]
  }
}";

try
{
    Info("Refreshing entire model: " + databaseName + "\n" +
         "Type: " + refreshType + "\n\n" +
         "This may take several minutes...");

    var startTime = DateTime.Now;

    ExecuteCommand(tmsl);

    var duration = DateTime.Now - startTime;

    Info("✓ Model refresh completed successfully\n\n" +
         "Database: " + databaseName + "\n" +
         "Refresh type: " + refreshType + "\n" +
         "Duration: " + duration.TotalMinutes.ToString("F1") + " minutes\n" +
         "Tables: " + Model.Tables.Count + "\n" +
         "Measures: " + Model.AllMeasures.Count);
}
catch (Exception ex)
{
    Error("✗ Model refresh failed:\n" + ex.Message + "\n\nDatabase: " + databaseName);
}
