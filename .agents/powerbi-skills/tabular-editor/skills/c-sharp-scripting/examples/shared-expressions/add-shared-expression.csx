// Add Shared Expression (M only)
// Creates a new NamedExpression in the model
// NOTE: Shared expressions only support M (Power Query) expressions, not DAX

// ============================================================================
// CONFIGURATION
// ============================================================================

var expressionName = "MySharedExpression";
var expressionKind = "M";  // Only "M" is supported for shared expressions

// M Expression example (connection string, function, etc.)
var mExpression = @"
let
    Source = Sql.Database(""server.database.windows.net"", ""DatabaseName"")
in
    Source";

// Description
var description = "Shared expression for database connection";

// Query Group (optional, for organization)
var queryGroupName = "";  // Leave empty for no group

// ============================================================================
// VALIDATION
// ============================================================================

if (Model.Expressions.Contains(expressionName))
{
    Error("Expression already exists: " + expressionName);
}

// ============================================================================
// CREATE EXPRESSION
// ============================================================================

var expr = Model.AddExpression(expressionName);

// Set Kind (only M is supported for shared expressions)
if (expressionKind == "M")
{
    expr.Kind = ExpressionKind.M;
    expr.Expression = mExpression;
}
else
{
    Error("Invalid expressionKind: " + expressionKind + ". Must be 'M' (shared expressions only support M, not DAX)");
}

// Set optional properties
if (!string.IsNullOrWhiteSpace(description))
{
    expr.Description = description;
}

if (!string.IsNullOrWhiteSpace(queryGroupName))
{
    // Create or get query group
    if (!Model.QueryGroups.Contains(queryGroupName))
    {
        Model.AddQueryGroup(queryGroupName);
    }
    expr.QueryGroup = Model.QueryGroups[queryGroupName];
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Created Shared Expression\n" +
     "==========================\n\n" +
     "Name: " + expressionName + "\n" +
     "Kind: " + expressionKind + "\n" +
     "Description: " + (string.IsNullOrWhiteSpace(description) ? "(none)" : description) + "\n" +
     "Query Group: " + (string.IsNullOrWhiteSpace(queryGroupName) ? "(none)" : queryGroupName) + "\n\n" +
     "Expression:\n" + expr.Expression);
