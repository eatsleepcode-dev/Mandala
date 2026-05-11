/*
 * Title: Set EncodingHint Property
 *
 * Description: Hints the server on numeric encoding strategy for optimization.
 *
 * WHEN TO USE:
 * - Optimize memory and performance for numeric columns on Azure Analysis Services or SQL Server Analysis Services
 * - Override automatic encoding when you know the data pattern better
 * - Value encoding: For columns with few distinct values (e.g., status codes, flags)
 * - Hash encoding: For high-cardinality numeric columns (e.g., IDs, keys)
 * - Improve compression ratios for large datasets
 * - Fine-tune query performance based on usage patterns
 *
 * IMPORTANT: Power BI IGNORES EncodingHint - it uses its own automatic encoding.
 * This property only affects Azure Analysis Services and SQL Server Analysis Services.
 * Setting this in Power BI models will have NO EFFECT.
 *
 * REQUIRES: Compatibility level 1400+
 *
 * Usage: Configure encoding hints below (only for AAS/SSAS models).
 * CLI: te "workspace/model" set-encoding-hint.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "FactSales";

// Map: Column Name → EncodingHint
// Valid values: Default, Value, Hash
var encodingHints = new Dictionary<string, EncodingHintType>
{
    // Value encoding: Few distinct values (better compression, faster aggregation)
    { "StatusCode", EncodingHintType.Value },        // e.g., 1, 2, 3 for Pending/Shipped/Completed
    { "PriorityLevel", EncodingHintType.Value },     // e.g., 1-5 priority levels
    { "IsPromotional", EncodingHintType.Value },     // Boolean stored as 0/1
    { "RegionID", EncodingHintType.Value },          // Limited number of regions

    // Hash encoding: High cardinality (better for unique values)
    { "OrderID", EncodingHintType.Hash },            // Unique order identifiers
    { "TransactionID", EncodingHintType.Hash },      // Unique transaction IDs
    { "CustomerKey", EncodingHintType.Hash },        // Many unique customers
    { "ProductKey", EncodingHintType.Hash }          // Many unique products
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var table = Model.Tables[tableName];
var updatedCount = 0;

foreach(var entry in encodingHints)
{
    var columnName = entry.Key;
    var encodingHint = entry.Value;

    if(table.Columns.Contains(columnName))
    {
        var column = table.Columns[columnName];

        // Verify this is a numeric column
        if(column.DataType == DataType.Int64 ||
           column.DataType == DataType.Decimal ||
           column.DataType == DataType.Double)
        {
            column.EncodingHint = encodingHint;
            updatedCount++;
            Info("✓ " + columnName + " → " + encodingHint);
        }
        else
        {
            Info("⚠ Skipped (not numeric): " + columnName + " (" + column.DataType + ")");
        }
    }
    else
    {
        Info("⚠ Column not found: " + columnName);
    }
}

Info("\nSet EncodingHint for " + updatedCount + " columns in " + tableName);

// ============================================================================
// REFERENCE
// ============================================================================

Info("\nENCODING HINT TYPES:");
Info("  Default - Let server auto-detect (recommended for most cases)");
Info("  Value   - For low-cardinality columns (few distinct values)");
Info("            Examples: Status codes, flags, categories (< 1000 values)");
Info("  Hash    - For high-cardinality columns (many unique values)");
Info("            Examples: IDs, keys, unique identifiers");
Info("");
Info("PERFORMANCE IMPACT:");
Info("  - Value encoding: Better compression, faster aggregations");
Info("  - Hash encoding: Better for point lookups and joins");
Info("  - Wrong encoding can hurt performance - test and measure!");
Info("");
Info("NOTE: Requires compatibility level 1400 or higher");
