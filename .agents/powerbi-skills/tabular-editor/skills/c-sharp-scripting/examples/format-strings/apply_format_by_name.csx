/*
 * Title: Apply format strings based on measure names
 *
 * Author: Tabular Editor Community
 *
 * Description: Applies appropriate format strings to measures based on
 * naming patterns. Revenue/Sales get currency, percentages get %, etc.
 *
 * Usage: Run this script on the entire model or selected measures.
 * CLI: te "workspace/model" script.csx --file
 *
 * Non-interactive: Yes (works on Model.AllMeasures)
 */

var formattedCount = 0;

foreach(var m in Model.AllMeasures) {
    // Currency measures
    if(m.Name.Contains("Revenue") || m.Name.Contains("Sales") || m.Name.Contains("Cost") ||
       m.Name.Contains("Price") || m.Name.Contains("Amount")) {
        m.FormatString = "$#,0";
        formattedCount++;
    }
    // Percentage measures
    else if(m.Name.Contains("%") || m.Name.Contains("Percent") || m.Name.Contains("Rate") ||
            m.Name.Contains("Margin")) {
        m.FormatString = "0.00%";
        formattedCount++;
    }
    // Count measures (no decimals)
    else if(m.Name.StartsWith("# ") || m.Name.Contains("Count") || m.Name.Contains("Quantity")) {
        m.FormatString = "#,0";
        formattedCount++;
    }
    // Decimal measures
    else if(m.Name.Contains("Average") || m.Name.Contains("Avg")) {
        m.FormatString = "#,0.00";
        formattedCount++;
    }
}

Info("Applied format strings to " + formattedCount + " measures");
