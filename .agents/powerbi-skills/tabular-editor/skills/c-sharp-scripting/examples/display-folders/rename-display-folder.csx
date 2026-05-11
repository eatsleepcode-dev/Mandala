// Rename Display Folder
// Renames folder path across all measures/columns. Mode: "exact" or "prefix" (includes subfolders)
// Use: oldFolderPath="Sales/Revenue" newFolderPath="Sales/Key Metrics" renameMode="exact"

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// Old folder path (exact match required)
var oldFolderPath = "Sales/Revenue Metrics";

// New folder path
var newFolderPath = "Sales/Key Metrics/Revenue";

// Rename mode:
// - "exact" : Only rename exact matches
// - "prefix" : Rename folder and all subfolders (old path as prefix)
var renameMode = "exact";

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var measureCount = 0;
var columnCount = 0;

// Rename measure display folders
foreach(var table in Model.Tables)
{
    foreach(var measure in table.Measures)
    {
        if(renameMode == "exact")
        {
            if(measure.DisplayFolder == oldFolderPath)
            {
                measure.DisplayFolder = newFolderPath;
                measureCount++;
            }
        }
        else if(renameMode == "prefix")
        {
            // Rename if folder starts with old path
            // Example: "Sales/Revenue Metrics/YTD" → "Sales/Key Metrics/Revenue/YTD"
            if(measure.DisplayFolder == oldFolderPath ||
               measure.DisplayFolder.StartsWith(oldFolderPath + "/"))
            {
                // Replace the prefix
                var remainingPath = measure.DisplayFolder.Substring(oldFolderPath.Length);
                measure.DisplayFolder = newFolderPath + remainingPath;
                measureCount++;
            }
        }
    }
}

// Rename column display folders
foreach(var table in Model.Tables)
{
    foreach(var column in table.Columns)
    {
        if(renameMode == "exact")
        {
            if(column.DisplayFolder == oldFolderPath)
            {
                column.DisplayFolder = newFolderPath;
                columnCount++;
            }
        }
        else if(renameMode == "prefix")
        {
            if(column.DisplayFolder == oldFolderPath ||
               column.DisplayFolder.StartsWith(oldFolderPath + "/"))
            {
                var remainingPath = column.DisplayFolder.Substring(oldFolderPath.Length);
                column.DisplayFolder = newFolderPath + remainingPath;
                columnCount++;
            }
        }
    }
}

var totalCount = measureCount + columnCount;

Info("Renamed display folder: '" + oldFolderPath + "' → '" + newFolderPath + "'\n" +
     "Mode: " + renameMode + "\n" +
     "Updated: " + measureCount + " measures, " + columnCount + " columns (" + totalCount + " total)");
