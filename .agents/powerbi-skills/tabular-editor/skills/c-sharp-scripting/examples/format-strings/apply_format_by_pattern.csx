// Example: Apply Format Strings by Pattern
// This script applies format strings based on measure naming patterns

foreach(var measure in Model.AllMeasures) {
    // Currency
    if(measure.Name.Contains("Revenue") ||
       measure.Name.Contains("Sales") ||
       measure.Name.Contains("Cost") ||
       measure.Name.Contains("Price")) {
        measure.FormatString = "$#,0";
    }
    // Percentage
    else if(measure.Name.Contains("Rate") ||
            measure.Name.Contains("Percent") ||
            measure.Name.Contains("%") ||
            measure.Name.Contains("Margin")) {
        measure.FormatString = "0.00%";
    }
    // Whole numbers
    else if(measure.Name.Contains("Count") ||
            measure.Name.Contains("Quantity")) {
        measure.FormatString = "#,0";
    }
}

Info("Applied format strings");
