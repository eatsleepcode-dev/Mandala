// Delete a specific measure
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

measure.Delete();

Info("Deleted measure '" + measureName + "' from table '" + tableName + "'");
