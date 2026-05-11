// Add/Set Display Folder
// Assigns measures/columns to folder path. Supports nested folders with /
// Use: table="Sales" targetFolder="Revenue/Metrics" targetType="measures" selectionMethod="pattern"

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// Display folder path (use forward slashes for nested folders)
// Example: "Sales/Key Metrics" creates Sales\Key Metrics hierarchy
var targetFolder = "Sales/Revenue Metrics";

// Target type: "measures" or "columns"
var targetType = "measures";

// Target selection method: "table", "pattern", "list"
var selectionMethod = "pattern";

// Method: "table" - Specify table name
var tableName = "Sales";

// Method: "pattern" - Specify name pattern (measures/columns matching this pattern)
var namePattern = "Revenue";  // Matches: "Total Revenue", "Revenue YTD", etc.

// Method: "list" - Specify exact names
var objectNames = new[] { "Total Revenue", "Revenue per Customer", "Revenue Growth %" };

// ============================================================================
// SCRIPT LOGIC
// ============================================================================

var updatedCount = 0;

if (targetType.ToLower() == "measures")
{
    // Work with measures
    var measures = new List<Measure>();

    if (selectionMethod == "table" && Model.Tables.Contains(tableName))
    {
        measures = Model.Tables[tableName].Measures.ToList();
    }
    else if (selectionMethod == "pattern")
    {
        measures = Model.AllMeasures.Where(m => m.Name.Contains(namePattern)).ToList();
    }
    else if (selectionMethod == "list")
    {
        foreach(var name in objectNames)
        {
            foreach(var table in Model.Tables)
            {
                if(table.Measures.Contains(name))
                {
                    measures.Add(table.Measures[name]);
                    break;
                }
            }
        }
    }

    foreach(var measure in measures)
    {
        measure.DisplayFolder = targetFolder;
        updatedCount++;
    }
}
else if (targetType.ToLower() == "columns")
{
    // Work with columns
    var columns = new List<Column>();

    if (selectionMethod == "table" && Model.Tables.Contains(tableName))
    {
        columns = Model.Tables[tableName].Columns.ToList();
    }
    else if (selectionMethod == "pattern")
    {
        columns = Model.AllColumns.Where(c => c.Name.Contains(namePattern)).ToList();
    }
    else if (selectionMethod == "list")
    {
        foreach(var name in objectNames)
        {
            foreach(var table in Model.Tables)
            {
                if(table.Columns.Contains(name))
                {
                    columns.Add(table.Columns[name]);
                    break;
                }
            }
        }
    }

    foreach(var column in columns)
    {
        column.DisplayFolder = targetFolder;
        updatedCount++;
    }
}

Info("Assigned " + updatedCount + " " + targetType + " to folder: " + targetFolder);
