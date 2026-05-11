// Modify DAX User-Defined Function
// Updates properties of an existing Function

// ============================================================================
// CONFIGURATION
// ============================================================================

var functionName = "MyFunction";

// What to modify (set to true to modify that property)
var modifyExpression = true;
var modifyDescription = true;
var modifyIsHidden = false;
var modifyNamespace = false;

// New values
var newExpression = @"
(
    _value AS DOUBLE,
    _target AS DOUBLE,
    _decimals AS INTEGER
) =>
VAR Result = ROUND(DIVIDE(_value, _target, 0), _decimals)
RETURN
    Result
";

var newDescription = "Updated description with rounding parameter";
var newIsHidden = false;
var newNamespace = "Utilities";  // Empty string to remove namespace

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Functions.Contains(functionName))
{
    Error("Function not found: " + functionName);
}

var func = Model.Functions[functionName];

// ============================================================================
// MODIFY FUNCTION
// ============================================================================

if (modifyExpression)
{
    func.Expression = newExpression;
}

if (modifyDescription)
{
    func.Description = newDescription;
}

if (modifyIsHidden)
{
    func.IsHidden = newIsHidden;
}

if (modifyNamespace)
{
    if (string.IsNullOrWhiteSpace(newNamespace))
    {
        func.RemoveAnnotation("Namespace");
    }
    else
    {
        func.SetAnnotation("Namespace", newNamespace);
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var modifiedItems = new System.Collections.Generic.List<string>();
if (modifyExpression) modifiedItems.Add("Expression");
if (modifyDescription) modifiedItems.Add("Description");
if (modifyIsHidden) modifiedItems.Add("IsHidden");
if (modifyNamespace) modifiedItems.Add("Namespace");

var currentNamespace = func.GetAnnotation("Namespace");

var statusMessage = func.State == ObjectState.Ready ? "Ready" :
                   func.State == ObjectState.SemanticError ? "Semantic Error" :
                   "Unknown";

var report = "Modified DAX User-Defined Function\n" +
             "==================================\n\n" +
             "Name: " + functionName + "\n\n" +
             "Properties modified: " + string.Join(", ", modifiedItems) + "\n\n" +
             "Current values:\n" +
             "  Status: " + statusMessage + "\n" +
             "  Hidden: " + func.IsHidden + "\n" +
             "  Namespace: " + (string.IsNullOrWhiteSpace(currentNamespace) ? "(none)" : currentNamespace) + "\n" +
             "  Description: " + (string.IsNullOrWhiteSpace(func.Description) ? "(none)" : func.Description);

if (func.State != ObjectState.Ready)
{
    report += "\n\n⚠ WARNING: Function has errors\n";
    if (!string.IsNullOrWhiteSpace(func.ErrorMessage))
    {
        report += "Error: " + func.ErrorMessage;
    }
}

Info(report);
