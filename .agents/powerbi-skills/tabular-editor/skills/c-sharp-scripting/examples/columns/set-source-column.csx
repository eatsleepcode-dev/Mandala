/*
 * Title: Set Source Column Names
 *
 * Description: Sets the SourceColumn property on DataColumns. This specifies
 * the name of the column from the data source that maps to this model column.
 * Useful when renaming columns in the model while preserving source mapping.
 *
 * Note: This property only applies to DataColumn (not CalculatedColumn).
 *
 * Usage: Configure source column mappings below.
 * CLI: te "workspace/model" set-source-column.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "Sales";

// Map: Model Column Name → Source Column Name
var sourceColumnMappings = new Dictionary<string, string>
{
    // Common pattern: Rename to business-friendly names
    { "CustomerKey", "customer_id" },
    { "ProductKey", "product_id" },
    { "OrderDate", "order_date" },
    { "ShipDate", "ship_date" },
    { "Revenue", "total_revenue" },
    { "Quantity", "order_quantity" },
    { "UnitPrice", "unit_price" },

    // Handle source columns with special characters
    { "DiscountPercent", "discount_pct" },
    { "IsActive", "is_active_flag" }
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var table = Model.Tables[tableName];
var updatedCount = 0;
var skippedCount = 0;

foreach(var entry in sourceColumnMappings)
{
    var modelColumnName = entry.Key;
    var sourceColumnName = entry.Value;

    if(!table.Columns.Contains(modelColumnName))
    {
        Info("⚠ Column not found: " + modelColumnName);
        continue;
    }

    var column = table.Columns[modelColumnName];

    // Check if this is a DataColumn (not CalculatedColumn)
    if(column is DataColumn)
    {
        var dataColumn = column as DataColumn;
        dataColumn.SourceColumn = sourceColumnName;
        updatedCount++;
        Info("✓ " + modelColumnName + " → " + sourceColumnName);
    }
    else
    {
        Info("⚠ Skipped (not a DataColumn): " + modelColumnName + " (type: " + column.GetType().Name + ")");
        skippedCount++;
    }
}

Info("\nUpdated SourceColumn for " + updatedCount + " columns in " + tableName);
if(skippedCount > 0)
{
    Info("Skipped " + skippedCount + " calculated columns (SourceColumn only applies to DataColumn)");
}

// ============================================================================
// NOTES
// ============================================================================

Info("\nIMPORTANT:");
Info("- SourceColumn must match the column name returned during refresh/processing");
Info("- Applies only to DataColumn (not CalculatedColumn, CalculatedTableColumn)");
Info("- Use when renaming model columns while preserving source mapping");
