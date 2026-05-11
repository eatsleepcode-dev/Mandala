// Find Referential Integrity Violations
// Identifies orphaned foreign keys across all relationships
// Exports results for data quality investigation

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// Output format: "info" (Info popup), "csv" (export to file), or "both"
var outputFormat = "both";

// CSV export path (if using "csv" or "both")
var csvFilePath = @"C:\Temp\ri_violations.csv";

// Maximum violations to show per relationship in Info popup
var maxViolationsToShow = 10;

// ============================================================================
// COLLECT VIOLATIONS
// ============================================================================

var violations = new System.Collections.Generic.List<string>();
var violationDetails = new System.Collections.Generic.List<string[]>();
int totalViolationCount = 0;
int relationshipsWithViolations = 0;

// Add CSV header
violationDetails.Add(new string[] {
    "FromTable",
    "FromColumn",
    "ToTable",
    "ToColumn",
    "OrphanedKey",
    "Relationship"
});

foreach (var rel in Model.Relationships.OfType<SingleColumnRelationship>())
{
    var fromTable = rel.FromColumn.Table.Name;
    var fromColumn = rel.FromColumn.Name;
    var toTable = rel.ToColumn.Table.Name;
    var toColumn = rel.ToColumn.Name;
    var relName = rel.Name;

    try
    {
        // Build DAX query to find orphaned keys
        var daxQuery = "EVALUATE\n" +
                      "EXCEPT(\n" +
                      "    VALUES( '" + fromTable + "'[" + fromColumn + "] ),\n" +
                      "    VALUES( '" + toTable + "'[" + toColumn + "] )\n" +
                      ")";

        // Execute the query
        dynamic result = EvaluateDax(daxQuery);
        var rowCount = result.Rows.Count;

        if (rowCount > 0)
        {
            relationshipsWithViolations++;
            totalViolationCount += rowCount;

            // Add to summary
            var violationSummary = fromTable + "[" + fromColumn + "] → " + toTable + "[" + toColumn + "]: " +
                                  rowCount + " violation(s)";

            // Show sample values if not too many
            if (rowCount <= maxViolationsToShow)
            {
                var values = new System.Collections.Generic.List<string>();
                for (int i = 0; i < rowCount; i++)
                {
                    var value = result.Rows[i][0]?.ToString() ?? "(blank)";
                    values.Add(value);

                    // Add to CSV data
                    violationDetails.Add(new string[] {
                        fromTable,
                        fromColumn,
                        toTable,
                        toColumn,
                        value,
                        relName
                    });
                }
                violationSummary += "\n  Values: " + string.Join(", ", values);
            }
            else
            {
                // Just add count to CSV
                for (int i = 0; i < rowCount; i++)
                {
                    var value = result.Rows[i][0]?.ToString() ?? "(blank)";
                    violationDetails.Add(new string[] {
                        fromTable,
                        fromColumn,
                        toTable,
                        toColumn,
                        value,
                        relName
                    });
                }
                violationSummary += " (showing first " + maxViolationsToShow + " in export)";
            }

            violations.Add(violationSummary);
        }
    }
    catch (Exception ex)
    {
        violations.Add(fromTable + "[" + fromColumn + "] → " + toTable + "[" + toColumn + "]: ERROR - " + ex.Message);
    }
}

// ============================================================================
// EXPORT TO CSV
// ============================================================================

if (outputFormat == "csv" || outputFormat == "both")
{
    try
    {
        var csvContent = new System.Text.StringBuilder();

        foreach (var row in violationDetails)
        {
            csvContent.AppendLine(string.Join(",", row.Select(field =>
                "\"" + (field ?? "").Replace("\"", "\"\"") + "\""
            )));
        }

        System.IO.File.WriteAllText(csvFilePath, csvContent.ToString());
    }
    catch (Exception ex)
    {
        Error("Failed to write CSV file: " + ex.Message);
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

if (outputFormat == "info" || outputFormat == "both")
{
    string summary;

    if (violations.Count == 0)
    {
        summary = "✓ No referential integrity violations found!\n\n" +
                 "All " + Model.Relationships.Count + " relationship(s) have matching keys.";
    }
    else
    {
        summary = "✗ Referential Integrity Violations Found\n" +
                 "==========================================\n\n" +
                 "Summary:\n" +
                 "  Total relationships: " + Model.Relationships.Count + "\n" +
                 "  Relationships with violations: " + relationshipsWithViolations + "\n" +
                 "  Total orphaned keys: " + totalViolationCount + "\n\n" +
                 "Details:\n" +
                 string.Join("\n\n", violations);

        if (outputFormat == "both")
        {
            summary += "\n\n✓ Full results exported to:\n" + csvFilePath;
        }
    }

    Info(summary);
}
