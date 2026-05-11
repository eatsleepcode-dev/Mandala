// Exclude From Automatic Aggregations
// Sets ExcludeFromAutomaticAggregations property on tables

// Config
var targetMode = "single";  // "single", "pattern", "list"
var tableName = "FactTransactions";
var tablePattern = "Fact*";  // For pattern mode
var tableList = new string[] { "FactSales", "FactOrders" };  // For list mode
var excludeFromAgg = true;  // true to exclude, false to include

var affectedTables = new System.Collections.Generic.List<string>();

if (targetMode == "single")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }
    
    var table = Model.Tables[tableName];
    table.ExcludeFromAutomaticAggregations = excludeFromAgg;
    affectedTables.Add(tableName);
}
else if (targetMode == "pattern")
{
    var tables = Model.Tables.Where(t =>
        System.Text.RegularExpressions.Regex.IsMatch(t.Name,
            "^" + tablePattern.Replace("*", ".*") + "$")).ToList();
    
    foreach (var table in tables)
    {
        table.ExcludeFromAutomaticAggregations = excludeFromAgg;
        affectedTables.Add(table.Name);
    }
}
else if (targetMode == "list")
{
    foreach (var name in tableList)
    {
        if (Model.Tables.Contains(name))
        {
            Model.Tables[name].ExcludeFromAutomaticAggregations = excludeFromAgg;
            affectedTables.Add(name);
        }
    }
}

Info((excludeFromAgg ? "Excluded" : "Included") + " " + affectedTables.Count + " table(s) from automatic aggregations:\n" +
     string.Join("\n", affectedTables) + "\n\n" +
     "Note: This affects Power BI's automatic aggregation feature in composite models.");
