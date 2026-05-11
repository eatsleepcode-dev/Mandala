// Rename a measure
// Usage: Modify variables below

var tableName = "Sales";
var oldName = "Total Sales";
var newName = "Total Revenue";

var table = Model.Tables[tableName];

if (table == null) {
    Error("Table '" + tableName + "' not found");
    return;
}

var measure = table.Measures[oldName];

if (measure == null) {
    Error("Measure '" + oldName + "' not found");
    return;
}

// Check if new name already exists
if (table.Measures.Any(m => m.Name == newName)) {
    Error("Measure '" + newName + "' already exists in table '" + tableName + "'");
    return;
}

measure.Name = newName;

Info("Renamed measure from '" + oldName + "' to '" + newName + "'");
