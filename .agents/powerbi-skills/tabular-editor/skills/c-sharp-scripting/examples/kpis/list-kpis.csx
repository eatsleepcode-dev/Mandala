// List all KPIs
// Reports all KPI metadata in the model

// ============================================================================
// CONFIGURATION
// ============================================================================

var filterByTable = "";  // Table name, empty for all
var showExpressions = true;  // Show detailed KPI expressions

// ============================================================================
// BUILD KPI LIST
// ============================================================================

var measuresWithKPIs = Model.AllMeasures.Where(m => m.KPI != null);

if (!string.IsNullOrWhiteSpace(filterByTable))
{
    measuresWithKPIs = measuresWithKPIs.Where(m => m.Table.Name == filterByTable);
}

var kpiList = measuresWithKPIs.ToList();

if (kpiList.Count == 0)
{
    Info("No KPIs found" + (string.IsNullOrWhiteSpace(filterByTable) ? "" : " in table " + filterByTable));
    return;
}

// ============================================================================
// BUILD REPORT
// ============================================================================

var report = new System.Text.StringBuilder();
report.AppendLine("KPIs in Model");
report.AppendLine("=============\n");

if (!string.IsNullOrWhiteSpace(filterByTable))
{
    report.AppendLine("Filter: Table = " + filterByTable);
}

report.AppendLine("\nTotal KPIs: " + kpiList.Count + "\n");

// Group by Table
var byTable = kpiList.GroupBy(m => m.Table.Name)
    .Select(g => g.Key + ": " + g.Count())
    .ToList();

report.AppendLine("By Table:");
foreach (var item in byTable)
{
    report.AppendLine("  " + item);
}

report.AppendLine("\n" + new string('=', 50) + "\n");

// List each KPI
foreach (var measure in kpiList.OrderBy(m => m.Table.Name).ThenBy(m => m.Name))
{
    var kpi = measure.KPI;

    report.AppendLine("Measure: " + measure.Table.Name + "/" + measure.Name);
    report.AppendLine("  Status Graphic: " + kpi.StatusGraphic);

    if (!string.IsNullOrWhiteSpace(kpi.TrendExpression))
    {
        report.AppendLine("  Trend Graphic: " + kpi.TrendGraphic);
    }

    if (!string.IsNullOrWhiteSpace(kpi.TargetFormatString))
    {
        report.AppendLine("  Target Format: " + kpi.TargetFormatString);
    }

    if (showExpressions)
    {
        report.AppendLine("\n  Target Expression:");
        report.AppendLine("    " + kpi.TargetExpression.Replace("\n", "\n    "));

        report.AppendLine("\n  Status Expression:");
        report.AppendLine("    " + kpi.StatusExpression.Replace("\n", "\n    "));

        if (!string.IsNullOrWhiteSpace(kpi.TrendExpression))
        {
            report.AppendLine("\n  Trend Expression:");
            report.AppendLine("    " + kpi.TrendExpression.Replace("\n", "\n    "));
        }
    }

    if (!string.IsNullOrWhiteSpace(kpi.TargetDescription))
    {
        report.AppendLine("\n  Target Description: " + kpi.TargetDescription);
    }

    if (!string.IsNullOrWhiteSpace(kpi.StatusDescription))
    {
        report.AppendLine("  Status Description: " + kpi.StatusDescription);
    }

    if (!string.IsNullOrWhiteSpace(kpi.TrendDescription))
    {
        report.AppendLine("  Trend Description: " + kpi.TrendDescription);
    }

    report.AppendLine("");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info(report.ToString());
