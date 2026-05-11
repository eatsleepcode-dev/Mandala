// Add Measure Table
// Creates a dedicated table for housing measures with no underlying data

// Configuration - modify these values
var tableName = "_Measures";
var columnName = "Measure Table";

// M expression for empty single-row table
string mPartition = @"
Table.FromRows(
    {
        {""Measure Table""}
    },
    type table
    [#""Measure Table"" = text]
)";

// Create the table
var table = Model.AddTable(tableName);

// Add M partition
table.AddMPartition(tableName, mPartition);

// Add column (hidden)
var column = table.AddDataColumn(columnName, columnName, "Columns", DataType.String);
column.IsHidden = true;
column.IsAvailableInMDX = false;

// Set table description
table.Description = "Container table for measures with no associated fact table";

Info("Created measure table: " + tableName);
