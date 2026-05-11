// Format all KPI expressions (Target, Status, Trend) in measures

int _measureCounter = 0;
int _expressionCounter = 0;

foreach (var _measure in Model.AllMeasures)
{
    if (_measure.KPI != null)
    {
        bool _hasExpressions = false;

        // Format Target Expression
        if (!string.IsNullOrWhiteSpace(_measure.KPI.TargetExpression))
        {
            _measure.KPI.TargetExpression = "\n" + FormatDax(_measure.KPI.TargetExpression, shortFormat: true);
            _expressionCounter++;
            _hasExpressions = true;
        }

        // Format Status Expression
        if (!string.IsNullOrWhiteSpace(_measure.KPI.StatusExpression))
        {
            _measure.KPI.StatusExpression = "\n" + FormatDax(_measure.KPI.StatusExpression, shortFormat: true);
            _expressionCounter++;
            _hasExpressions = true;
        }

        // Format Trend Expression (if exists)
        if (!string.IsNullOrWhiteSpace(_measure.KPI.TrendExpression))
        {
            _measure.KPI.TrendExpression = "\n" + FormatDax(_measure.KPI.TrendExpression, shortFormat: true);
            _expressionCounter++;
            _hasExpressions = true;
        }

        if (_hasExpressions) _measureCounter++;
    }
}

Info("Formatted " + Convert.ToString(_expressionCounter) + " KPI expressions across " + Convert.ToString(_measureCounter) + " measures.");
