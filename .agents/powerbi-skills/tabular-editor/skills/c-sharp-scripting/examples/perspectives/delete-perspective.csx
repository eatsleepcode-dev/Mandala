// Delete Perspective(s)
// Removes perspective objects from the model

// ============================================================================
// CONFIGURATION
// ============================================================================

var deleteMode = "single";  // "single", "pattern", "all"

// Single mode
var perspectiveName = "Sales";

// Pattern mode (wildcard matching)
var perspectivePattern = "Test*";

// Confirmation for "all" mode
var confirmDeleteAll = false;

// ============================================================================
// BUILD DELETE LIST
// ============================================================================

var perspectivesToDelete = new System.Collections.Generic.List<Perspective>();

if (deleteMode == "single")
{
    if (!Model.Perspectives.Contains(perspectiveName))
    {
        Error("Perspective not found: " + perspectiveName);
    }

    perspectivesToDelete.Add(Model.Perspectives[perspectiveName]);
}
else if (deleteMode == "pattern")
{
    var regex = "^" + perspectivePattern.Replace("*", ".*").Replace("?", ".") + "$";

    perspectivesToDelete.AddRange(
        Model.Perspectives.Where(p =>
            System.Text.RegularExpressions.Regex.IsMatch(p.Name, regex))
    );
}
else if (deleteMode == "all")
{
    if (!confirmDeleteAll)
    {
        Error("Safety check: Set confirmDeleteAll = true to delete all perspectives");
    }

    perspectivesToDelete.AddRange(Model.Perspectives);
}
else
{
    Error("Invalid deleteMode: " + deleteMode);
}

if (perspectivesToDelete.Count == 0)
{
    Error("No perspectives found to delete");
}

// ============================================================================
// DELETE PERSPECTIVES
// ============================================================================

var deletedNames = new System.Collections.Generic.List<string>();

foreach (var perspective in perspectivesToDelete.ToList())
{
    deletedNames.Add(perspective.Name);
    perspective.Delete();
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Deleted Perspectives\n" +
     "====================\n\n" +
     "Mode: " + deleteMode + "\n" +
     "Count: " + deletedNames.Count + "\n\n" +
     "Deleted perspectives:\n" +
     string.Join("\n", deletedNames.Select(n => "  - " + n)));
