// Read and display all properties of a specific measure
// Usage: Modify tableName and measureName variables

var tableName = "Sales";           // Change to your table name
var measureName = "Total Sales";   // Change to your measure name

var table = Model.Tables[tableName];

if (table == null) {
    Error("Table '" + tableName + "' not found");
    return;
}

var measure = table.Measures[measureName];

if (measure == null) {
    Error("Measure '" + measureName + "' not found in table '" + tableName + "'");
    return;
}

// Display measure properties
Info("=== Measure Properties ===");
Info("Name: " + measure.Name);
Info("Table: " + measure.Table.Name);
Info("Expression: " + measure.Expression);
Info("Format String: " + measure.FormatString);
Info("Display Folder: " + measure.DisplayFolder);
Info("Description: " + measure.Description);
Info("Is Hidden: " + measure.IsHidden);
Info("Data Type: " + measure.DataType);

// Check if measure has KPI
if (measure.KPI != null) {
    Info("KPI Status Expression: " + measure.KPI.StatusExpression);
    Info("KPI Target Expression: " + measure.KPI.TargetExpression);
}

// List dependencies
Info("\nDependencies:");
foreach(var dep in measure.DependsOn) {
    Info("  - " + dep.Key.DaxObjectFullName);
}
