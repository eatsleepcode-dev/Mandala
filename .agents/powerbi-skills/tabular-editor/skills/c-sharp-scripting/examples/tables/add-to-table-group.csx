// Add to Table Group
// Sets the TabularEditor_TableGroup annotation on tables

// Config
var targetMode = "single";  // "single" or "pattern"
var tableName = "FactSales";
var tablePattern = "Fact*";  // For pattern mode
var tableGroupName = "Sales";

if (targetMode == "single")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    Model.Tables[tableName].SetAnnotation("TabularEditor_TableGroup", tableGroupName);
    Info("Added " + tableName + " to table group: " + tableGroupName);
}
else
{
    var tables = Model.Tables.Where(t =>
        System.Text.RegularExpressions.Regex.IsMatch(t.Name,
            "^" + tablePattern.Replace("*", ".*") + "$")).ToList();

    foreach (var table in tables)
    {
        table.SetAnnotation("TabularEditor_TableGroup", tableGroupName);
    }

    Info("Added " + tables.Count + " table(s) to group: " + tableGroupName);
}
