// Add Calculated Table
// Creates table with DAX expression. Columns auto-created (TE3) or manual (TE2)
// Use: tableName="Date" daxExpression="CALENDAR(DATE(2020,1,1), DATE(2025,12,31))"
var tableName = "Date Scaffold";

// DAX expression that defines the table
var daxExpression = @"
CALENDAR(
    DATE(2020, 1, 1),
    DATE(2025, 12, 31)
)";

// Create the calculated table
var table = Model.AddCalculatedTable(tableName, daxExpression);

// The columns are automatically created from the DAX expression
// In TE3, columns are inferred automatically
// In TE2, you may need to add them manually

// Check if running in TE2 (no auto-created columns)
var isTE2 = table.Columns.Count == 0;

if (isTE2)
{
    // TE2: Manually add calculated table columns
    var dateColumn = table.AddCalculatedTableColumn("Date", "[Date]");
    dateColumn.DataType = DataType.DateTime;
    dateColumn.FormatString = "mm/dd/yyyy";
}
else
{
    // TE3: Columns already exist, just configure them
    var dateColumn = table.Columns["Date"];
    // Note: IsNameInferred is not available in the public API
    dateColumn.DataType = DataType.DateTime;
    dateColumn.FormatString = "mm/dd/yyyy";
}

// Set table description
table.Description = "Calendar table with dates from 2020 to 2025";

Info("Created calculated table: " + tableName + " with " + table.Columns.Count + " columns");
