// Hide all measures in a specific table
// Usage: Modify tableName variable to target specific table

var tableName = "Sales";  // Change this to your table name

var table = Model.Tables[tableName];

if (table == null) {
    Error("Table '" + tableName + "' not found");
    return;
}

int count = 0;
foreach(var measure in table.Measures) {
    if (!measure.IsHidden) {
        measure.IsHidden = true;
        count++;
    }
}

Info("Hidden " + count + " measures in table '" + tableName + "'");
