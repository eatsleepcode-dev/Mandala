/*
 * Title: Set KeepUniqueRows Property
 *
 * Description: Controls whether grouping happens by key or by value for hierarchies.
 *
 * WHEN TO USE:
 * - Configure hierarchy behavior for dimensional modeling
 * - Control aggregation grouping in parent-child hierarchies
 * - Optimize query performance for specific hierarchy patterns
 * - Define whether duplicate values at different levels are treated separately
 *
 * TRUE: Group by key (each row is unique by key, even with duplicate values)
 * FALSE: Group by value (rows with same value are grouped together)
 *
 * Usage: Configure KeepUniqueRows settings below.
 * CLI: te "workspace/model" set-keep-unique-rows.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "DimEmployee";

// Map: Column Name → KeepUniqueRows
var keepUniqueRowsSettings = new Dictionary<string, bool>
{
    // TRUE: Treat each row as unique (even if values duplicate)
    { "EmployeeKey", true },     // Primary key - always unique
    { "ManagerKey", true },       // Foreign key - keep separate instances

    // FALSE: Group by value (duplicate values aggregate together)
    { "Department", false },      // Aggregate employees by department
    { "JobTitle", false },        // Aggregate employees by job title
    { "Location", false }         // Aggregate employees by location
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var table = Model.Tables[tableName];
var updatedCount = 0;

foreach(var entry in keepUniqueRowsSettings)
{
    var columnName = entry.Key;
    var keepUniqueRows = entry.Value;

    if(table.Columns.Contains(columnName))
    {
        table.Columns[columnName].KeepUniqueRows = keepUniqueRows;
        updatedCount++;

        var behavior = keepUniqueRows ? "by key (unique)" : "by value (aggregate)";
        Info("✓ " + columnName + " → Group " + behavior);
    }
    else
    {
        Info("⚠ Column not found: " + columnName);
    }
}

Info("\nConfigured KeepUniqueRows for " + updatedCount + " columns in " + tableName);

// ============================================================================
// NOTES
// ============================================================================

Info("\nKEEP UNIQUE ROWS:");
Info("  TRUE  - Each row treated as unique (by key)");
Info("          Use for: Keys, IDs, unique identifiers");
Info("  FALSE - Rows with same value grouped together");
Info("          Use for: Categorical attributes, grouping columns");
Info("");
Info("HIERARCHY IMPACT:");
Info("  - Affects how hierarchies aggregate and display data");
Info("  - Important for parent-child and ragged hierarchies");
