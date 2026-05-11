// Find and Replace in Power Query (M) Expressions
// Search and replace text across all partition M expressions

// ============================================================================
// CONFIGURATION
// ============================================================================

var findText = "OldServerName";
var replaceText = "NewServerName";
var caseSensitive = false;

// Preview mode (set to false to actually replace)
var previewOnly = true;

// ============================================================================
// FIND/REPLACE
// ============================================================================

Info("=== POWER QUERY FIND/REPLACE ===\n");
Info("Find: " + findText);
Info("Replace: " + replaceText);
Info("Case Sensitive: " + caseSensitive);
Info("Mode: " + (previewOnly ? "PREVIEW ONLY" : "REPLACE"));
Info("");

var matchCount = 0;
var tableCount = 0;

foreach(var table in Model.Tables) {
    var tableHasMatches = false;

    foreach(var partition in table.Partitions) {
        if (partition is Partition) {
            var p = partition as Partition;

            if (!string.IsNullOrEmpty(p.Expression)) {
                var expression = p.Expression;
                var comparison = caseSensitive ?
                    System.StringComparison.Ordinal :
                    System.StringComparison.OrdinalIgnoreCase;

                if (expression.IndexOf(findText, comparison) >= 0) {
                    if (!tableHasMatches) {
                        Info("Table: " + table.Name);
                        tableHasMatches = true;
                        tableCount++;
                    }

                    matchCount++;
                    Info("  Partition: " + partition.Name);

                    // Show context
                    var index = expression.IndexOf(findText, comparison);
                    var start = Math.Max(0, index - 20);
                    var length = Math.Min(60, expression.Length - start);
                    var context = expression.Substring(start, length).Replace("\n", " ");
                    Info("    Context: ..." + context + "...");

                    // Perform replacement if not preview
                    if (!previewOnly) {
                        p.Expression = caseSensitive ?
                            p.Expression.Replace(findText, replaceText) :
                            System.Text.RegularExpressions.Regex.Replace(
                                p.Expression,
                                System.Text.RegularExpressions.Regex.Escape(findText),
                                replaceText,
                                System.Text.RegularExpressions.RegexOptions.IgnoreCase
                            );
                        Info("    ✓ Replaced");
                    }
                }
            }
        }
    }

    if (tableHasMatches) {
        Info("");
    }
}

Info("=== SUMMARY ===");
Info("Tables affected: " + tableCount);
Info("Partitions matched: " + matchCount);

if (previewOnly && matchCount > 0) {
    Info("\nSet previewOnly = false to apply changes");
}
