/*
 * Title: Set IsDefaultLabel Property
 *
 * Description: Marks a column to be included in the DisplayKey element in CSDL.
 * This designates the primary descriptive field for an entity.
 *
 * WHEN TO USE:
 * - Specify the main display name for an entity (product name, customer name)
 * - Improve entity representation in composite models
 * - Enable better default labeling in Power BI visualizations
 * - Support cross-report and cross-model entity references
 *
 * Usage: Configure default label columns below.
 * CLI: te "workspace/model" set-is-default-label.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Map: Table Name → Label Column Name
var defaultLabelColumns = new Dictionary<string, string>
{
    { "DimProduct", "ProductName" },
    { "DimCustomer", "CustomerName" },
    { "DimEmployee", "EmployeeName" },
    { "DimStore", "StoreName" },
    { "DimCategory", "CategoryName" },
    { "DimDate", "Date" }
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var updatedCount = 0;

foreach(var entry in defaultLabelColumns)
{
    var tableName = entry.Key;
    var labelColumnName = entry.Value;

    if(!Model.Tables.Contains(tableName))
    {
        Info("⚠ Table not found: " + tableName);
        continue;
    }

    var table = Model.Tables[tableName];

    if(!table.Columns.Contains(labelColumnName))
    {
        Info("⚠ Column not found: " + tableName + "[" + labelColumnName + "]");
        continue;
    }

    var column = table.Columns[labelColumnName];
    column.IsDefaultLabel = true;
    updatedCount++;

    Info("✓ Set default label: " + tableName + "[" + labelColumnName + "]");
}

Info("\nConfigured " + updatedCount + " default label columns");

// ============================================================================
// NOTES
// ============================================================================

Info("\nUSE CASES:");
Info("  - Primary display names for entities");
Info("  - Product names, customer names, employee names");
Info("  - Category descriptions");
Info("  - Date representations");
Info("");
Info("BEST PRACTICES:");
Info("  - Choose the most descriptive, user-friendly column");
Info("  - Only one column per table should be IsDefaultLabel = true");
Info("  - Use columns users would naturally identify the entity by");
Info("  - Improves cross-model entity representation");
