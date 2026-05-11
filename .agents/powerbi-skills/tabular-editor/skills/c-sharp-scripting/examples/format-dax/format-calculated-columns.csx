// Format all calculated columns in the model

int _counter = 0;
foreach (var _column in Model.AllColumns)
{
    if (Convert.ToString(_column.Type) == "Calculated")
    {
        (_column as CalculatedColumn).Expression = "\n" + FormatDax((_column as CalculatedColumn).Expression, shortFormat: true);
        _counter++;
    }
}

Info("Formatted " + Convert.ToString(_counter) + " calculated columns.");
