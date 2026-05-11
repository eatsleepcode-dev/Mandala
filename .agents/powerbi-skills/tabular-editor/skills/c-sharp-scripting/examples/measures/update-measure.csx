// Update properties of an existing measure
// Usage: Modify variables below

var tableName = "Sales";
var measureName = "Total Sales";

// New property values
var newExpression = "SUM(Sales[Amount])";
var newFormatString = "$#,0.00";
var newDisplayFolder = "Revenue Metrics";
var newDescription = "Total sales amount across all transactions";

var table = Model.Tables[tableName];

if (table == null) {
    Error("Table '" + tableName + "' not found");
    return;
}

var measure = table.Measures[measureName];

if (measure == null) {
    Error("Measure '" + measureName + "' not found");
    return;
}

// Update properties
measure.Expression = newExpression;
measure.FormatString = newFormatString;
measure.DisplayFolder = newDisplayFolder;
measure.Description = newDescription;

Info("Updated measure '" + measureName + "'");
Info("  Expression: " + newExpression);
Info("  Format: " + newFormatString);
Info("  Folder: " + newDisplayFolder);
