/*
 * Title: Set Column IsUnique Property
 *
 * Description: Marks columns that contain only unique values.
 *
 * WHEN TO USE:
 * - Document data uniqueness constraints
 * - Validate data quality (ensure no duplicates)
 * - Improve query optimization for unique columns
 * - Support data governance and constraint validation
 * - Identify candidate keys or alternate identifiers
 *
 * Usage: Configure unique constraints below.
 * CLI: te "workspace/model" set-is-unique.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "Customers";

// Columns that should contain unique values
var uniqueColumns = new[]
{
    "CustomerKey",      // Primary key
    "CustomerID",       // Alternate key
    "EmailAddress",     // Unique email
    "TaxID",           // Unique tax identifier
    "AccountNumber"     // Unique account number
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var table = Model.Tables[tableName];
var updatedCount = 0;

foreach(var columnName in uniqueColumns)
{
    if(table.Columns.Contains(columnName))
    {
        table.Columns[columnName].IsUnique = true;
        updatedCount++;
        Info("✓ Marked as unique: " + columnName);
    }
    else
    {
        Info("⚠ Column not found: " + columnName);
    }
}

Info("\nMarked " + updatedCount + " columns as unique in " + tableName);

// ============================================================================
// NOTES
// ============================================================================

Info("\nUSE CASES:");
Info("  - Primary and alternate keys");
Info("  - Email addresses");
Info("  - Social Security Numbers, Tax IDs");
Info("  - Account numbers, Customer IDs");
Info("  - License plate numbers, serial numbers");
Info("");
Info("IMPORTANT:");
Info("  - IsUnique is a constraint declaration, not enforcement");
Info("  - Use for documentation and validation");
Info("  - Helps optimize query performance");
