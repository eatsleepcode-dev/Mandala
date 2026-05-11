// Format Detail Rows (Drill-Through) Expressions
// Applies DAX formatting to table detail rows definitions

int counter = 0;
foreach (var table in Model.Tables)
{
    if (table.DefaultDetailRowsDefinition != null && !string.IsNullOrWhiteSpace(table.DefaultDetailRowsDefinition.Expression))
    {
        table.DefaultDetailRowsDefinition.Expression = "\n" + CallDaxFormatter(table.DefaultDetailRowsDefinition.Expression);
        counter++;
    }
}

Info("Formatted " + counter + " detail rows expressions");
