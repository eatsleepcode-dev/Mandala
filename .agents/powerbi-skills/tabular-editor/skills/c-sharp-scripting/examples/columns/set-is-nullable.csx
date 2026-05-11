/*
 * Title: Set Column IsNullable Property
 *
 * Description: Controls whether columns can contain null values.
 *
 * WHEN TO USE:
 * - Enforce data quality rules (required fields)
 * - Document expected data constraints
 * - Validate data integrity during refresh
 * - Improve query optimization by declaring non-null columns
 * - Support compliance and governance requirements
 *
 * NOTE: Key columns (IsKey = true) automatically set IsNullable = false
 *
 * Usage: Configure nullable settings below.
 * CLI: te "workspace/model" set-is-nullable.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "Sales";

// Map: Column Name → IsNullable
var nullableSettings = new Dictionary<string, bool>
{
    // Required fields (must not be null)
    { "OrderID", false },
    { "CustomerKey", false },
    { "ProductKey", false },
    { "OrderDate", false },
    { "Quantity", false },
    { "Revenue", false },

    // Optional fields (can be null)
    { "ShipDate", true },       // May not be shipped yet
    { "Comments", true },        // Optional text field
    { "DiscountPercent", true }, // May have no discount
    { "PromotionCode", true }    // Optional promotion
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var table = Model.Tables[tableName];
var updatedCount = 0;

foreach(var entry in nullableSettings)
{
    var columnName = entry.Key;
    var isNullable = entry.Value;

    if(table.Columns.Contains(columnName))
    {
        var column = table.Columns[columnName];

        // Check if this is a key column (can't override)
        if(column.IsKey && isNullable)
        {
            Info("⚠ Cannot set IsNullable = true for key column: " + columnName);
            continue;
        }

        column.IsNullable = isNullable;
        updatedCount++;

        var status = isNullable ? "nullable" : "NOT NULL";
        Info("✓ " + columnName + " → " + status);
    }
    else
    {
        Info("⚠ Column not found: " + columnName);
    }
}

Info("\nConfigured IsNullable for " + updatedCount + " columns in " + tableName);

// ============================================================================
// NOTES
// ============================================================================

Info("\nIMPORTANT:");
Info("  - IsNullable = false enforces NOT NULL constraint");
Info("  - IsNullable = true allows NULL values");
Info("  - Key columns (IsKey = true) are always non-nullable");
Info("  - Use for data quality validation during refresh");
Info("  - Helps document required vs optional fields");
