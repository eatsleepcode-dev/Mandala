// List all Perspectives
// Reports all perspectives and their contents

// ============================================================================
// CONFIGURATION
// ============================================================================

var showObjectCounts = true;  // Show counts of objects in each perspective
var showDetailedObjects = false;  // List all objects in each perspective (verbose)

// ============================================================================
// BUILD PERSPECTIVE LIST
// ============================================================================

if (Model.Perspectives.Count == 0)
{
    Info("No perspectives found in model");
    return;
}

// ============================================================================
// BUILD REPORT
// ============================================================================

var report = new System.Text.StringBuilder();
report.AppendLine("Perspectives");
report.AppendLine("============\n");
report.AppendLine("Total: " + Model.Perspectives.Count + "\n");
report.AppendLine(new string('=', 50) + "\n");

// List each perspective
foreach (var perspective in Model.Perspectives)
{
    report.AppendLine("Name: " + perspective.Name);

    if (!string.IsNullOrWhiteSpace(perspective.Description))
    {
        report.AppendLine("  Description: " + perspective.Description);
    }

    if (showObjectCounts)
    {
        // Count objects in this perspective
        int tableCount = 0;
        int measureCount = 0;
        int columnCount = 0;
        int hierarchyCount = 0;

        foreach (var table in Model.Tables)
        {
            if (table.InPerspective[perspective])
            {
                tableCount++;
            }

            foreach (var measure in table.Measures)
            {
                if (measure.InPerspective[perspective])
                {
                    measureCount++;
                }
            }

            foreach (var column in table.Columns)
            {
                if (column.InPerspective[perspective])
                {
                    columnCount++;
                }
            }

            foreach (var hierarchy in table.Hierarchies)
            {
                if (hierarchy.InPerspective[perspective])
                {
                    hierarchyCount++;
                }
            }
        }

        report.AppendLine("\n  Object counts:");
        report.AppendLine("    Tables: " + tableCount);
        report.AppendLine("    Measures: " + measureCount);
        report.AppendLine("    Columns: " + columnCount);
        report.AppendLine("    Hierarchies: " + hierarchyCount);
    }

    if (showDetailedObjects)
    {
        var tables = new System.Collections.Generic.List<string>();
        var measures = new System.Collections.Generic.List<string>();
        var columns = new System.Collections.Generic.List<string>();
        var hierarchies = new System.Collections.Generic.List<string>();

        foreach (var table in Model.Tables)
        {
            if (table.InPerspective[perspective])
            {
                tables.Add(table.Name);
            }

            foreach (var measure in table.Measures)
            {
                if (measure.InPerspective[perspective])
                {
                    measures.Add(table.Name + "/" + measure.Name);
                }
            }

            foreach (var column in table.Columns)
            {
                if (column.InPerspective[perspective])
                {
                    columns.Add(table.Name + "/" + column.Name);
                }
            }

            foreach (var hierarchy in table.Hierarchies)
            {
                if (hierarchy.InPerspective[perspective])
                {
                    hierarchies.Add(table.Name + "/" + hierarchy.Name);
                }
            }
        }

        if (tables.Count > 0)
        {
            report.AppendLine("\n  Tables:");
            foreach (var t in tables.Take(10))
            {
                report.AppendLine("    - " + t);
            }
            if (tables.Count > 10)
            {
                report.AppendLine("    ... and " + (tables.Count - 10) + " more");
            }
        }

        if (measures.Count > 0)
        {
            report.AppendLine("\n  Measures:");
            foreach (var m in measures.Take(10))
            {
                report.AppendLine("    - " + m);
            }
            if (measures.Count > 10)
            {
                report.AppendLine("    ... and " + (measures.Count - 10) + " more");
            }
        }

        if (hierarchies.Count > 0)
        {
            report.AppendLine("\n  Hierarchies:");
            foreach (var h in hierarchies.Take(10))
            {
                report.AppendLine("    - " + h);
            }
            if (hierarchies.Count > 10)
            {
                report.AppendLine("    ... and " + (hierarchies.Count - 10) + " more");
            }
        }
    }

    report.AppendLine("");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info(report.ToString());
