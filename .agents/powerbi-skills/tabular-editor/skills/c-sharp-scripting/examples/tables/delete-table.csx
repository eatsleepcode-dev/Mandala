// Delete Table
// Removes table from model (with confirmation check)

// Config
var tableName = "OldTable";
var confirmDelete = true;  // Safety check

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

// Check for dependencies
var dependentMeasures = Model.AllMeasures.Where(m => 
    m.Expression.Contains("'" + tableName + "'") || 
    m.Expression.Contains("[" + tableName + "]")).ToList();

var dependentRelationships = Model.Relationships.Where(r => 
    r.FromColumn.Table == table || r.ToColumn.Table == table).ToList();

if (confirmDelete)
{
    var warnings = "";

    if (dependentMeasures.Count > 0)
    {
        warnings += dependentMeasures.Count + " measure(s) reference this table\n";
    }

    if (dependentRelationships.Count > 0)
    {
        warnings += dependentRelationships.Count + " relationship(s) involve this table\n";
    }

    if (!string.IsNullOrEmpty(warnings))
    {
        Error("Cannot delete table - dependencies found:\n" + warnings);
    }
}

table.Delete();
Info("Deleted table: " + tableName);
