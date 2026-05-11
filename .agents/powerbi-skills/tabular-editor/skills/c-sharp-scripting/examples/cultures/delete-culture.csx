// Delete Culture(s)
// Removes culture objects and their translations from the model

// ============================================================================
// CONFIGURATION
// ============================================================================

var deleteMode = "single";  // "single", "pattern", "all"

// Single mode
var cultureName = "es-ES";

// Pattern mode (wildcard matching)
var culturePattern = "es-*";  // Matches "es-ES", "es-MX", etc.

// Confirmation for "all" mode
var confirmDeleteAll = false;

// ============================================================================
// BUILD DELETE LIST
// ============================================================================

var culturesToDelete = new System.Collections.Generic.List<Culture>();

if (deleteMode == "single")
{
    if (!Model.Cultures.Contains(cultureName))
    {
        Error("Culture not found: " + cultureName);
    }

    culturesToDelete.Add(Model.Cultures[cultureName]);
}
else if (deleteMode == "pattern")
{
    var regex = "^" + culturePattern.Replace("*", ".*").Replace("?", ".") + "$";

    culturesToDelete.AddRange(
        Model.Cultures.Where(c =>
            System.Text.RegularExpressions.Regex.IsMatch(c.Name, regex))
    );
}
else if (deleteMode == "all")
{
    if (!confirmDeleteAll)
    {
        Error("Safety check: Set confirmDeleteAll = true to delete all cultures");
    }

    culturesToDelete.AddRange(Model.Cultures);
}
else
{
    Error("Invalid deleteMode: " + deleteMode);
}

if (culturesToDelete.Count == 0)
{
    Error("No cultures found to delete");
}

// ============================================================================
// DELETE CULTURES
// ============================================================================

var deletedNames = new System.Collections.Generic.List<string>();

foreach (var culture in culturesToDelete.ToList())
{
    deletedNames.Add(culture.Name);
    culture.Delete();
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Deleted Cultures\n" +
     "================\n\n" +
     "Mode: " + deleteMode + "\n" +
     "Count: " + deletedNames.Count + "\n\n" +
     "Deleted cultures:\n" +
     string.Join("\n", deletedNames.Select(n => "  - " + n)) + "\n\n" +
     "Note: All translations for these cultures have been removed from the model.");
