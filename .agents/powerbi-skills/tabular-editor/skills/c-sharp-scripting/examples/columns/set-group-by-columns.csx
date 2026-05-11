/*
 * Title: Set Group By Columns
 *
 * Description: Configures the GroupByColumns property for field parameters.
 * When a column is used in visuals, Power BI will automatically group by
 * the columns in this collection as well.
 *
 * Primary use case: Field parameters (dynamic column selection)
 *
 * Usage: Configure group-by relationships below.
 * CLI: te "workspace/model" set-group-by-columns.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "Field Parameter";

// Map: Display Column → GroupBy Column
// When display column is used, also group by the specified column
var groupByMappings = new Dictionary<string, string>
{
    // Field parameter pattern: Name column groups by Fields column
    { "Field Parameter", "Field Parameter Fields" }
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var table = Model.Tables[tableName];
var updatedCount = 0;

foreach(var entry in groupByMappings)
{
    var displayColumnName = entry.Key;
    var groupByColumnName = entry.Value;

    // Validate both columns exist
    if(!table.Columns.Contains(displayColumnName))
    {
        Info("⚠ Display column not found: " + displayColumnName);
        continue;
    }

    if(!table.Columns.Contains(groupByColumnName))
    {
        Info("⚠ GroupBy column not found: " + groupByColumnName);
        continue;
    }

    var displayColumn = table.Columns[displayColumnName];
    var groupByColumn = table.Columns[groupByColumnName];

    // Add to GroupByColumns collection (if not already present)
    if(!displayColumn.GroupByColumns.Contains(groupByColumn))
    {
        displayColumn.GroupByColumns.Add(groupByColumn);
        updatedCount++;
        Info("✓ " + displayColumnName + " will group by " + groupByColumnName);
    }
    else
    {
        Info("⚠ Already configured: " + displayColumnName + " → " + groupByColumnName);
    }
}

Info("\nConfigured GroupByColumns for " + updatedCount + " columns in " + tableName);

// ============================================================================
// FIELD PARAMETER COMPLETE CONFIGURATION EXAMPLE
// ============================================================================

Info("\nFIELD PARAMETER PATTERN:");
Info("For proper field parameters, you need:");
Info("  1. Name column (display)");
Info("  2. Fields column (DAX expression, hidden)");
Info("  3. Order column (sort order, hidden)");
Info("");
Info("Configuration:");
Info("  nameColumn.SortByColumn = orderColumn;");
Info("  nameColumn.GroupByColumns.Add(fieldColumn);");
Info("  fieldColumn.SortByColumn = orderColumn;");
Info("  fieldColumn.IsHidden = true;");
Info("  fieldColumn.SetExtendedProperty(\"ParameterMetadata\", \"{...}\", ExtendedPropertyType.Json);");
Info("  orderColumn.IsHidden = true;");

// ============================================================================
// NOTES
// ============================================================================

Info("\nNOTE:");
Info("- GroupByColumns is primarily used for field parameters");
Info("- When the display column is used in a visual, Power BI automatically");
Info("  groups by columns in the GroupByColumns collection");
Info("- See add-field-parameter.csx for complete field parameter setup");
