// Hide Table
// Sets IsHidden = true for specified table(s)

// Config
var targetMode = "single";  // "single" or "pattern"
var tableName = "FactSales";
var tablePattern = "Fact*";  // For pattern mode

if (targetMode == "single")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }

    Model.Tables[tableName].IsHidden = true;
    Info("Hidden table: " + tableName);
}
else
{
    var tables = Model.Tables.Where(t => 
        System.Text.RegularExpressions.Regex.IsMatch(t.Name, 
            "^" + tablePattern.Replace("*", ".*") + "$")).ToList();

    foreach (var table in tables)
    {
        table.IsHidden = true;
    }

    Info("Hidden " + tables.Count + " table(s) matching pattern: " + tablePattern);
}
