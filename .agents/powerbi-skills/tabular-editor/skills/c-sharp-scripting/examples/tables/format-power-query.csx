// Format Power Query (M Expressions)
// Formats M code using powerqueryformatter.com API
// Works with Shared Expressions and M Partitions

using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// Target mode: "expression", "partition", "all-expressions", "all-partitions"
var targetMode = "expression";

// Target name (ignored if using "all-*" modes)
var targetName = "DatabaseQuery";  // Expression name or Table name

// Formatter settings
var lineWidth = 40;
var applyCustomFormatting = true;  // Apply additional comment formatting

// ============================================================================
// FORMATTER API SETUP
// ============================================================================

string powerqueryformatterAPI = "https://m-formatter.azurewebsites.net/api/v2";
HttpClient client = new HttpClient();

// Track formatting results
int successCount = 0;
int errorCount = 0;
var errors = new System.Collections.Generic.List<string>();

// ============================================================================
// FORMAT FUNCTION
// ============================================================================

string FormatMExpression(string mCode, string objectName)
{
    try
    {
        // Serialize request
        var requestBody = JsonConvert.SerializeObject(
            new {
                code = mCode,
                resultType = "text",
                lineWidth = lineWidth
            });

        var content = new StringContent(requestBody, Encoding.UTF8, "application/json");
        content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

        // Call API
        var response = client.PostAsync(powerqueryformatterAPI, content).Result;

        if (!response.IsSuccessStatusCode)
        {
            errors.Add(objectName + ": API call failed");
            errorCount++;
            return mCode;  // Return original if API fails
        }

        // Parse response
        var result = response.Content.ReadAsStringAsync().Result;
        JObject data = JObject.Parse(result);
        string formattedCode = (string)data["result"];

        // Apply custom formatting if enabled
        if (applyCustomFormatting)
        {
            var replace = new System.Collections.Generic.Dictionary<string, string>
            {
                { "\n//", "\n\n//" },
                { "\n  #", "\n\n  // Step\n  #" },
                { "\n  Source", "\n\n  // Data Source\n  Source" },
                { "\n  Dataflow", "\n\n  // Dataflow Connection Info\n  Dataflow" },
                { "\n  Data =", "\n\n  // Step\n  Data =" },
                { "\n  Navigation =", "\n\n  // Step\n  Navigation =" },
                { "in\n\n  // Step\n  #", "in\n  #" },
                { "\nin", "\n\n// Result\nin" }
            };

            formattedCode = replace.Aggregate(
                formattedCode,
                (before, after) => before.Replace(after.Key, after.Value));
        }

        successCount++;
        return formattedCode;
    }
    catch (Exception ex)
    {
        errors.Add(objectName + ": " + ex.Message);
        errorCount++;
        return mCode;  // Return original on error
    }
}

// ============================================================================
// EXECUTE FORMATTING
// ============================================================================

if (targetMode == "expression")
{
    // Format single shared expression
    if (!Model.Expressions.Contains(targetName))
    {
        Error("Shared expression not found: " + targetName);
    }

    var expr = Model.Expressions[targetName];
    if (expr.Kind != ExpressionKind.M)
    {
        Error("Expression is not M type: " + targetName);
    }

    var formatted = FormatMExpression(expr.Expression, targetName);
    expr.Expression = formatted;
}
else if (targetMode == "partition")
{
    // Format single table's M partition
    if (!Model.Tables.Contains(targetName))
    {
        Error("Table not found: " + targetName);
    }

    var table = Model.Tables[targetName];
    var mPartitions = table.Partitions.Where(p => p.SourceType == PartitionSourceType.M).ToList();

    if (mPartitions.Count == 0)
    {
        Error("No M partitions found in table: " + targetName);
    }

    foreach (var partition in mPartitions)
    {
        var formatted = FormatMExpression(partition.Expression, table.Name + "/" + partition.Name);
        partition.Expression = formatted;
    }
}
else if (targetMode == "all-expressions")
{
    // Format all shared expressions
    var mExpressions = Model.Expressions.Where(e => e.Kind == ExpressionKind.M).ToList();

    foreach (var expr in mExpressions)
    {
        var formatted = FormatMExpression(expr.Expression, "Expression: " + expr.Name);
        expr.Expression = formatted;
    }
}
else if (targetMode == "all-partitions")
{
    // Format all M partitions across all tables
    foreach (var table in Model.Tables)
    {
        var mPartitions = table.Partitions.Where(p => p.SourceType == PartitionSourceType.M).ToList();

        foreach (var partition in mPartitions)
        {
            var formatted = FormatMExpression(partition.Expression, table.Name + "/" + partition.Name);
            partition.Expression = formatted;
        }
    }
}
else
{
    Error("Invalid targetMode: " + targetMode + ". Use 'expression', 'partition', 'all-expressions', or 'all-partitions'");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var summary = "Formatted Power Query:\n" +
              "Mode: " + targetMode + "\n" +
              "Success: " + successCount + "\n" +
              "Errors: " + errorCount;

if (errorCount > 0)
{
    summary += "\n\nErrors:\n" + string.Join("\n", errors);
}

Info(summary);
