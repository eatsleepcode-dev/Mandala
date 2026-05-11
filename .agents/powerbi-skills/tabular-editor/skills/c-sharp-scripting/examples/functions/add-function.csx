// Add DAX User-Defined Function (UDF)
// Creates a new Function in the model (requires CompatibilityLevel 1702+)

// ============================================================================
// CONFIGURATION
// ============================================================================

var functionName = "MyFunction";

// Function expression (DAX lambda notation)
// Syntax: (param1 [AS TYPE], param2 [AS TYPE], ...) => expression
var functionExpression = @"
(
    _value AS DOUBLE,
    _target AS DOUBLE
) =>
VAR Result = DIVIDE(_value, _target, BLANK())
RETURN
    Result
";

// Description
var description = "Calculates percentage of value vs target with safe division";

// Hidden from client tools
var isHidden = false;

// Namespace (optional - for organization, e.g., "Finance", "Utils")
var namespaceName = "";  // Leave empty for no namespace

// ============================================================================
// VALIDATION
// ============================================================================

// Check compatibility level
if (Model.Database.CompatibilityLevel < 1702)
{
    Error("DAX User-Defined Functions require CompatibilityLevel 1702 or higher.\n" +
          "Current level: " + Model.Database.CompatibilityLevel + "\n\n" +
          "Note: UDFs are only available in Power BI Desktop and Fabric Service");
}

if (Model.Functions.Contains(functionName))
{
    Error("Function already exists: " + functionName);
}

// ============================================================================
// CREATE FUNCTION
// ============================================================================

var func = Model.AddFunction(functionName);
func.Expression = functionExpression;

// Set optional properties
if (!string.IsNullOrWhiteSpace(description))
{
    func.Description = description;
}

func.IsHidden = isHidden;

// Set namespace using annotation
if (!string.IsNullOrWhiteSpace(namespaceName))
{
    func.SetAnnotation("Namespace", namespaceName);
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

// Check for errors after creation
var statusMessage = func.State == ObjectState.Ready ? "Ready" :
                   func.State == ObjectState.SemanticError ? "Semantic Error" :
                   "Unknown";

var report = "Created DAX User-Defined Function\n" +
             "==================================\n\n" +
             "Name: " + functionName + "\n" +
             "Namespace: " + (string.IsNullOrWhiteSpace(namespaceName) ? "(none)" : namespaceName) + "\n" +
             "Status: " + statusMessage + "\n" +
             "Hidden: " + isHidden + "\n";

if (!string.IsNullOrWhiteSpace(description))
{
    report += "Description: " + description + "\n";
}

report += "\nExpression:\n" + functionExpression;

if (func.State != ObjectState.Ready)
{
    report += "\n\n⚠ WARNING: Function has errors\n";
    if (!string.IsNullOrWhiteSpace(func.ErrorMessage))
    {
        report += "Error: " + func.ErrorMessage;
    }
}
else
{
    report += "\n\n✓ Function is ready to use\n" +
              "  Usage: " + (string.IsNullOrWhiteSpace(namespaceName) ? "" : namespaceName + ".") + functionName + "(arg1, arg2, ...)";
}

Info(report);
