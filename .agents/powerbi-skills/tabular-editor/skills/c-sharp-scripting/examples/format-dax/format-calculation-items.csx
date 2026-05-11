// Format all calculation items in calculation groups

int _counter = 0;
foreach (var _calcgroup in Model.CalculationGroups)
{
    foreach (var _item in _calcgroup.CalculationItems)
    {
        _counter = _counter + 1;
        _item.Expression = "\n" + FormatDax(_item.Expression, shortFormat: true);
    }
}

Info("Formatted " + Convert.ToString(_counter) + " calculation items.");
