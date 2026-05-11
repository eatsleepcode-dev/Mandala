// Delete KPI(s)
// Removes KPI metadata from measures

// ============================================================================
// CONFIGURATION
// ============================================================================

var deleteMode = "single";  // "single", "table", "all"

// Single mode
var measureName = "Sales Actual";
var tableName = "";  // Optional

// Table mode (delete all KPIs in a table)
var tableNameForBulkDelete = "FactSales";

// Confirmation for "all" mode
var confirmDeleteAll = false;

// ============================================================================
// BUILD DELETE LIST
// ============================================================================

var kpisToDelete = new System.Collections.Generic.List<KPI>();

if (deleteMode == "single")
{
    Measure measure = null;

    if (!string.IsNullOrWhiteSpace(tableName))
    {
        if (!Model.Tables.Contains(tableName))
        {
            Error("Table not found: " + tableName);
        }

        if (!Model.Tables[tableName].Measures.Contains(measureName))
        {
            Error("Measure not found: " + measureName);
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

    if (measure.KPI == null)
    {
        Error("Measure does not have a KPI: " + measure.Name);
    }

    kpisToDelete.Add(measure.KPI);
}
else if (deleteMode == "table")
{
    if (!Model.Tables.Contains(tableNameForBulkDelete))
    {
        Error("Table not found: " + tableNameForBulkDelete);
    }

    kpisToDelete.AddRange(
        Model.Tables[tableNameForBulkDelete].Measures
            .Where(m => m.KPI != null)
            .Select(m => m.KPI)
    );
}
else if (deleteMode == "all")
{
    if (!confirmDeleteAll)
    {
        Error("Safety check: Set confirmDeleteAll = true to delete all KPIs");
    }

    kpisToDelete.AddRange(
        Model.AllMeasures
            .Where(m => m.KPI != null)
            .Select(m => m.KPI)
    );
}
else
{
    Error("Invalid deleteMode: " + deleteMode);
}

if (kpisToDelete.Count == 0)
{
    Error("No KPIs found to delete");
}

// ============================================================================
// DELETE KPIS
// ============================================================================

var deletedKPIs = new System.Collections.Generic.List<string>();

foreach (var kpi in kpisToDelete.ToList())
{
    var displayName = kpi.Measure.Table.Name + "/" + kpi.Measure.Name;
    deletedKPIs.Add(displayName);
    kpi.Delete();
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Deleted KPIs\n" +
     "============\n\n" +
     "Mode: " + deleteMode + "\n" +
     "Count: " + deletedKPIs.Count + "\n\n" +
     "Deleted KPIs from measures:\n" +
     string.Join("\n", deletedKPIs.Select(n => "  - " + n).Take(20)) +
     (deletedKPIs.Count > 20 ? "\n  ... and " + (deletedKPIs.Count - 20) + " more" : ""));
