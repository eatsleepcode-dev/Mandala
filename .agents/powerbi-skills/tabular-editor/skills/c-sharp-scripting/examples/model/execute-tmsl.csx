// Execute TMSL Command
// Executes arbitrary TMSL (Tabular Model Scripting Language) commands

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// TMSL command to execute (JSON format)
// Common commands: refresh, backup, restore, alter, create, delete, merge, sequence

var tmslCommand = @"{
  ""refresh"": {
    ""type"": ""automatic"",
    ""objects"": [
      {
        ""database"": """ + Model.Database.Name + @""",
        ""table"": ""FactSales""
      }
    ]
  }
}";

// Execute as XMLA instead of TMSL (rare)
var isXmla = false;

// ============================================================================
// COMMON TMSL EXAMPLES
// ============================================================================

// Example 1: Full refresh of entire model
/*
var tmslCommand = @"{
  ""refresh"": {
    ""type"": ""full"",
    ""objects"": [
      {
        ""database"": """ + Model.Database.Name + @"""
      }
    ]
  }
}";
*/

// Example 2: Refresh specific table
/*
var tmslCommand = @"{
  ""refresh"": {
    ""type"": ""automatic"",
    ""objects"": [
      {
        ""database"": """ + Model.Database.Name + @""",
        ""table"": ""FactSales""
      }
    ]
  }
}";
*/

// Example 3: Refresh specific partition
/*
var tmslCommand = @"{
  ""refresh"": {
    ""type"": ""full"",
    ""objects"": [
      {
        ""database"": """ + Model.Database.Name + @""",
        ""table"": ""FactSales"",
        ""partition"": ""FactSales_2024""
      }
    ]
  }
}";
*/

// Example 4: Calculate (recalc all calculated columns/tables)
/*
var tmslCommand = @"{
  ""refresh"": {
    ""type"": ""calculate"",
    ""objects"": [
      {
        ""database"": """ + Model.Database.Name + @"""
      }
    ]
  }
}";
*/

// Example 5: Clear values (removes data but keeps structure)
/*
var tmslCommand = @"{
  ""refresh"": {
    ""type"": ""clearValues"",
    ""objects"": [
      {
        ""database"": """ + Model.Database.Name + @""",
        ""table"": ""StagingTable""
      }
    ]
  }
}";
*/

// Example 6: Backup database
/*
var tmslCommand = @"{
  ""backup"": {
    ""database"": """ + Model.Database.Name + @""",
    ""file"": ""C:\\Backups\\Model_"" + DateTime.Now.ToString(""yyyyMMdd_HHmmss"") + @"".abf"",
    ""allowOverwrite"": true
  }
}";
*/

// ============================================================================
// EXECUTE TMSL
// ============================================================================

try
{
    Info("Executing TMSL command...\n\n" + tmslCommand);

    // Execute the TMSL command
    // Second parameter: true for XMLA, false for TMSL (default)
    ExecuteCommand(tmslCommand, isXmla);

    Info("✓ TMSL command executed successfully");
}
catch (Exception ex)
{
    Error("✗ TMSL execution failed:\n" + ex.Message);
}

// ============================================================================
// NOTES
// ============================================================================

// Refresh Types:
// - "automatic" : Let engine decide (recommended)
// - "full"      : Clear and reload all data
// - "calculate" : Recalculate computed objects only
// - "dataOnly"  : Reload data without recalc
// - "clearValues" : Remove data, keep structure
// - "defragment" : Optimize storage

// TMSL Reference:
// https://learn.microsoft.com/en-us/analysis-services/tmsl/tabular-model-scripting-language-tmsl-reference
