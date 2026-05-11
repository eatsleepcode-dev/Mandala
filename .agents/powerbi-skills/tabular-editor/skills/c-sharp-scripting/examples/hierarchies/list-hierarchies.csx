// List all Hierarchies
// Reports all hierarchy objects in the model with their structure

// ============================================================================
// CONFIGURATION
// ============================================================================

var filterByTable = "";  // Table name, empty for all
var filterByDisplayFolder = "";  // Display folder, empty for all
var showHidden = true;  // Include hidden hierarchies
var showLevelDetails = true;  // Show detailed level information

// ============================================================================
// BUILD HIERARCHY LIST
// ============================================================================

var hierarchies = Model.AllHierarchies.AsEnumerable();

// Apply filters
if (!showHidden)
{
    hierarchies = hierarchies.Where(h => !h.IsHidden);
}

if (!string.IsNullOrWhiteSpace(filterByTable))
{
    hierarchies = hierarchies.Where(h => h.Table.Name == filterByTable);
}

if (!string.IsNullOrWhiteSpace(filterByDisplayFolder))
{
    hierarchies = hierarchies.Where(h => h.DisplayFolder == filterByDisplayFolder);
}

var hierarchyList = hierarchies.ToList();

if (hierarchyList.Count == 0)
{
    Info("No hierarchies found matching criteria");
    return;
}

// ============================================================================
// BUILD REPORT
// ============================================================================

var report = new System.Text.StringBuilder();
report.AppendLine("Hierarchies");
report.AppendLine("===========\n");

if (!string.IsNullOrWhiteSpace(filterByTable))
{
    report.AppendLine("Filter: Table = " + filterByTable);
}

if (!string.IsNullOrWhiteSpace(filterByDisplayFolder))
{
    report.AppendLine("Filter: Display Folder = " + filterByDisplayFolder);
}

if (!showHidden)
{
    report.AppendLine("Filter: Hidden hierarchies excluded");
}

report.AppendLine("\nTotal: " + hierarchyList.Count + "\n");

// Group by Table
var byTable = hierarchyList.GroupBy(h => h.Table.Name)
    .Select(g => g.Key + ": " + g.Count())
    .ToList();

report.AppendLine("By Table:");
foreach (var item in byTable)
{
    report.AppendLine("  " + item);
}

// Group by Display Folder
var byFolder = hierarchyList.GroupBy(h =>
    string.IsNullOrWhiteSpace(h.DisplayFolder) ? "(no folder)" : h.DisplayFolder)
    .Select(g => g.Key + ": " + g.Count())
    .ToList();

report.AppendLine("\nBy Display Folder:");
foreach (var item in byFolder)
{
    report.AppendLine("  " + item);
}

report.AppendLine("\n" + new string('=', 50) + "\n");

// List each hierarchy
foreach (var hierarchy in hierarchyList.OrderBy(h => h.Table.Name).ThenBy(h => h.Name))
{
    report.AppendLine("Hierarchy: " + hierarchy.Table.Name + "/" + hierarchy.Name);

    if (hierarchy.IsHidden)
    {
        report.AppendLine("  Hidden: true");
    }

    if (!string.IsNullOrWhiteSpace(hierarchy.DisplayFolder))
    {
        report.AppendLine("  Display Folder: " + hierarchy.DisplayFolder);
    }

    if (!string.IsNullOrWhiteSpace(hierarchy.Description))
    {
        report.AppendLine("  Description: " + hierarchy.Description);
    }

    report.AppendLine("  Hide Members: " + hierarchy.HideMembers);
    report.AppendLine("  Levels: " + hierarchy.Levels.Count);

    if (showLevelDetails)
    {
        report.AppendLine("  Level structure:");
        foreach (var level in hierarchy.Levels.OrderBy(l => l.Ordinal))
        {
            var columnInfo = level.Column.Name;

            // Show if column is hidden
            if (level.Column.IsHidden)
            {
                columnInfo += " [hidden]";
            }

            // Show if level has custom name different from column
            if (level.Name != level.Column.Name)
            {
                report.AppendLine("    " + (level.Ordinal + 1) + ". " + level.Name + " (from: " + columnInfo + ")");
            }
            else
            {
                report.AppendLine("    " + (level.Ordinal + 1) + ". " + columnInfo);
            }
        }
    }

    report.AppendLine("");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info(report.ToString());
