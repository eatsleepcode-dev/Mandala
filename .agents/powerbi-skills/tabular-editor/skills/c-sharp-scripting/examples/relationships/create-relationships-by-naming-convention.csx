// Create Relationships by Naming Convention
// Automatically creates relationships based on column naming patterns

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// Naming pattern for foreign keys
// "suffix" = columns ending with pattern (e.g., "CustomerKey")
// "prefix" = columns starting with pattern (e.g., "FK_Customer")
var keyPattern = "suffix";
var keyIdentifier = "Key";  // e.g., "CustomerKey", "ProductKey"

// Table filters
var factTablePrefix = "Fact";  // Only process tables starting with this
var dimTablePrefix = "Dim";    // Look for dimension tables starting with this

// Relationship defaults
var makeActive = true;
var crossFilter = "SingleDirection";  // "SingleDirection" or "BothDirections"

// Skip if relationship already exists
var skipExisting = true;

// ============================================================================
// FIND AND CREATE RELATIONSHIPS
// ============================================================================

var created = new System.Collections.Generic.List<string>();
var skipped = new System.Collections.Generic.List<string>();
var errors = new System.Collections.Generic.List<string>();

// Get fact tables
var factTables = Model.Tables.Where(t => t.Name.StartsWith(factTablePrefix)).ToList();

foreach (var factTable in factTables)
{
    // Find foreign key columns
    var keyColumns = keyPattern == "suffix"
        ? factTable.Columns.Where(c => c.Name.EndsWith(keyIdentifier))
        : factTable.Columns.Where(c => c.Name.StartsWith(keyIdentifier));

    foreach (var keyColumn in keyColumns)
    {
        try
        {
            // Extract dimension table name from key column name
            string dimTableName;

            if (keyPattern == "suffix")
            {
                // Remove "Key" suffix: "CustomerKey" -> "Customer"
                var baseName = keyColumn.Name.Substring(0, keyColumn.Name.Length - keyIdentifier.Length);
                dimTableName = dimTablePrefix + baseName;
            }
            else
            {
                // Remove "FK_" prefix: "FK_Customer" -> "Customer"
                var baseName = keyColumn.Name.Substring(keyIdentifier.Length);
                dimTableName = dimTablePrefix + baseName;
            }

            // Check if dimension table exists
            if (!Model.Tables.Contains(dimTableName))
            {
                skipped.Add(factTable.Name + "[" + keyColumn.Name + "] - Dimension table not found: " + dimTableName);
                continue;
            }

            var dimTable = Model.Tables[dimTableName];

            // Find matching column in dimension table (usually same name)
            var dimColumn = dimTable.Columns.FirstOrDefault(c => c.Name == keyColumn.Name);

            if (dimColumn == null)
            {
                skipped.Add(factTable.Name + "[" + keyColumn.Name + "] - No matching column in " + dimTableName);
                continue;
            }

            // Check if relationship already exists
            var existingRel = Model.Relationships.FirstOrDefault(
                r => r.FromColumn == keyColumn && r.ToColumn == dimColumn
            );

            if (existingRel != null && skipExisting)
            {
                skipped.Add(factTable.Name + "[" + keyColumn.Name + "] → " + dimTableName + "[" + dimColumn.Name + "] - Already exists");
                continue;
            }

            // Create the relationship
            var rel = Model.AddRelationship();
            rel.FromColumn = keyColumn;
            rel.ToColumn = dimColumn;
            rel.FromCardinality = RelationshipEndCardinality.Many;
            rel.ToCardinality = RelationshipEndCardinality.One;
            rel.IsActive = makeActive;

            if (crossFilter == "BothDirections")
            {
                rel.CrossFilteringBehavior = CrossFilteringBehavior.BothDirections;
            }
            else
            {
                rel.CrossFilteringBehavior = CrossFilteringBehavior.OneDirection;
            }

            created.Add(factTable.Name + "[" + keyColumn.Name + "] → " + dimTableName + "[" + dimColumn.Name + "]");
        }
        catch (Exception ex)
        {
            errors.Add(factTable.Name + "[" + keyColumn.Name + "] - Error: " + ex.Message);
        }
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var summary = "Auto-Create Relationships Results\n" +
              "===================================\n\n" +
              "Pattern: " + keyPattern + " = '" + keyIdentifier + "'\n" +
              "Fact tables: " + factTablePrefix + "*\n" +
              "Dimension tables: " + dimTablePrefix + "*\n\n" +
              "✓ Created: " + created.Count + "\n" +
              "⊘ Skipped: " + skipped.Count + "\n" +
              "✗ Errors: " + errors.Count + "\n\n";

if (created.Count > 0)
{
    summary += "Created relationships:\n" + string.Join("\n", created) + "\n\n";
}

if (skipped.Count > 0)
{
    summary += "Skipped:\n" + string.Join("\n", skipped.Take(10));
    if (skipped.Count > 10)
    {
        summary += "\n... and " + (skipped.Count - 10) + " more";
    }
    summary += "\n\n";
}

if (errors.Count > 0)
{
    summary += "Errors:\n" + string.Join("\n", errors);
}

Info(summary);
