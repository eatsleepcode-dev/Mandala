/*
 * Title: Set Column Descriptions
 *
 * Description: Adds documentation to columns for maintainability and governance.
 *
 * WHEN TO USE:
 * - Document column purpose and business meaning
 * - Provide context for report authors and analysts
 * - Support data governance and compliance
 * - Improve model maintainability
 * - Explain business rules, calculations, or transformations
 * - Document data lineage and source information
 *
 * Usage: Configure column descriptions below.
 * CLI: te "workspace/model" set-description.csx --file
 *
 * Non-interactive: Yes
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "Sales";

// Map: Column Name → Description
var columnDescriptions = new Dictionary<string, string>
{
    { "OrderID", "Unique order identifier from source ERP system" },
    { "CustomerKey", "Foreign key to DimCustomer dimension table" },
    { "ProductKey", "Foreign key to DimProduct dimension table" },
    { "OrderDate", "Date when customer placed the order" },
    { "ShipDate", "Date when order was shipped (may be null for pending orders)" },
    { "Revenue", "Total revenue amount in USD, calculated as Quantity × UnitPrice × (1 - DiscountPercent)" },
    { "Quantity", "Number of units ordered" },
    { "UnitPrice", "Price per unit at time of order" },
    { "DiscountPercent", "Discount percentage applied (0.00 to 1.00), may be null if no discount" },
    { "Cost", "Total cost of goods sold for this order" },
    { "Profit", "Calculated as Revenue - Cost" }
};

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var table = Model.Tables[tableName];
var updatedCount = 0;

foreach(var entry in columnDescriptions)
{
    var columnName = entry.Key;
    var description = entry.Value;

    if(table.Columns.Contains(columnName))
    {
        table.Columns[columnName].Description = description;
        updatedCount++;
        Info("✓ " + columnName);
    }
    else
    {
        Info("⚠ Column not found: " + columnName);
    }
}

Info("\nAdded descriptions to " + updatedCount + " columns in " + tableName);

// ============================================================================
// BEST PRACTICES
// ============================================================================

Info("\nDESCRIPTION BEST PRACTICES:");
Info("  - Include business meaning, not just technical details");
Info("  - Document calculation logic for derived columns");
Info("  - Specify units (USD, units, percentages, etc.)");
Info("  - Note nullable fields and their business meaning");
Info("  - Reference related tables for foreign keys");
Info("  - Document data lineage (source system, transformations)");
Info("  - Keep descriptions concise but informative");
