// Add Perspective
// Creates a new perspective and optionally adds objects to it

// ============================================================================
// CONFIGURATION
// ============================================================================

var perspectiveName = "Sales";
var description = "Sales-focused view of the model";

// Include objects in the new perspective
var addObjectsMode = "pattern";  // "none", "all", "pattern", "specific"

// Pattern mode (wildcard matching)
var tablePattern = "Fact*|Dim*";  // Tables matching pattern
var measurePattern = "";  // Empty = all measures from included tables
var columnPattern = "";  // Empty = all columns from included tables
var hierarchyPattern = "";  // Empty = all hierarchies from included tables

// Specific mode (exact names)
var specificTables = new string[] { "FactSales", "DimProduct", "DimDate" };
var specificMeasures = new string[] { "Total Sales", "Total Quantity" };

// ============================================================================
// VALIDATION
// ============================================================================

if (Model.Perspectives.Contains(perspectiveName))
{
    Error("Perspective already exists: " + perspectiveName);
}

// ============================================================================
// CREATE PERSPECTIVE
// ============================================================================

var perspective = Model.AddPerspective(perspectiveName);

if (!string.IsNullOrWhiteSpace(description))
{
    perspective.Description = description;
}

// ============================================================================
// ADD OBJECTS TO PERSPECTIVE
// ============================================================================

int tablesAdded = 0;
int measuresAdded = 0;
int columnsAdded = 0;
int hierarchiesAdded = 0;

if (addObjectsMode == "all")
{
    // Add all tables and their objects
    foreach (var table in Model.Tables)
    {
        table.InPerspective[perspective] = true;
        tablesAdded++;

        foreach (var measure in table.Measures)
        {
            measure.InPerspective[perspective] = true;
            measuresAdded++;
        }

        foreach (var column in table.Columns)
        {
            column.InPerspective[perspective] = true;
            columnsAdded++;
        }

        foreach (var hierarchy in table.Hierarchies)
        {
            hierarchy.InPerspective[perspective] = true;
            hierarchiesAdded++;
        }
    }
}
else if (addObjectsMode == "pattern")
{
    var tableRegex = "^(" + tablePattern.Replace("*", ".*").Replace("|", ")|(") + ")$";

    foreach (var table in Model.Tables)
    {
        if (System.Text.RegularExpressions.Regex.IsMatch(table.Name, tableRegex))
        {
            table.InPerspective[perspective] = true;
            tablesAdded++;

            // Add measures
            if (string.IsNullOrWhiteSpace(measurePattern))
            {
                foreach (var measure in table.Measures)
                {
                    measure.InPerspective[perspective] = true;
                    measuresAdded++;
                }
            }
            else
            {
                var measureRegex = "^" + measurePattern.Replace("*", ".*") + "$";
                foreach (var measure in table.Measures)
                {
                    if (System.Text.RegularExpressions.Regex.IsMatch(measure.Name, measureRegex))
                    {
                        measure.InPerspective[perspective] = true;
                        measuresAdded++;
                    }
                }
            }

            // Add columns
            if (string.IsNullOrWhiteSpace(columnPattern))
            {
                foreach (var column in table.Columns)
                {
                    column.InPerspective[perspective] = true;
                    columnsAdded++;
                }
            }
            else
            {
                var columnRegex = "^" + columnPattern.Replace("*", ".*") + "$";
                foreach (var column in table.Columns)
                {
                    if (System.Text.RegularExpressions.Regex.IsMatch(column.Name, columnRegex))
                    {
                        column.InPerspective[perspective] = true;
                        columnsAdded++;
                    }
                }
            }

            // Add hierarchies
            if (string.IsNullOrWhiteSpace(hierarchyPattern))
            {
                foreach (var hierarchy in table.Hierarchies)
                {
                    hierarchy.InPerspective[perspective] = true;
                    hierarchiesAdded++;
                }
            }
            else
            {
                var hierarchyRegex = "^" + hierarchyPattern.Replace("*", ".*") + "$";
                foreach (var hierarchy in table.Hierarchies)
                {
                    if (System.Text.RegularExpressions.Regex.IsMatch(hierarchy.Name, hierarchyRegex))
                    {
                        hierarchy.InPerspective[perspective] = true;
                        hierarchiesAdded++;
                    }
                }
            }
        }
    }
}
else if (addObjectsMode == "specific")
{
    // Add specific tables
    foreach (var tableName in specificTables)
    {
        if (Model.Tables.Contains(tableName))
        {
            var table = Model.Tables[tableName];
            table.InPerspective[perspective] = true;
            tablesAdded++;

            // Add all columns, measures, hierarchies from this table
            foreach (var measure in table.Measures)
            {
                measure.InPerspective[perspective] = true;
                measuresAdded++;
            }

            foreach (var column in table.Columns)
            {
                column.InPerspective[perspective] = true;
                columnsAdded++;
            }

            foreach (var hierarchy in table.Hierarchies)
            {
                hierarchy.InPerspective[perspective] = true;
                hierarchiesAdded++;
            }
        }
    }

    // Add specific measures (from any table)
    foreach (var measureName in specificMeasures)
    {
        var measure = Model.AllMeasures.FirstOrDefault(m => m.Name == measureName);
        if (measure != null)
        {
            measure.InPerspective[perspective] = true;
            measuresAdded++;
        }
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Created Perspective\n" +
     "===================\n\n" +
     "Name: " + perspectiveName + "\n" +
     "Description: " + (string.IsNullOrWhiteSpace(description) ? "(none)" : description) + "\n" +
     "Mode: " + addObjectsMode + "\n\n" +
     "Objects added:\n" +
     "  Tables: " + tablesAdded + "\n" +
     "  Measures: " + measuresAdded + "\n" +
     "  Columns: " + columnsAdded + "\n" +
     "  Hierarchies: " + hierarchiesAdded);
