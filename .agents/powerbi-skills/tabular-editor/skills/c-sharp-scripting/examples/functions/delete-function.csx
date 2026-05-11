// Delete DAX User-Defined Function(s)
// Removes Function objects from the model

// ============================================================================
// CONFIGURATION
// ============================================================================

var deleteMode = "single";  // "single", "pattern", "namespace", "all"

// Single mode
var functionName = "MyFunction";

// Pattern mode (wildcard matching)
var functionPattern = "Temp*";  // Matches "TempCalc", "TempFunction", etc.

// Namespace mode (delete all functions in a namespace)
var namespaceName = "Deprecated";

// Confirmation for "all" mode
var confirmDeleteAll = false;  // Must be true to delete all functions

// ============================================================================
// BUILD DELETE LIST
// ============================================================================

var functionsToDelete = new System.Collections.Generic.List<Function>();

if (deleteMode == "single")
{
    if (!Model.Functions.Contains(functionName))
    {
        Error("Function not found: " + functionName);
    }
    functionsToDelete.Add(Model.Functions[functionName]);
}
else if (deleteMode == "pattern")
{
    var regex = "^" + functionPattern.Replace("*", ".*").Replace("?", ".") + "$";

    functionsToDelete.AddRange(
        Model.Functions.Where(f =>
            System.Text.RegularExpressions.Regex.IsMatch(f.Name, regex))
    );
}
else if (deleteMode == "namespace")
{
    functionsToDelete.AddRange(
        Model.Functions.Where(f =>
        {
            var ns = f.GetAnnotation("Namespace");
            return !string.IsNullOrWhiteSpace(ns) && ns == namespaceName;
        })
    );
}
else if (deleteMode == "all")
{
    if (!confirmDeleteAll)
    {
        Error("Safety check: Set confirmDeleteAll = true to delete all functions");
    }

    functionsToDelete.AddRange(Model.Functions);
}
else
{
    Error("Invalid deleteMode: " + deleteMode);
}

if (functionsToDelete.Count == 0)
{
    Error("No functions found to delete");
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================

var deletedNames = new System.Collections.Generic.List<string>();

foreach (var func in functionsToDelete.ToList())
{
    var ns = func.GetAnnotation("Namespace");
    var displayName = string.IsNullOrWhiteSpace(ns) ? func.Name : ns + "." + func.Name;
    deletedNames.Add(displayName);
    func.Delete();
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Deleted DAX User-Defined Functions\n" +
     "====================================\n\n" +
     "Mode: " + deleteMode + "\n" +
     "Count: " + deletedNames.Count + "\n\n" +
     "Deleted functions:\n" +
     string.Join("\n", deletedNames.Select(n => "  - " + n).Take(20)) +
     (deletedNames.Count > 20 ? "\n  ... and " + (deletedNames.Count - 20) + " more" : ""));
