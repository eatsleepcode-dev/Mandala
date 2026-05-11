/*
 * Title: Create COUNTROWS measures from tables
 *
 * Author: Edgar Walther, twitter.com/edgarwalther
 *
 * Description: Creates a COUNTROWS measure for every currently selected table.
 * Useful for creating row count measures for all fact/dimension tables.
 *
 * Usage: Select tables in Tabular Editor, then run this script.
 * CLI: te "workspace/model" script.csx --file
 *
 * Non-interactive: Yes (works on Selected.Tables)
 */

// Loop through all currently selected tables:
foreach(var table in Selected.Tables) {

    var newMeasure = table.AddMeasure(
        "# Rows in " + table.Name,                         // Name
        "COUNTROWS(" + table.DaxObjectFullName + ")"       // DAX expression
    );

    // Set the format string on the new measure:
    newMeasure.FormatString = "0";

    // Provide some documentation:
    newMeasure.Description = "This measure is the number of rows in table " + table.DaxObjectFullName;
}

Info("Created " + Selected.Tables.Count + " COUNTROWS measures");
