// Rename Table
// Renames a table and optionally updates references

// Config
var oldTableName = "FactSales";
var newTableName = "FactSalesOrders";

// Update references in DAX (measures, calc columns, etc.)
var updateReferences = true;

if (!Model.Tables.Contains(oldTableName))
{
    Error("Table not found: " + oldTableName);
}

if (Model.Tables.Contains(newTableName))
{
    Error("Table already exists with name: " + newTableName);
}

var table = Model.Tables[oldTableName];

// Track references if updating
var updatedObjects = new System.Collections.Generic.List<string>();

if (updateReferences)
{
    var oldReference = "'" + oldTableName + "'";
    var newReference = "'" + newTableName + "'";
    
    // Update measures
    foreach (var measure in Model.AllMeasures)
    {
        if (measure.Expression.Contains(oldReference))
        {
            measure.Expression = measure.Expression.Replace(oldReference, newReference);
            updatedObjects.Add("Measure: " + measure.DaxObjectFullName);
        }
    }
    
    // Update calculated columns
    foreach (var column in Model.AllColumns.OfType<CalculatedColumn>())
    {
        if (column.Expression.Contains(oldReference))
        {
            column.Expression = column.Expression.Replace(oldReference, newReference);
            updatedObjects.Add("Column: " + column.DaxObjectFullName);
        }
    }
    
    // Update calculated tables
    foreach (var calcTable in Model.Tables.Where(t => t.Partitions.Any(p => p.SourceType == PartitionSourceType.Calculated)))
    {
        var partition = calcTable.Partitions.First(p => p.SourceType == PartitionSourceType.Calculated);
        if (partition.Expression.Contains(oldReference))
        {
            partition.Expression = partition.Expression.Replace(oldReference, newReference);
            updatedObjects.Add("Table: " + calcTable.Name);
        }
    }
}

// Rename the table
table.Name = newTableName;

Info("Renamed table: " + oldTableName + " → " + newTableName + "\n\n" +
     (updateReferences ? "Updated " + updatedObjects.Count + " references:\n" + 
      (updatedObjects.Count > 0 ? string.Join("\n", updatedObjects.Take(10)) : "(none)") +
      (updatedObjects.Count > 10 ? "\n... and " + (updatedObjects.Count - 10) + " more" : "") 
      : "References NOT updated"));
