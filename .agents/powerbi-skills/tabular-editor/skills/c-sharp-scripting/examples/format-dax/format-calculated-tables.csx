// Format all calculated tables in the model

int _counter = 0;
foreach (var _table in Model.Tables)
{
    if (Convert.ToString(_table.Columns[0].Type) == "CalculatedTableColumn")
    {
        _table.Partitions[0].Expression = "\n" + FormatDax(_table.Partitions[0].Expression, shortFormat: true);
        _counter++;
    }
}

Info("Formatted " + Convert.ToString(_counter) + " calculated tables.");
