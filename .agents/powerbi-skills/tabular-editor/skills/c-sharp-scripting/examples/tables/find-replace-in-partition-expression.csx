// Find and Replace in Partition Expressions
// Search and replace text across M partition expressions

// ============================================================================
// CONFIGURATION
// ============================================================================

// Target scope
var targetMode = "all";  // "single", "table", "all"
var tableName = "FactSales";  // For single/table modes

// Find/Replace
var findText = "ServerName.database.windows.net";
var replaceText = "NewServer.database.windows.net";
var caseSensitive = false;

// ============================================================================
// EXECUTE FIND/REPLACE
// ============================================================================

var partitionsToProcess = new System.Collections.Generic.List<Partition>();

if (targetMode == "single")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    var table = Model.Tables[tableName];
    var mPartitions = table.Partitions.Where(p => p.SourceType == PartitionSourceType.M).ToList();

    if (mPartitions.Count == 0)
    {
        Error("No M partitions found in table: " + tableName);
    }

    partitionsToProcess.Add(mPartitions[0]);  // First M partition
}
else if (targetMode == "table")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    var table = Model.Tables[tableName];
    partitionsToProcess.AddRange(table.Partitions.Where(p => p.SourceType == PartitionSourceType.M));
}
else
{
    // All M partitions in model
    foreach (var table in Model.Tables)
    {
        partitionsToProcess.AddRange(table.Partitions.Where(p => p.SourceType == PartitionSourceType.M));
    }
}

// Perform replacements
int replacementCount = 0;
var modifiedPartitions = new System.Collections.Generic.List<string>();

foreach (var partition in partitionsToProcess)
{
    var originalExpression = partition.Expression;
    var newExpression = caseSensitive
        ? originalExpression.Replace(findText, replaceText)
        : System.Text.RegularExpressions.Regex.Replace(
            originalExpression,
            System.Text.RegularExpressions.Regex.Escape(findText),
            replaceText,
            System.Text.RegularExpressions.RegexOptions.IgnoreCase
        );

    if (originalExpression != newExpression)
    {
        partition.Expression = newExpression;
        replacementCount++;
        modifiedPartitions.Add(partition.Table.Name + "/" + partition.Name);
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

if (replacementCount == 0)
{
    Info("No matches found for: " + findText);
}
else
{
    var summary = "Find and Replace Results\n" +
                 "========================\n\n" +
                 "Find: " + findText + "\n" +
                 "Replace: " + replaceText + "\n" +
                 "Case sensitive: " + caseSensitive + "\n\n" +
                 "Modified " + replacementCount + " partition(s):\n" +
                 string.Join("\n", modifiedPartitions);

    Info(summary);
}
