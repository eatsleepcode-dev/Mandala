// Add DateTime to Int Conversion Function
// Creates M function for converting datetime to integer date keys (YYYYMMDD)
// Used with incremental refresh on integer date columns
// Author: Kurt Buhler, Data Goblins
// Source: Tabular Editor Documentation

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var functionName = "fxDateTimeToInt";

// This function converts datetime values to integer format (YYYYMMDD)
// Example: 2024-03-15 -> 20240315
// Used for incremental refresh filtering on integer date key columns

// ============================================================================
// VALIDATION
// ============================================================================

if (Model.Expressions.Contains(Model.Expressions[functionName]))
{
    Error("Function '" + functionName + "' already exists in the model.\n\n" +
          "Use a different name or delete the existing function first.");
}

// ============================================================================
// CREATE FUNCTION
// ============================================================================

var dateTimeToIntFunction = Model.AddExpression(
    functionName,
    @"(x as datetime) => Date.Year(x) * 10000 + Date.Month(x) * 100 + Date.Day(x)"
);

// Set annotation to mark as function
dateTimeToIntFunction.SetAnnotation("PBI_ResultType", "Function");
dateTimeToIntFunction.Kind = ExpressionKind.M;

// ============================================================================
// CONFIRMATION MESSAGE
// ============================================================================

var message = "DATETIME TO INT FUNCTION CREATED\n";
message += "═══════════════════════════════════════════════════════════\n\n";
message += "Function Name: " + functionName + "\n";
message += "Formula: (x as datetime) => Date.Year(x) * 10000 + Date.Month(x) * 100 + Date.Day(x)\n\n";

message += "USAGE\n";
message += "───────────────────────────────────────────────────────────\n\n";

message += "Use this function in M expressions for incremental refresh:\n\n";

message += "Example with integer date key column:\n";
message += "```\n";
message += "#\"Incremental Refresh\" = Table.SelectRows(\n";
message += "    Source,\n";
message += "    each [OrderDateKey] >= fxDateTimeToInt(#\"RangeStart\")\n";
message += "    and [OrderDateKey] < fxDateTimeToInt(#\"RangeEnd\")\n";
message += ")\n";
message += "```\n\n";

message += "This converts RangeStart/RangeEnd parameters to integers\n";
message += "for comparison with integer date key columns (YYYYMMDD format).\n";

Info(message);
