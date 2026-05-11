// Modify KPI
// Updates KPI properties on a measure

// ============================================================================
// CONFIGURATION
// ============================================================================

var measureName = "Sales Actual";
var tableName = "";  // Optional, leave empty to search all tables

// What to modify
var modifyTargetExpression = true;
var modifyStatusExpression = false;
var modifyTrendExpression = false;
var modifyDescriptions = false;
var modifyGraphics = false;
var modifyTargetFormatString = false;

// New values
var newTargetExpression = "[Sales Target Updated]";
var newStatusExpression = "DIVIDE([Sales Actual], [Sales Target], 0)";
var newTrendExpression = "";
var newTargetDescription = "Updated target description";
var newStatusDescription = "Updated status description";
var newTrendDescription = "";
var newStatusGraphic = "Three Stars Colored";
var newTrendGraphic = "";
var newTargetFormatString = "#,0";

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

if (measure.KPI == null)
{
    Error("Measure does not have a KPI: " + measure.Name);
}

var kpi = measure.KPI;

// ============================================================================
// MODIFY KPI
// ============================================================================

var changes = new System.Collections.Generic.List<string>();

if (modifyTargetExpression)
{
    kpi.TargetExpression = newTargetExpression;
    changes.Add("Target Expression");
}

if (modifyStatusExpression)
{
    kpi.StatusExpression = newStatusExpression;
    changes.Add("Status Expression");
}

if (modifyTrendExpression)
{
    kpi.TrendExpression = newTrendExpression;
    changes.Add("Trend Expression");
}

if (modifyDescriptions)
{
    kpi.TargetDescription = newTargetDescription;
    kpi.StatusDescription = newStatusDescription;
    kpi.TrendDescription = newTrendDescription;
    changes.Add("Descriptions");
}

if (modifyGraphics)
{
    kpi.StatusGraphic = newStatusGraphic;
    kpi.TrendGraphic = newTrendGraphic;
    changes.Add("Graphics");
}

if (modifyTargetFormatString)
{
    kpi.TargetFormatString = newTargetFormatString;
    changes.Add("Target Format String");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Modified KPI\n" +
     "============\n\n" +
     "Measure: " + measure.Table.Name + "/" + measure.Name + "\n\n" +
     "Changes made: " + (changes.Count == 0 ? "(none)" : string.Join(", ", changes)) + "\n\n" +
     "Current KPI properties:\n" +
     "  Target: " + kpi.TargetExpression + "\n" +
     "  Status Graphic: " + kpi.StatusGraphic + "\n" +
     "  Has Trend: " + (!string.IsNullOrWhiteSpace(kpi.TrendExpression) ? "Yes" : "No"));
