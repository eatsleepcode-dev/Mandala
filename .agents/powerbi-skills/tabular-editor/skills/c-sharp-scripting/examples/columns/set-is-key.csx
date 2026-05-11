/*
 * Title: Set Column IsKey Property
 *
 * Description: Marks columns as table keys for referential integrity.
 *
 * WHEN TO USE:
 * - Define primary key columns for dimension tables
 * - Improve query performance by marking unique identifiers
 * - Maintain referential integrity in relationships
 * - Enable Power BI to optimize join operations
 * - Document table structure for governance
 *
 * NOTE: Marking a column as IsKey automatically sets IsNullable = false
 *
 * Usage: Configure key columns below.
 * CLI: te "workspace/model" set-is-key.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Map: Table Name → Key Column Name
var tableKeys = new Dictionary<string, string>
{
    { "DimCustomer", "CustomerKey" },
    { "DimProduct", "ProductKey" },
    { "DimDate", "DateKey" },
    { "DimStore", "StoreKey" },
    { "DimEmployee", "EmployeeKey" }
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var updatedCount = 0;

foreach(var entry in tableKeys)
{
    var tableName = entry.Key;
    var keyColumnName = entry.Value;

    if(!Model.Tables.Contains(tableName))
    {
        Info("⚠ Table not found: " + tableName);
        continue;
    }

    var table = Model.Tables[tableName];

    if(!table.Columns.Contains(keyColumnName))
    {
        Info("⚠ Column not found: " + tableName + "[" + keyColumnName + "]");
        continue;
    }

    var column = table.Columns[keyColumnName];
    column.IsKey = true;
    column.IsHidden = true;  // Best practice: hide key columns from report view
    column.SummarizeBy = AggregateFunction.None;
    updatedCount++;

    Info("✓ Set as key: " + tableName + "[" + keyColumnName + "]");
}

Info("\nMarked " + updatedCount + " columns as keys");

// ============================================================================
// NOTES
// ============================================================================

Info("\nBEST PRACTICES:");
Info("  - IsKey = true automatically sets IsNullable = false");
Info("  - Key columns should typically be hidden from reports");
Info("  - Set SummarizeBy = None for key columns");
Info("  - Use for dimension table primary keys");
Info("  - Improves relationship and query performance");
