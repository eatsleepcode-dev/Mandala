// Exclude From Model Refresh
// Sets ExcludeFromModelRefresh property on tables

// Config
var targetMode = "single";  // "single", "pattern", "list"
var tableName = "DimDate";
var tablePattern = "Dim*";  // For pattern mode
var tableList = new string[] { "DimDate", "DimTime", "DimCalendar" };  // For list mode
var excludeFromRefresh = true;  // true to exclude, false to include

var affectedTables = new System.Collections.Generic.List<string>();

if (targetMode == "single")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }
    
    var table = Model.Tables[tableName];
    table.ExcludeFromModelRefresh = excludeFromRefresh;
    affectedTables.Add(tableName);
}
else if (targetMode == "pattern")
{
    var tables = Model.Tables.Where(t =>
        System.Text.RegularExpressions.Regex.IsMatch(t.Name,
            "^" + tablePattern.Replace("*", ".*") + "$")).ToList();
    
    foreach (var table in tables)
    {
        table.ExcludeFromModelRefresh = excludeFromRefresh;
        affectedTables.Add(table.Name);
    }
}
else if (targetMode == "list")
{
    foreach (var name in tableList)
    {
        if (Model.Tables.Contains(name))
        {
            Model.Tables[name].ExcludeFromModelRefresh = excludeFromRefresh;
            affectedTables.Add(name);
        }
    }
}

Info((excludeFromRefresh ? "Excluded" : "Included") + " " + affectedTables.Count + " table(s) from model refresh:\n" +
     string.Join("\n", affectedTables));
