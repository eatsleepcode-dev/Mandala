// Add Import Table
// Creates table with M partition in Import mode
// Use: tableName="Sales" mExpression="let Source=... in Source"
var tableName = "New Import Table";
var partitionName = "Import Partition";

// M expression for the partition
// This example uses a simple table, but you would typically connect to a data source
var mExpression = @"
let
    Source = #table(
        {""ID"", ""Name"", ""Value""},
        {
            {1, ""Item 1"", 100},
            {2, ""Item 2"", 200},
            {3, ""Item 3"", 300}
        }
    )
in
    Source";

// Create the table
var table = Model.AddTable(tableName);

// Add M partition (Import mode by default)
var partition = table.AddMPartition(partitionName, mExpression);
partition.Mode = ModeType.Import;

// Add data columns
var idColumn = table.AddDataColumn("ID", "ID", "Columns", DataType.Int64);
var nameColumn = table.AddDataColumn("Name", "Name", "Columns", DataType.String);
var valueColumn = table.AddDataColumn("Value", "Value", "Columns", DataType.Decimal);

// Set column properties
idColumn.IsKey = true;
idColumn.SummarizeBy = AggregateFunction.None;
valueColumn.SummarizeBy = AggregateFunction.Sum;
valueColumn.FormatString = "#,##0";

Info("Created Import mode table: " + tableName);
