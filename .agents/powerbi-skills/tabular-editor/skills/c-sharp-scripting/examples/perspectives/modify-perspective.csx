// Modify Perspective
// Add or remove objects from an existing perspective

// ============================================================================
// CONFIGURATION
// ============================================================================

var perspectiveName = "Sales";

// What to modify
var modifyDescription = false;
var addObjects = true;
var removeObjects = false;

// New description
var newDescription = "Updated sales perspective";

// Add objects mode
var addMode = "table";  // "table", "measure", "column", "hierarchy", "all"

// Add all objects from specific tables
var tablesToAdd = new string[] { "FactOrders" };

// Add specific measures (from any table)
var measuresToAdd = new string[] { "Order Count" };

// Add specific columns (format: "TableName/ColumnName")
var columnsToAdd = new string[] { "DimProduct/ProductName" };

// Add specific hierarchies (format: "TableName/HierarchyName")
var hierarchiesToAdd = new string[] { "DimDate/Calendar" };

// Remove objects mode
var removeMode = "measure";  // "table", "measure", "column", "hierarchy"

// Remove specific objects
var tablesToRemove = new string[] { "DimGeography" };
var measuresToRemove = new string[] { "Old Measure" };
var columnsToRemove = new string[] { "FactSales/ObsoleteColumn" };
var hierarchiesToRemove = new string[] { "DimProduct/OldHierarchy" };

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Perspectives.Contains(perspectiveName))
{
    Error("Perspective not found: " + perspectiveName);
}

var perspective = Model.Perspectives[perspectiveName];

// ============================================================================
// MODIFY PERSPECTIVE
// ============================================================================

var changes = new System.Collections.Generic.List<string>();

if (modifyDescription)
{
    perspective.Description = newDescription;
    changes.Add("Description updated");
}

// Add objects
if (addObjects)
{
    if (addMode == "table" || addMode == "all")
    {
        foreach (var tableName in tablesToAdd)
        {
            if (Model.Tables.Contains(tableName))
            {
                var table = Model.Tables[tableName];
                table.InPerspective[perspective] = true;

                // Add all child objects
                foreach (var measure in table.Measures)
                {
                    measure.InPerspective[perspective] = true;
                }

                foreach (var column in table.Columns)
                {
                    column.InPerspective[perspective] = true;
                }

                foreach (var hierarchy in table.Hierarchies)
                {
                    hierarchy.InPerspective[perspective] = true;
                }

                changes.Add("Added table: " + tableName);
            }
        }
    }

    if (addMode == "measure" || addMode == "all")
    {
        foreach (var measureName in measuresToAdd)
        {
            var measure = Model.AllMeasures.FirstOrDefault(m => m.Name == measureName);
            if (measure != null)
            {
                measure.InPerspective[perspective] = true;
                changes.Add("Added measure: " + measureName);
            }
        }
    }

    if (addMode == "column" || addMode == "all")
    {
        foreach (var columnPath in columnsToAdd)
        {
            var parts = columnPath.Split('/');
            if (parts.Length == 2 && Model.Tables.Contains(parts[0]))
            {
                var table = Model.Tables[parts[0]];
                if (table.Columns.Contains(parts[1]))
                {
                    table.Columns[parts[1]].InPerspective[perspective] = true;
                    changes.Add("Added column: " + columnPath);
                }
            }
        }
    }

    if (addMode == "hierarchy" || addMode == "all")
    {
        foreach (var hierarchyPath in hierarchiesToAdd)
        {
            var parts = hierarchyPath.Split('/');
            if (parts.Length == 2 && Model.Tables.Contains(parts[0]))
            {
                var table = Model.Tables[parts[0]];
                if (table.Hierarchies.Contains(parts[1]))
                {
                    table.Hierarchies[parts[1]].InPerspective[perspective] = true;
                    changes.Add("Added hierarchy: " + hierarchyPath);
                }
            }
        }
    }
}

// Remove objects
if (removeObjects)
{
    if (removeMode == "table")
    {
        foreach (var tableName in tablesToRemove)
        {
            if (Model.Tables.Contains(tableName))
            {
                Model.Tables[tableName].InPerspective[perspective] = false;
                changes.Add("Removed table: " + tableName);
            }
        }
    }

    if (removeMode == "measure")
    {
        foreach (var measureName in measuresToRemove)
        {
            var measure = Model.AllMeasures.FirstOrDefault(m => m.Name == measureName);
            if (measure != null)
            {
                measure.InPerspective[perspective] = false;
                changes.Add("Removed measure: " + measureName);
            }
        }
    }

    if (removeMode == "column")
    {
        foreach (var columnPath in columnsToRemove)
        {
            var parts = columnPath.Split('/');
            if (parts.Length == 2 && Model.Tables.Contains(parts[0]))
            {
                var table = Model.Tables[parts[0]];
                if (table.Columns.Contains(parts[1]))
                {
                    table.Columns[parts[1]].InPerspective[perspective] = false;
                    changes.Add("Removed column: " + columnPath);
                }
            }
        }
    }

    if (removeMode == "hierarchy")
    {
        foreach (var hierarchyPath in hierarchiesToRemove)
        {
            var parts = hierarchyPath.Split('/');
            if (parts.Length == 2 && Model.Tables.Contains(parts[0]))
            {
                var table = Model.Tables[parts[0]];
                if (table.Hierarchies.Contains(parts[1]))
                {
                    table.Hierarchies[parts[1]].InPerspective[perspective] = false;
                    changes.Add("Removed hierarchy: " + hierarchyPath);
                }
            }
        }
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Modified Perspective\n" +
     "====================\n\n" +
     "Name: " + perspectiveName + "\n\n" +
     "Changes made: " + changes.Count + "\n\n" +
     string.Join("\n", changes.Select(c => "  - " + c)));
