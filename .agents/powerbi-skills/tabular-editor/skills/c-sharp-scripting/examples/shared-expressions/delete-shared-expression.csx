// Delete Shared Expression(s)
// Removes NamedExpression objects from the model

// ============================================================================
// CONFIGURATION
// ============================================================================

var deleteMode = "single";  // "single", "pattern", "all"

// Single mode
var expressionName = "MySharedExpression";

// Pattern mode (wildcard matching)
var expressionPattern = "Temp*";  // Matches "TempConnection", "TempQuery", etc.

// Confirmation for "all" mode
var confirmDeleteAll = false;  // Must be true to delete all expressions

// ============================================================================
// BUILD DELETE LIST
// ============================================================================

var expressionsToDelete = new System.Collections.Generic.List<NamedExpression>();

if (deleteMode == "single")
{
    if (!Model.Expressions.Contains(expressionName))
    {
        Error("Expression not found: " + expressionName);
    }
    expressionsToDelete.Add(Model.Expressions[expressionName]);
}
else if (deleteMode == "pattern")
{
    var regex = "^" + expressionPattern.Replace("*", ".*").Replace("?", ".") + "$";

    expressionsToDelete.AddRange(
        Model.Expressions.Where(e =>
            System.Text.RegularExpressions.Regex.IsMatch(e.Name, regex))
    );
}
else if (deleteMode == "all")
{
    if (!confirmDeleteAll)
    {
        Error("Safety check: Set confirmDeleteAll = true to delete all expressions");
    }

    expressionsToDelete.AddRange(Model.Expressions);
}
else
{
    Error("Invalid deleteMode: " + deleteMode);
}

if (expressionsToDelete.Count == 0)
{
    Error("No expressions found to delete");
}

// ============================================================================
// DELETE EXPRESSIONS
// ============================================================================

var deletedNames = new System.Collections.Generic.List<string>();

foreach (var expr in expressionsToDelete.ToList())
{
    deletedNames.Add(expr.Name + " (" + expr.Kind + ")");
    expr.Delete();
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Deleted Shared Expressions\n" +
     "===========================\n\n" +
     "Mode: " + deleteMode + "\n" +
     "Count: " + deletedNames.Count + "\n\n" +
     "Deleted expressions:\n" +
     string.Join("\n", deletedNames.Select(n => "  - " + n).Take(20)) +
     (deletedNames.Count > 20 ? "\n  ... and " + (deletedNames.Count - 20) + " more" : ""));
