// Mark as Date Table
// Sets DataCategory = "Time" and marks a column as the date key

// Config
var tableName = "Date";
var dateColumnName = "Date";  // The date key column

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

if (!table.Columns.Contains(dateColumnName))
{
    Error("Date column not found in " + tableName + ": " + dateColumnName);
}

var dateColumn = table.Columns[dateColumnName];

// Mark table as Time category
table.DataCategory = "Time";

// Mark column as date key
dateColumn.IsKey = true;
dateColumn.DataType = DataType.DateTime;

// Hide other date columns by default (optional)
foreach (var col in table.Columns.Where(c => c.DataType == DataType.DateTime && c.Name != dateColumnName))
{
    col.IsHidden = true;
}

Info("Marked " + tableName + " as date table with key column: " + dateColumnName);
