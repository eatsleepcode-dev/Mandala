// Parameterize Power Query
// Replace hardcoded values with M parameters in partition expressions

// ============================================================================
// CONFIGURATION
// ============================================================================

// Parameter to create/use
var parameterName = "ServerName";
var parameterValue = "myserver.database.windows.net";  // Default value
var parameterType = "text";  // "text", "number", "logical", "date", "datetime"

// Find/Replace pattern
var findPattern = "\"myserver.database.windows.net\"";  // What to replace (include quotes if text)
var replaceWith = parameterName;  // Parameter reference (without quotes)

// Target scope
var targetMode = "all";  // "single", "table", "all"
var tableName = "FactSales";  // For single/table modes

// ============================================================================
// CREATE OR UPDATE PARAMETER
// ============================================================================

var param Expression;

if (Model.Expressions.Contains(parameterName))
{
    paramExpression = Model.Expressions[parameterName];
    Info("Using existing parameter: " + parameterName);
}
else
{
    paramExpression = Model.AddExpression(parameterName);
    paramExpression.Kind = ExpressionKind.M;

    // Build parameter expression based on type
    var typeDeclaration = "";
    switch (parameterType.ToLower())
    {
        case "text":
            typeDeclaration = "type text";
            paramExpression.Expression = string.Format(
                @"""{0}"" meta [IsParameterQuery=true, IsParameterQueryRequired=true, Type={1}]",
                parameterValue, typeDeclaration);
            break;
        case "number":
            typeDeclaration = "type number";
            paramExpression.Expression = string.Format(
                @"{0} meta [IsParameterQuery=true, IsParameterQueryRequired=true, Type={1}]",
                parameterValue, typeDeclaration);
            break;
        case "logical":
            typeDeclaration = "type logical";
            paramExpression.Expression = string.Format(
                @"{0} meta [IsParameterQuery=true, IsParameterQueryRequired=true, Type={1}]",
                parameterValue.ToLower(), typeDeclaration);
            break;
        case "date":
            typeDeclaration = "type date";
            paramExpression.Expression = string.Format(
                @"#date{0} meta [IsParameterQuery=true, IsParameterQueryRequired=true, Type={1}]",
                parameterValue, typeDeclaration);
            break;
        case "datetime":
            typeDeclaration = "type datetime";
            paramExpression.Expression = string.Format(
                @"#datetime{0} meta [IsParameterQuery=true, IsParameterQueryRequired=true, Type={1}]",
                parameterValue, typeDeclaration);
            break;
        default:
            Error("Invalid parameter type: " + parameterType);
            break;
    }

    Info("Created parameter: " + parameterName);
}

// ============================================================================
// UPDATE PARTITION EXPRESSIONS
// ============================================================================

var partitionsToProcess = new System.Collections.Generic.List<Partition>();

if (targetMode == "single")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }
    var mPartitions = Model.Tables[tableName].Partitions.Where(p => p.SourceType == PartitionSourceType.M).ToList();
    if (mPartitions.Count > 0) partitionsToProcess.Add(mPartitions[0]);
}
else if (targetMode == "table")
{
    if (!Model.Tables.Contains(tableName))
    {
        Error("Table not found: " + tableName);
    }
    partitionsToProcess.AddRange(Model.Tables[tableName].Partitions.Where(p => p.SourceType == PartitionSourceType.M));
}
else
{
    foreach (var table in Model.Tables)
    {
        partitionsToProcess.AddRange(table.Partitions.Where(p => p.SourceType == PartitionSourceType.M));
    }
}

var modifiedPartitions = new System.Collections.Generic.List<string>();

foreach (var partition in partitionsToProcess)
{
    var originalExpression = partition.Expression;

    if (originalExpression.Contains(findPattern))
    {
        var newExpression = originalExpression.Replace(findPattern, replaceWith);
        partition.Expression = newExpression;
        modifiedPartitions.Add(partition.Table.Name + "/" + partition.Name);
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Parameterization Results\n" +
     "=======================\n\n" +
     "Parameter: " + parameterName + "\n" +
     "Type: " + parameterType + "\n" +
     "Default value: " + parameterValue + "\n\n" +
     "Modified " + modifiedPartitions.Count + " partition(s):\n" +
     (modifiedPartitions.Count > 0 ? string.Join("\n", modifiedPartitions) : "(none)"));
