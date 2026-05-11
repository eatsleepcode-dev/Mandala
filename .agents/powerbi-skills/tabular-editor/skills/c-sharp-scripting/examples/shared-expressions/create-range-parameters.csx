// Create RangeStart and RangeEnd Parameters
// Required for incremental refresh

var rangeStartDefault = "#datetime(2020, 1, 1, 0, 0, 0)";
var rangeEndDefault = "#datetime(2025, 12, 31, 0, 0, 0)";

var rangeStartExists = Model.Expressions.Contains("RangeStart");
var rangeEndExists = Model.Expressions.Contains("RangeEnd");

Info("RangeStart exists: " + rangeStartExists.ToString());
Info("RangeEnd exists: " + rangeEndExists.ToString());

if (!rangeStartExists)
{
    var rangeStart = Model.AddExpression("RangeStart");
    rangeStart.Kind = ExpressionKind.M;
    rangeStart.Expression = rangeStartDefault + @" meta
    [
        IsParameterQuery = true,
        IsParameterQueryRequired = true,
        Type = type datetime
    ]";
    Info("Created RangeStart parameter");
}
else
{
    Info("RangeStart parameter already exists");
}

if (!rangeEndExists)
{
    var rangeEnd = Model.AddExpression("RangeEnd");
    rangeEnd.Kind = ExpressionKind.M;
    rangeEnd.Expression = rangeEndDefault + @" meta
    [
        IsParameterQuery = true,
        IsParameterQueryRequired = true,
        Type = type datetime
    ]";
    Info("Created RangeEnd parameter");
}
else
{
    Info("RangeEnd parameter already exists");
}

Info("");
Info("Final parameters:");
foreach(var p in Model.Expressions)
{
    Info("  " + p.Name);
}
