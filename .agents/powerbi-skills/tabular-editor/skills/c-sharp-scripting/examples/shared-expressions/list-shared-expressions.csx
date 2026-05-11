// List all Shared Expressions
// Reports all NamedExpression objects in the model with their properties

// ============================================================================
// CONFIGURATION
// ============================================================================

var filterByKind = "";  // "", "M", "DAX" - empty for all
var filterByQueryGroup = "";  // Query group name, empty for all
var showExpression = false;  // Show expression text (can be verbose)

// ============================================================================
// BUILD EXPRESSION LIST
// ============================================================================

var expressions = Model.Expressions.AsEnumerable();

// Apply filters
if (!string.IsNullOrWhiteSpace(filterByKind))
{
    if (filterByKind == "M")
    {
        expressions = expressions.Where(e => e.Kind == ExpressionKind.M);
    }
    // Note: Shared expressions only support M, not DAX
}

if (!string.IsNullOrWhiteSpace(filterByQueryGroup))
{
    expressions = expressions.Where(e =>
        e.QueryGroup != null && e.QueryGroup.Name == filterByQueryGroup);
}

var expressionList = expressions.ToList();

if (expressionList.Count == 0)
{
    Info("No shared expressions found matching criteria");
    return;
}

// ============================================================================
// BUILD REPORT
// ============================================================================

var report = new System.Text.StringBuilder();
report.AppendLine("Shared Expressions");
report.AppendLine("==================\n");

if (!string.IsNullOrWhiteSpace(filterByKind))
{
    report.AppendLine("Filter: Kind = " + filterByKind);
}

if (!string.IsNullOrWhiteSpace(filterByQueryGroup))
{
    report.AppendLine("Filter: Query Group = " + filterByQueryGroup);
}

report.AppendLine("\nTotal: " + expressionList.Count + "\n");

// Group by Kind
var byKind = expressionList.GroupBy(e => e.Kind.ToString())
    .Select(g => g.Key + ": " + g.Count())
    .ToList();

report.AppendLine("By Kind:");
foreach (var item in byKind)
{
    report.AppendLine("  " + item);
}

// Group by Query Group
var byGroup = expressionList.GroupBy(e => e.QueryGroup?.Name ?? "(none)")
    .Select(g => g.Key + ": " + g.Count())
    .ToList();

report.AppendLine("\nBy Query Group:");
foreach (var item in byGroup)
{
    report.AppendLine("  " + item);
}

report.AppendLine("\n" + new string('=', 50) + "\n");

// List each expression
foreach (var expr in expressionList)
{
    report.AppendLine("Name: " + expr.Name);
    report.AppendLine("  Kind: " + expr.Kind);
    report.AppendLine("  Query Group: " + (expr.QueryGroup == null ? "(none)" : expr.QueryGroup.Name));

    if (!string.IsNullOrWhiteSpace(expr.Description))
    {
        report.AppendLine("  Description: " + expr.Description);
    }

    if (showExpression)
    {
        report.AppendLine("  Expression:");
        report.AppendLine("    " + expr.Expression.Replace("\n", "\n    "));
    }

    report.AppendLine("");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info(report.ToString());
