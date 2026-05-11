// Add Hierarchy to Table
// Creates a new hierarchy with multiple levels

// ============================================================================
// CONFIGURATION
// ============================================================================

var tableName = "DimDate";
var hierarchyName = "Calendar";
var displayFolder = "Time Intelligence";

// Levels (in order from top to bottom)
// Provide either column names OR column objects
var levelColumnNames = new string[] {
    "Year",
    "Quarter",
    "Month",
    "Date"
};

// Optional: Custom level names (if empty, uses column names)
var customLevelNames = new string[] {
    "",  // Empty = use column name
    "",
    "",
    ""
};

// Hide source columns after creating hierarchy
var hideSourceColumns = true;

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

if (table.Hierarchies.Contains(hierarchyName))
{
    Error("Hierarchy already exists: " + hierarchyName);
}

// Validate all columns exist
foreach (var colName in levelColumnNames)
{
    if (!table.Columns.Contains(colName))
    {
        Error("Column not found: " + colName + " in table " + tableName);
    }
}

// ============================================================================
// CREATE HIERARCHY
// ============================================================================

// Create hierarchy with levels
var hierarchy = table.AddHierarchy(hierarchyName, displayFolder, levelColumnNames);

// Set custom level names if provided
for (int i = 0; i < customLevelNames.Length && i < hierarchy.Levels.Count; i++)
{
    if (!string.IsNullOrWhiteSpace(customLevelNames[i]))
    {
        hierarchy.Levels[i].Name = customLevelNames[i];
    }
}

// Hide source columns if requested
if (hideSourceColumns)
{
    foreach (var colName in levelColumnNames)
    {
        table.Columns[colName].IsHidden = true;
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var levelNames = new System.Collections.Generic.List<string>();
foreach (var level in hierarchy.Levels)
{
    levelNames.Add(level.Name + " (" + level.Column.Name + ")");
}

Info("Created Hierarchy\n" +
     "==================\n\n" +
     "Table: " + tableName + "\n" +
     "Hierarchy: " + hierarchyName + "\n" +
     "Display Folder: " + (string.IsNullOrWhiteSpace(displayFolder) ? "(none)" : displayFolder) + "\n" +
     "Levels: " + hierarchy.Levels.Count + "\n\n" +
     "Level structure:\n" +
     string.Join("\n", levelNames.Select((n, idx) => "  " + (idx + 1) + ". " + n)) + "\n\n" +
     "Source columns hidden: " + hideSourceColumns);
