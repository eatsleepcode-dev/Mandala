// Example: Apply Format Strings Based on Measure Names
// This script automatically applies appropriate format strings to measures

Info("Applying format strings to measures...");

var updatedCount = 0;

foreach(var measure in Model.AllMeasures) {
    var name = measure.Name.ToLower();

    // Currency measures
    if(name.Contains("revenue") ||
       name.Contains("sales") ||
       name.Contains("cost") ||
       name.Contains("price") ||
       name.Contains("amount")) {
        measure.FormatString = "$#,0";
        updatedCount++;
    }
    // Percentage measures
    else if(name.Contains("rate") ||
            name.Contains("percent") ||
            name.Contains("%") ||
            name.Contains("margin") ||
            name.Contains("growth")) {
        measure.FormatString = "0.00%";
        updatedCount++;
    }
    // Whole number measures
    else if(name.Contains("count") ||
            name.Contains("quantity") ||
            name.Contains("number")) {
        measure.FormatString = "#,0";
        updatedCount++;
    }
    // Decimal measures
    else if(name.Contains("average") ||
            name.Contains("avg")) {
        measure.FormatString = "#,0.00";
        updatedCount++;
    }
}

Info("Applied format strings to " + updatedCount + " measures");
Info("Format string update complete!");
