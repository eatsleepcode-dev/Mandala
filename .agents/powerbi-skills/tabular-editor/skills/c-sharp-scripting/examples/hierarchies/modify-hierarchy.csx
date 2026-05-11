// Modify Hierarchy
// Updates hierarchy properties and levels

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "DimDate";
var hierarchyName = "Calendar";

// What to modify
var modifyDisplayFolder = true;
var modifyDescription = false;
// var modifyHideMembers = false; // TE3 only - not available in TE2
var addLevels = false;
var removeLevels = false;
var reorderLevels = false;

// New values
var newDisplayFolder = "Time";
var newDescription = "Calendar hierarchy for time intelligence";
// var newHideMembers = HideMembers.None;  // TE3 only - not available in TE2

// Add levels at specific position (ordinal = -1 for end)
var levelsToAdd = new string[] { "Week" };
var addAtOrdinal = 3;  // 0-based index, -1 for end

// Remove levels by name
var levelsToRemove = new string[] { "Date" };

// Reorder: provide complete list in new order
var newLevelOrder = new string[] {
    "Year",
    "Month",
    "Quarter",
    "Date"
};

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

if (!table.Hierarchies.Contains(hierarchyName))
{
    Error("Hierarchy not found: " + hierarchyName);
}

var hierarchy = table.Hierarchies[hierarchyName];

// ============================================================================
// MODIFY HIERARCHY
// ============================================================================

var changes = new System.Collections.Generic.List<string>();

if (modifyDisplayFolder)
{
    hierarchy.DisplayFolder = newDisplayFolder;
    changes.Add("Display Folder");
}

if (modifyDescription)
{
    hierarchy.Description = newDescription;
    changes.Add("Description");
}

// TE3 only - not available in TE2
// if (modifyHideMembers)
// {
//     hierarchy.HideMembers = newHideMembers;
//     changes.Add("Hide Members");
// }

// Add levels
if (addLevels)
{
    foreach (var colName in levelsToAdd)
    {
        if (!table.Columns.Contains(colName))
        {
            Info("Warning: Column not found: " + colName);
            continue;
        }

        hierarchy.AddLevel(colName, ordinal: addAtOrdinal);
        changes.Add("Added level: " + colName);
    }
}

// Remove levels
if (removeLevels)
{
    foreach (var levelName in levelsToRemove)
    {
        var level = hierarchy.Levels.FirstOrDefault(l => l.Name == levelName);
        if (level != null)
        {
            level.Delete();
            changes.Add("Removed level: " + levelName);
        }
        else
        {
            Info("Warning: Level not found: " + levelName);
        }
    }
}

// Reorder levels
if (reorderLevels)
{
    for (int i = 0; i < newLevelOrder.Length; i++)
    {
        var level = hierarchy.Levels.FirstOrDefault(l => l.Name == newLevelOrder[i]);
        if (level != null)
        {
            level.Ordinal = i;
        }
        else
        {
            Info("Warning: Level not found for reordering: " + newLevelOrder[i]);
        }
    }
    changes.Add("Reordered levels");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var currentLevels = new System.Collections.Generic.List<string>();
foreach (var level in hierarchy.Levels.OrderBy(l => l.Ordinal))
{
    currentLevels.Add(level.Name + " (" + level.Column.Name + ")");
}

Info("Modified Hierarchy\n" +
     "===================\n\n" +
     "Table: " + tableName + "\n" +
     "Hierarchy: " + hierarchyName + "\n\n" +
     "Changes made: " + (changes.Count == 0 ? "(none)" : string.Join(", ", changes)) + "\n\n" +
     "Current structure:\n" +
     "  Display Folder: " + (string.IsNullOrWhiteSpace(hierarchy.DisplayFolder) ? "(none)" : hierarchy.DisplayFolder) + "\n" +
     "  Levels: " + hierarchy.Levels.Count + "\n\n" +
     "Level order:\n" +
     string.Join("\n", currentLevels.Select((n, idx) => "  " + (idx + 1) + ". " + n)));
