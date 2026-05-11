// Apply Refresh Policy
// Applies incremental refresh policy to create/update partitions
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var tableName = "FactSales";

// Optional: Set effective date to override current date
// Leave null to use current date (recommended for production)
// Set to specific date for testing or historical scenarios
DateTime? effectiveDate = null;  // Example: new DateTime(2024, 12, 31)

// Refresh type when applying policy
// "full" - Full refresh of affected partitions (recommended)
// "automatic" - Let engine decide
var refreshType = "full";

// About Apply Refresh Policy:
// - Creates new partitions based on the policy configuration
// - Updates existing partitions if policy has changed
// - Refreshes data according to incremental/rolling window settings
// - Required after setting up or modifying a refresh policy
// - Use effectiveDate for testing scenarios or backfilling
// - May fail if data source is not accessible from current context

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

if (!table.EnableRefreshPolicy)
{
    Error("Table '" + tableName + "' does not have a refresh policy enabled.\n\n" +
          "Enable a refresh policy first using setup-incremental-refresh.csx");
}

var databaseName = Model.Database.Name;

// ============================================================================
// BUILD AND EXECUTE TMSL
// ============================================================================

var tmsl = @"{
  ""refresh"": {
    ""type"": """ + refreshType + @""",
    ""applyRefreshPolicy"": true";

// Add effectiveDate if specified
if (effectiveDate.HasValue)
{
    tmsl += @",
    ""effectiveDate"": """ + effectiveDate.Value.ToString("MM/dd/yyyy") + @"""";
}

tmsl += @",
    ""objects"": [
      {
        ""database"": """ + databaseName + @""",
        ""table"": """ + tableName + @"""
      }
    ]
  }
}";

// ============================================================================
// EXECUTE
// ============================================================================

try
{
    var message = "Applying refresh policy to table: " + tableName + "\n";
    message += "Refresh type: " + refreshType + "\n";

    if (effectiveDate.HasValue)
    {
        message += "Effective date: " + effectiveDate.Value.ToString("yyyy-MM-dd") + "\n";
    }
    else
    {
        message += "Effective date: Current date (default)\n";
    }

    message += "\nPolicy settings:\n";
    message += "  Rolling window: " + table.RollingWindowPeriods + " " + table.RollingWindowGranularity + "\n";
    message += "  Incremental periods: " + table.IncrementalPeriods + " " + table.IncrementalGranularity + "\n";

    if (table.IncrementalPeriodsOffset == -1)
    {
        message += "  Only refresh complete periods: Yes\n";
    }

    message += "\nExecuting TMSL...\n";

    Info(message);

    ExecuteCommand(tmsl);

    Info("Refresh policy applied successfully!\n\n" +
         "Table: " + tableName + "\n\n" +
         "Partitions have been created/updated based on the policy.\n" +
         "Check the table's partitions to verify the configuration.");
}
catch (Exception ex)
{
    var errorMsg = "Apply refresh policy failed: " + ex.Message + "\n\n" +
          "Table: " + tableName + "\n\n";

    // Check for common errors and provide helpful guidance
    if (ex.Message.Contains("Parameter substitution") || ex.Message.Contains("connection string"))
    {
        errorMsg += "Connection Error: Unable to access the data source.\n\n" +
                   "Possible causes:\n" +
                   "  Data source credentials not available in current context\n" +
                   "  Data source not accessible from XMLA endpoint\n" +
                   "  Shared expressions (#\"SqlEndpoint\", etc.) not properly configured\n\n" +
                   "Note: The refresh policy configuration is valid.\n" +
                   "Try applying the policy from within the Fabric workspace\n" +
                   "where the data source credentials are available.";
    }
    else if (ex.Message.Contains("RangeStart") || ex.Message.Contains("RangeEnd"))
    {
        errorMsg += "Parameter Error: RangeStart/RangeEnd parameters missing or incorrect.\n\n" +
                   "Ensure RangeStart and RangeEnd parameters exist and are referenced\n" +
                   "in the table's SourceExpression property.";
    }
    else
    {
        errorMsg += "Common issues:\n" +
                   "  RangeStart/RangeEnd parameters missing or incorrect\n" +
                   "  Source expression filter not properly configured\n" +
                   "  Connection to data source failed\n" +
                   "  Insufficient permissions";
    }

    Error(errorMsg);
}
