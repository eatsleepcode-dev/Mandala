// Test Relationship Integrity
// Validates that relationships have matching keys using DAX queries

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// Test mode: "single" or "all"
var testMode = "all";

// For single relationship testing
var fromTableName = "FactSales";
var fromColumnName = "CustomerKey";
var toTableName = "DimCustomer";
var toColumnName = "CustomerKey";

// Sample size for testing (0 = all rows, positive number = limit results)
var sampleSize = 100;

// ============================================================================
// TEST FUNCTION
// ============================================================================

string TestRelationship(SingleColumnRelationship rel)
{
    var fromTable = rel.FromColumn.Table.Name;
    var fromColumn = rel.FromColumn.Name;
    var toTable = rel.ToColumn.Table.Name;
    var toColumn = rel.ToColumn.Name;

    try
    {
        // Build DAX query to find orphaned keys
        var daxQuery = "EVALUATE\n" +
                      "TOPN(\n" +
                      "    " + sampleSize + ",\n" +
                      "    EXCEPT(\n" +
                      "        VALUES( '" + fromTable + "'[" + fromColumn + "] ),\n" +
                      "        VALUES( '" + toTable + "'[" + toColumn + "] )\n" +
                      "    )\n" +
                      ")";

        // Execute the query
        dynamic result = EvaluateDax(daxQuery);

        // Check if any violations found
        var rowCount = result.Rows.Count;

        if (rowCount == 0)
        {
            return "✓ PASS: " + fromTable + "[" + fromColumn + "] → " + toTable + "[" + toColumn + "]";
        }
        else
        {
            var violationSummary = "✗ FAIL: " + fromTable + "[" + fromColumn + "] → " + toTable + "[" + toColumn + "]\n" +
                                  "  Found " + rowCount + " orphaned key(s)";

            if (rowCount > 0 && rowCount <= 10)
            {
                // Show actual orphaned values if few enough
                violationSummary += "\n  Orphaned values:";
                for (int i = 0; i < rowCount; i++)
                {
                    violationSummary += "\n    - " + result.Rows[i][0];
                }
            }

            return violationSummary;
        }
    }
    catch (Exception ex)
    {
        return "⚠ ERROR: " + fromTable + "[" + fromColumn + "] → " + toTable + "[" + toColumn + "]\n" +
               "  " + ex.Message;
    }
}

// ============================================================================
// EXECUTE TESTS
// ============================================================================

var results = new System.Collections.Generic.List<string>();
var passCount = 0;
var failCount = 0;
var errorCount = 0;

if (testMode == "single")
{
    // Test single relationship
    if (!Model.Tables.Contains(fromTableName) || !Model.Tables.Contains(toTableName))
    {
        Error("Table not found: " + fromTableName + " or " + toTableName);
    }

    var fromColumn = Model.Tables[fromTableName].Columns[fromColumnName];
    var toColumn = Model.Tables[toTableName].Columns[toColumnName];

    var rel = Model.Relationships.OfType<SingleColumnRelationship>().FirstOrDefault(
        r => r.FromColumn == fromColumn && r.ToColumn == toColumn
    );

    if (rel == null)
    {
        Error("Relationship not found");
    }

    var result = TestRelationship(rel);
    results.Add(result);

    if (result.StartsWith("✓")) passCount++;
    else if (result.StartsWith("✗")) failCount++;
    else errorCount++;
}
else
{
    // Test all relationships
    var relationships = Model.Relationships.OfType<SingleColumnRelationship>().ToList();

    if (relationships.Count == 0)
    {
        Error("No relationships found in model");
    }

    foreach (var rel in relationships)
    {
        var result = TestRelationship(rel);
        results.Add(result);

        if (result.StartsWith("✓")) passCount++;
        else if (result.StartsWith("✗")) failCount++;
        else errorCount++;
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var summary = "Relationship Integrity Test Results\n" +
              "====================================\n\n" +
              "Total: " + results.Count + " relationship(s)\n" +
              "✓ Pass: " + passCount + "\n" +
              "✗ Fail: " + failCount + "\n" +
              "⚠ Error: " + errorCount + "\n\n" +
              "Details:\n" +
              string.Join("\n\n", results);

if (sampleSize > 0)
{
    summary += "\n\n(Limited to " + sampleSize + " violation(s) per relationship)";
}

Info(summary);
