/*
 * Title: Organize measures by type into display folders
 *
 * Author: Tabular Editor Community
 *
 * Description: Organizes measures into display folders based on naming patterns.
 * YTD, MTD, QTD measures go into "Time Intelligence", % measures go into "Ratios", etc.
 *
 * Usage: Run this script on the entire model or selected measures.
 * CLI: te "workspace/model" script.csx --file
 *
 * Non-interactive: Yes (works on Model.AllMeasures)
 */

var organizedCount = 0;

foreach(var m in Model.AllMeasures) {
    // Time Intelligence measures
    if(m.Name.Contains(" YTD") || m.Name.Contains(" MTD") || m.Name.Contains(" QTD") ||
       m.Name.Contains(" PY") || m.Name.Contains(" YoY")) {
        m.DisplayFolder = "Time Intelligence";
        organizedCount++;
    }
    // Percentage/Ratio measures
    else if(m.Name.Contains("%") || m.Name.Contains("Percent") || m.Name.Contains("Rate")) {
        m.DisplayFolder = "Ratios";
        organizedCount++;
    }
    // Count measures
    else if(m.Name.StartsWith("# ") || m.Name.Contains("Count")) {
        m.DisplayFolder = "Counts";
        organizedCount++;
    }
    // Average measures
    else if(m.Name.Contains("Avg") || m.Name.Contains("Average")) {
        m.DisplayFolder = "Averages";
        organizedCount++;
    }
    // Sum measures
    else if(m.Name.Contains("Sum") || m.Name.Contains("Total")) {
        m.DisplayFolder = "Totals";
        organizedCount++;
    }
}

Info("Organized " + organizedCount + " measures into display folders");
