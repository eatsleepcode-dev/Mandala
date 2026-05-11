/*
 * Title: Generate Time Intelligence measures
 *
 * Author: Tabular Editor Documentation
 *
 * Description: Creates YTD, PY, YoY, YoY%, QTD, and MTD measures
 * for every currently selected measure.
 *
 * Usage: Select measures in Tabular Editor, then run this script.
 * CLI: te "workspace/model" script.csx --file
 *
 * Configuration: Update dateColumn variable to match your date table
 * Non-interactive: Yes (works on Selected.Measures)
 */

var dateColumn = "'Date'[Date]";  // Update this to match your date table

// Creates time intelligence measures for every selected measure:
foreach(var m in Selected.Measures) {
    // Year-to-date:
    m.Table.AddMeasure(
        m.Name + " YTD",
        "TOTALYTD(" + m.DaxObjectName + ", " + dateColumn + ")",
        m.DisplayFolder
    );

    // Previous year:
    m.Table.AddMeasure(
        m.Name + " PY",
        "CALCULATE(" + m.DaxObjectName + ", SAMEPERIODLASTYEAR(" + dateColumn + "))",
        m.DisplayFolder
    );

    // Year-over-year
    m.Table.AddMeasure(
        m.Name + " YoY",
        m.DaxObjectName + " - [" + m.Name + " PY]",
        m.DisplayFolder
    );

    // Year-over-year %:
    var yoyPct = m.Table.AddMeasure(
        m.Name + " YoY%",
        "DIVIDE([" + m.Name + " YoY], [" + m.Name + " PY])",
        m.DisplayFolder
    );
    yoyPct.FormatString = "0.0 %";

    // Quarter-to-date:
    m.Table.AddMeasure(
        m.Name + " QTD",
        "TOTALQTD(" + m.DaxObjectName + ", " + dateColumn + ")",
        m.DisplayFolder
    );

    // Month-to-date:
    m.Table.AddMeasure(
        m.Name + " MTD",
        "TOTALMTD(" + m.DaxObjectName + ", " + dateColumn + ")",
        m.DisplayFolder
    );
}

Info("Created 6 time intelligence measures for " + Selected.Measures.Count + " base measures");
