// List all DAX User-Defined Functions
// Reports all Function objects in the model with their properties

// ============================================================================
// CONFIGURATION
// ============================================================================

var filterByNamespace = "";  // Namespace name, empty for all
var filterByState = "";  // "Ready", "SemanticError", "SyntaxError", empty for all
var showHidden = true;  // Include hidden functions
var showExpression = false;  // Show expression text (can be verbose)

// ============================================================================
// BUILD FUNCTION LIST
// ============================================================================

var functions = Model.Functions.AsEnumerable();

// Apply filters
if (!showHidden)
{
    functions = functions.Where(f => !f.IsHidden);
}

if (!string.IsNullOrWhiteSpace(filterByNamespace))
{
    functions = functions.Where(f =>
    {
        var ns = f.GetAnnotation("Namespace");
        return !string.IsNullOrWhiteSpace(ns) && ns == filterByNamespace;
    });
}

if (!string.IsNullOrWhiteSpace(filterByState))
{
    if (filterByState == "Ready")
    {
        functions = functions.Where(f => f.State == ObjectState.Ready);
    }
    else if (filterByState == "SemanticError")
    {
        functions = functions.Where(f => f.State == ObjectState.SemanticError);
    }
}

var functionList = functions.ToList();

if (functionList.Count == 0)
{
    Info("No DAX user-defined functions found matching criteria");
    return;
}

// ============================================================================
// BUILD REPORT
// ============================================================================

var report = new System.Text.StringBuilder();
report.AppendLine("DAX User-Defined Functions");
report.AppendLine("==========================\n");

if (!string.IsNullOrWhiteSpace(filterByNamespace))
{
    report.AppendLine("Filter: Namespace = " + filterByNamespace);
}

if (!string.IsNullOrWhiteSpace(filterByState))
{
    report.AppendLine("Filter: State = " + filterByState);
}

if (!showHidden)
{
    report.AppendLine("Filter: Hidden functions excluded");
}

report.AppendLine("\nTotal: " + functionList.Count + "\n");

// Group by Namespace
var byNamespace = functionList.GroupBy(f =>
{
    var ns = f.GetAnnotation("Namespace");
    return string.IsNullOrWhiteSpace(ns) ? "(no namespace)" : ns;
})
    .Select(g => g.Key + ": " + g.Count())
    .ToList();

report.AppendLine("By Namespace:");
foreach (var item in byNamespace)
{
    report.AppendLine("  " + item);
}

// Group by State
var byState = functionList.GroupBy(f => f.State.ToString())
    .Select(g => g.Key + ": " + g.Count())
    .ToList();

report.AppendLine("\nBy State:");
foreach (var item in byState)
{
    report.AppendLine("  " + item);
}

report.AppendLine("\n" + new string('=', 50) + "\n");

// List each function
foreach (var func in functionList)
{
    var ns = func.GetAnnotation("Namespace");
    var displayName = string.IsNullOrWhiteSpace(ns) ? func.Name : ns + "." + func.Name;

    report.AppendLine("Name: " + displayName);
    report.AppendLine("  State: " + func.State);

    if (func.IsHidden)
    {
        report.AppendLine("  Hidden: true");
    }

    if (!string.IsNullOrWhiteSpace(func.Description))
    {
        report.AppendLine("  Description: " + func.Description);
    }

    if (func.State != ObjectState.Ready && !string.IsNullOrWhiteSpace(func.ErrorMessage))
    {
        report.AppendLine("  ⚠ Error: " + func.ErrorMessage);
    }

    if (showExpression)
    {
        report.AppendLine("  Expression:");
        report.AppendLine("    " + func.Expression.Replace("\n", "\n    "));
    }

    report.AppendLine("");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info(report.ToString());
