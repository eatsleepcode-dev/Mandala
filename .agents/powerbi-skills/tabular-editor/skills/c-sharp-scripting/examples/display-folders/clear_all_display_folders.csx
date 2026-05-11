/*
 * Title: Clear all display folders
 *
 * Author: Claude Tabular Editor Plugin
 *
 * Description: Removes all display folders from measures and columns across
 * the entire model. Useful for resetting folder organization.
 *
 * Usage: Run this script on the entire model.
 * CLI: te "workspace/model" script.csx --file
 *
 * Non-interactive: Yes (works on Model.Tables)
 */

var clearedCount = 0;

foreach(var table in Model.Tables) {
    foreach(var measure in table.Measures) {
        if(measure.DisplayFolder.Length > 0) {
            measure.DisplayFolder = "";
            clearedCount++;
        }
    }
    foreach(var column in table.Columns) {
        if(column.DisplayFolder.Length > 0) {
            column.DisplayFolder = "";
            clearedCount++;
        }
    }
}

Info("Cleared " + clearedCount + " display folders from " + Model.Tables.Count + " tables");
