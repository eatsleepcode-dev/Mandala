/*
 * Title: Create SUM measures from columns
 *
 * Author: Daniel Otykier, twitter.com/DOtykier
 *
 * Description: Creates a SUM measure for every currently selected column,
 * sets format string, adds documentation, and hides the base column.
 *
 * Usage: Select columns in Tabular Editor, then run this script.
 * CLI: te "workspace/model" script.csx --file
 *
 * Non-interactive: Yes (works on Selected.Columns)
 */

// Loop through all currently selected columns:
foreach(var c in Selected.Columns)
{
    var newMeasure = c.Table.AddMeasure(
        "Sum of " + c.Name,                    // Name
        "SUM(" + c.DaxObjectFullName + ")",    // DAX expression
        c.DisplayFolder                        // Display Folder
    );

    // Set the format string on the new measure:
    newMeasure.FormatString = "0.00";

    // Provide some documentation:
    newMeasure.Description = "This measure is the sum of column " + c.DaxObjectFullName;

    // Hide the base column:
    c.IsHidden = true;
}

Info("Created " + Selected.Columns.Count + " SUM measures");
