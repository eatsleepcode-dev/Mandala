// Delete Hierarchy(ies)
// Removes hierarchy objects from tables

// ============================================================================
// CONFIGURATION
// ============================================================================

var deleteMode = "single";  // "single", "table", "pattern", "all"

// Single mode
var tableName = "DimDate";
var hierarchyName = "Calendar";

// Table mode (delete all hierarchies in a table)
var tableNameForBulkDelete = "DimProduct";

// Pattern mode (wildcard matching across all tables)
var hierarchyPattern = "Temp*";

// Confirmation for "all" mode
var confirmDeleteAll = false;

// Unhide source columns when deleting hierarchy
var unhideSourceColumns = true;

// ============================================================================
// BUILD DELETE LIST
// ============================================================================

var hierarchiesToDelete = new System.Collections.Generic.List<Hierarchy>();

if (deleteMode == "single")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    var table = Model.Tables[tableName];

    if (!table.Hierarchies.Contains(hierarchyName))
    {
        Error("Hierarchy not found: " + hierarchyName);
    }

    hierarchiesToDelete.Add(table.Hierarchies[hierarchyName]);
}
else if (deleteMode == "table")
{
    if (!Model.Tables.Contains(tableNameForBulkDelete))
    {
        Error("Table not found: " + tableNameForBulkDelete);
    }

    hierarchiesToDelete.AddRange(Model.Tables[tableNameForBulkDelete].Hierarchies);
}
else if (deleteMode == "pattern")
{
    var regex = "^" + hierarchyPattern.Replace("*", ".*").Replace("?", ".") + "$";

    hierarchiesToDelete.AddRange(
        Model.AllHierarchies.Where(h =>
            System.Text.RegularExpressions.Regex.IsMatch(h.Name, regex))
    );
}
else if (deleteMode == "all")
{
    if (!confirmDeleteAll)
    {
        Error("Safety check: Set confirmDeleteAll = true to delete all hierarchies");
    }

    hierarchiesToDelete.AddRange(Model.AllHierarchies);
}
else
{
    Error("Invalid deleteMode: " + deleteMode);
}

if (hierarchiesToDelete.Count == 0)
{
    Error("No hierarchies found to delete");
}

// ============================================================================
// DELETE HIERARCHIES
// ============================================================================

var deletedHierarchies = new System.Collections.Generic.List<string>();
var unhiddenColumns = new System.Collections.Generic.List<string>();

foreach (var hierarchy in hierarchiesToDelete.ToList())
{
    var displayName = hierarchy.Table.Name + "/" + hierarchy.Name;
    deletedHierarchies.Add(displayName);

    // Unhide source columns if requested
    if (unhideSourceColumns)
    {
        foreach (var level in hierarchy.Levels)
        {
            if (level.Column.IsHidden)
            {
                level.Column.IsHidden = false;
                unhiddenColumns.Add(level.Column.Table.Name + "/" + level.Column.Name);
            }
        }
    }

    hierarchy.Delete();
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var report = "Deleted Hierarchies\n" +
             "===================\n\n" +
             "Mode: " + deleteMode + "\n" +
             "Count: " + deletedHierarchies.Count + "\n\n" +
             "Deleted hierarchies:\n" +
             string.Join("\n", deletedHierarchies.Select(n => "  - " + n).Take(20));

if (deletedHierarchies.Count > 20)
{
    report += "\n  ... and " + (deletedHierarchies.Count - 20) + " more";
}

if (unhideSourceColumns && unhiddenColumns.Count > 0)
{
    report += "\n\nUnhidden source columns: " + unhiddenColumns.Count + "\n" +
              string.Join("\n", unhiddenColumns.Select(n => "  - " + n).Take(10));

    if (unhiddenColumns.Count > 10)
    {
        report += "\n  ... and " + (unhiddenColumns.Count - 10) + " more";
    }
}

Info(report);
