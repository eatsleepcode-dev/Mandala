// Example: Clear All Display Folders
// This script removes all display folder assignments

// Clear measure folders
foreach(var measure in Model.AllMeasures) {
    measure.DisplayFolder = "";
}

// Clear column folders
foreach(var table in Model.Tables) {
    foreach(var column in table.Columns) {
        column.DisplayFolder = "";
    }
}

Info("Cleared all display folders");
