// Modify Shared Expression
// Updates properties of an existing NamedExpression

// ============================================================================
// CONFIGURATION
// ============================================================================

var expressionName = "MySharedExpression";

// What to modify (set to true to modify that property)
var modifyExpression = true;
var modifyDescription = true;
var modifyQueryGroup = false;
var modifyKind = false;

// New values
var newExpression = @"
let
    Source = Sql.Database(""newserver.database.windows.net"", ""NewDatabase"")
in
    Source";

var newDescription = "Updated description";
var newQueryGroupName = "Connection Strings";  // Empty string to remove from group
var newKind = "M";  // "M" or "DAX"

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Expressions.Contains(expressionName))
{
    Error("Expression not found: " + expressionName);
}

var expr = Model.Expressions[expressionName];

// ============================================================================
// MODIFY EXPRESSION
// ============================================================================

if (modifyExpression)
{
    expr.Expression = newExpression;
}

if (modifyDescription)
{
    expr.Description = newDescription;
}

if (modifyKind)
{
    if (newKind == "M")
    {
        expr.Kind = ExpressionKind.M;
    }
    else
    {
        Error("Invalid newKind: " + newKind + ". Must be 'M' (shared expressions only support M, not DAX)");
    }
}

if (modifyQueryGroup)
{
    if (string.IsNullOrWhiteSpace(newQueryGroupName))
    {
        expr.QueryGroup = null;
    }
    else
    {
        // Create query group if doesn't exist
        if (!Model.QueryGroups.Contains(newQueryGroupName))
        {
            Model.AddQueryGroup(newQueryGroupName);
        }
        expr.QueryGroup = Model.QueryGroups[newQueryGroupName];
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var modifiedItems = new System.Collections.Generic.List<string>();
if (modifyExpression) modifiedItems.Add("Expression");
if (modifyDescription) modifiedItems.Add("Description");
if (modifyKind) modifiedItems.Add("Kind");
if (modifyQueryGroup) modifiedItems.Add("Query Group");

Info("Modified Shared Expression\n" +
     "===========================\n\n" +
     "Name: " + expressionName + "\n\n" +
     "Properties modified: " + string.Join(", ", modifiedItems) + "\n\n" +
     "Current values:\n" +
     "  Kind: " + expr.Kind + "\n" +
     "  Description: " + (string.IsNullOrWhiteSpace(expr.Description) ? "(none)" : expr.Description) + "\n" +
     "  Query Group: " + (expr.QueryGroup == null ? "(none)" : expr.QueryGroup.Name));
