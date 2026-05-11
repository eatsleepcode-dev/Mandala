// Add Last Refresh Table
// Creates a table that tracks when the model was last refreshed

// Configuration - modify these values
var tableName = "Last Refresh";
var columnName = "Last Refresh";
var measureName = "Last Refresh Date";
var measureFormat = "MMM DD, HH:MM";  // e.g., "Nov 01, 14:30"

// M expression to capture current datetime
string mPartition = @"
let
    Source = DateTimeZone.FixedLocalNow()
in
    Source";

// Create the table
var table = Model.AddTable(tableName);

// Add M partition
table.AddMPartition(tableName, mPartition);

// Add column (hidden)
var column = table.AddDataColumn(columnName, columnName, "Columns", DataType.DateTime);
column.IsHidden = true;
column.IsAvailableInMDX = false;

// Add measure to display last refresh
var measure = table.AddMeasure(
    measureName,
    @"FORMAT ( MAX ( '" + tableName + "'[" + columnName + @"] ), """ + measureFormat + @""" )"
);
measure.Description = "Shows the last time this semantic model was refreshed";
measure.DisplayFolder = "Admin";

// Set table description
table.Description = "Tracks the last refresh datetime of the semantic model";

Info("Created Last Refresh table: " + tableName +
     "\nMeasure: [" + measureName + "] shows formatted refresh time");
