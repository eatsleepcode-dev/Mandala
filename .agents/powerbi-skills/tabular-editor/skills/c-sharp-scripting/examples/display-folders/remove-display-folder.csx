// Remove Display Folder
// Clears DisplayFolder property. Mode: "exact", "prefix" (subfolders), or "all"
// Use: folderPath="Sales/Revenue" removeMode="exact"

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// Folder path to remove
var folderPath = "Sales/Revenue Metrics";

// Remove mode:
// - "exact" : Only remove objects in exact folder path
// - "prefix" : Remove folder and all subfolders
// - "all" : Remove all display folders (clear everything)
var removeMode = "exact";

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var measureCount = 0;
var columnCount = 0;

// Remove measure display folders
foreach(var table in Model.Tables)
{
    foreach(var measure in table.Measures)
    {
        bool shouldClear = false;

        if(removeMode == "all")
        {
            shouldClear = measure.DisplayFolder.Length > 0;
        }
        else if(removeMode == "exact")
        {
            shouldClear = measure.DisplayFolder == folderPath;
        }
        else if(removeMode == "prefix")
        {
            shouldClear = measure.DisplayFolder == folderPath ||
                         measure.DisplayFolder.StartsWith(folderPath + "/");
        }

        if(shouldClear)
        {
            measure.DisplayFolder = "";
            measureCount++;
        }
    }
}

// Remove column display folders
foreach(var table in Model.Tables)
{
    foreach(var column in table.Columns)
    {
        bool shouldClear = false;

        if(removeMode == "all")
        {
            shouldClear = column.DisplayFolder.Length > 0;
        }
        else if(removeMode == "exact")
        {
            shouldClear = column.DisplayFolder == folderPath;
        }
        else if(removeMode == "prefix")
        {
            shouldClear = column.DisplayFolder == folderPath ||
                         column.DisplayFolder.StartsWith(folderPath + "/");
        }

        if(shouldClear)
        {
            column.DisplayFolder = "";
            columnCount++;
        }
    }
}

var totalCount = measureCount + columnCount;

var message = removeMode == "all"
    ? "Removed all display folders"
    : "Removed display folder: '" + folderPath + "'";

Info(message + "\n" +
     "Mode: " + removeMode + "\n" +
     "Cleared: " + measureCount + " measures, " + columnCount + " columns (" + totalCount + " total)");
