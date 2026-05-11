// Mark Table as Private
// Sets IsPrivate = true to hide table from all client tools

// Config
var tableName = "StagingTable";

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];
table.IsPrivate = true;

// Optionally hide all columns too
foreach (var col in table.Columns)
{
    col.IsHidden = true;
}

Info("Marked as private: " + tableName);
