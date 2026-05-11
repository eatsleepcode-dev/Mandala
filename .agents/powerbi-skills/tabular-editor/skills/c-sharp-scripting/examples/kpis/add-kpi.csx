// Add KPI to Measure
// NOTE: KPIs are not recommended for modern Power BI. See NOTE.md for details.

// ============================================================================
// CONFIGURATION
// ============================================================================

var measureName = "Sales Actual";
var tableName = "FactSales";  // Optional, leave empty to search all tables

// KPI Expressions
var targetExpression = "[Sales Target]";

var statusExpression = @"
VAR Variance = DIVIDE([Sales Actual], [Sales Target], 0) - 1
RETURN
    SWITCH(
        TRUE(),
        Variance >= 0.05, 2,
        Variance >= 0, 1,
        Variance >= -0.05, 0,
        Variance >= -0.1, -1,
        -2
    )
";

// Trend expression (optional)
var trendExpression = @"
VAR CurrentPeriod = [Sales Actual]
VAR PriorPeriod = CALCULATE([Sales Actual], DATEADD('Date'[Date], -1, YEAR))
RETURN
    DIVIDE(CurrentPeriod - PriorPeriod, PriorPeriod, 0)
";

var includeTrend = false;

// Descriptions (optional)
var targetDescription = "Sales target for the period";
var statusDescription = "Status: -2=Critical, -1=Poor, 0=Neutral, 1=Good, 2=Excellent";
var trendDescription = "Year-over-year trend";

// Graphics (optional, for Excel/SSAS clients)
var statusGraphic = "Five Bars Colored";
var trendGraphic = "Standard Arrow";

// Format string for target (optional)
var targetFormatString = "";  // Empty to inherit from measure

// ============================================================================
// FIND MEASURE
// ============================================================================

Measure measure = null;

if (!string.IsNullOrWhiteSpace(tableName))
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    if (!Model.Tables[tableName].Measures.Contains(measureName))
    {
        Error("Measure not found: " + measureName + " in table " + tableName);
    }

    measure = Model.Tables[tableName].Measures[measureName];
}
else
{
    measure = Model.AllMeasures.FirstOrDefault(m => m.Name == measureName);

    if (measure == null)
    {
        Error("Measure not found: " + measureName);
    }
}

// ============================================================================
// VALIDATION
// ============================================================================

if (measure.KPI != null)
{
    Error("Measure already has a KPI: " + measure.Name);
}

// ============================================================================
// CREATE KPI
// ============================================================================

var kpi = measure.AddKPI();

// Set required expressions
kpi.TargetExpression = targetExpression;
kpi.StatusExpression = statusExpression;

if (includeTrend && !string.IsNullOrWhiteSpace(trendExpression))
{
    kpi.TrendExpression = trendExpression;
}

// Set descriptions
if (!string.IsNullOrWhiteSpace(targetDescription))
{
    kpi.TargetDescription = targetDescription;
}

if (!string.IsNullOrWhiteSpace(statusDescription))
{
    kpi.StatusDescription = statusDescription;
}

if (includeTrend && !string.IsNullOrWhiteSpace(trendDescription))
{
    kpi.TrendDescription = trendDescription;
}

// Set graphics
if (!string.IsNullOrWhiteSpace(statusGraphic))
{
    kpi.StatusGraphic = statusGraphic;
}

if (includeTrend && !string.IsNullOrWhiteSpace(trendGraphic))
{
    kpi.TrendGraphic = trendGraphic;
}

// Set target format string
if (!string.IsNullOrWhiteSpace(targetFormatString))
{
    kpi.TargetFormatString = targetFormatString;
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Created KPI\n" +
     "===========\n\n" +
     "⚠ WARNING: KPIs are not recommended for modern Power BI.\n" +
     "   See NOTE.md for details and better alternatives.\n\n" +
     "Measure: " + measure.Table.Name + "/" + measure.Name + "\n" +
     "Target: " + targetExpression + "\n" +
     "Status Graphic: " + kpi.StatusGraphic + "\n" +
     "Trend: " + (includeTrend ? "Yes" : "No") + "\n\n" +
     "Status Expression:\n" + statusExpression);
