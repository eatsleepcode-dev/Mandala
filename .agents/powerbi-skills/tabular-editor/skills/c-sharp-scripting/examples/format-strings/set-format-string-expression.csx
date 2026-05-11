/*
 * Title: Set Format String Expression
 *
 * Description: Applies dynamic DAX-based format strings using the
 * FormatStringExpression property. Use when format needs to change based on
 * DAX logic (calculation groups, switch measures, dynamic scaling).
 *
 * Usage: Pattern 5 is active by default (applies SELECTEDMEASUREFORMATSTRING
 * to all calculation groups). Uncomment other patterns as needed.
 * CLI: te "workspace/model" set-format-string-expression.csx --file
 *
 * Non-interactive: Yes
 * When to use: After creating calculation groups, or for switch measures that
 * need different formats based on selection/value/context.
 *
 * IMPORTANT: FormatStringExpression and FormatString are mutually exclusive.
 * Only works on Measures and CalculationItems (not columns).
 */

// =============================================================================
// PATTERN 1: Calculation Group - Inherit Base Measure Format
// Most common use case: Time intelligence calc groups that need to preserve original measure format
// =============================================================================
/*
var calcGroupName = "Time Intelligence";
if(Model.Tables.Contains(calcGroupName))
{
    var cg = Model.Tables[calcGroupName];
    foreach(var item in cg.CalculationItems)
    {
        // Use SELECTEDMEASUREFORMATSTRING() to inherit format from base measure
        item.FormatStringExpression = "SELECTEDMEASUREFORMATSTRING()";
    }
    Info("Applied SELECTEDMEASUREFORMATSTRING() to all items in '" + calcGroupName + "'");
}
*/

// =============================================================================
// PATTERN 2: Value-Based Conditional Formatting
// Apply different format strings based on measure value
// =============================================================================
/*
var valueMeasures = new Dictionary<string, string>
{
    // Show millions for large values, full amount for smaller values
    {
        "Dynamic Revenue",
        @"IF(
    [Dynamic Revenue] >= 1000000,
    ""$0.0,,\""M\"""",
    ""$#,##0""
)"
    },

    // Show more precision for small percentages
    {
        "Conversion Rate",
        @"IF(
    [Conversion Rate] < 0.01,
    ""0.000%"",
    ""0.00%""
)"
    },

    // Show integer format for round numbers, decimal for others
    {
        "Avg Order Value",
        @"IF(
    INT([Avg Order Value]) = [Avg Order Value],
    ""$#,##0"",
    ""$#,##0.00""
)"
    }
};

foreach(var entry in valueMeasures)
{
    if(Model.AllMeasures.Any(m => m.Name == entry.Key))
    {
        var measure = Model.AllMeasures.First(m => m.Name == entry.Key);
        measure.FormatStringExpression = entry.Value;
        Info("Set dynamic format for '" + entry.Key + "'");
    }
}
*/

// =============================================================================
// PATTERN 3: Switch Measure Format (Field Parameters / Metric Selectors)
// Different format for each selected metric in a switch measure
// =============================================================================
/*
var switchMeasureName = "Selected Metric";
if(Model.AllMeasures.Any(m => m.Name == switchMeasureName))
{
    var measure = Model.AllMeasures.First(m => m.Name == switchMeasureName);

    // Assume you have a 'Metric Selector' table with a [Metric] column
    measure.FormatStringExpression = @"
VAR SelectedMetric = SELECTEDVALUE('Metric Selector'[Metric])
RETURN
SWITCH(
    SelectedMetric,
    ""Revenue"", ""$#,##0"",
    ""Margin %"", ""0.00%"",
    ""Order Count"", ""#,##0"",
    ""Avg Order Value"", ""$#,##0.00"",
    ""#,##0""  // default
)";

    Info("Set switch-based format for '" + switchMeasureName + "'");
}
*/

// =============================================================================
// PATTERN 4: Context-Based Formatting (Based on Filter Context)
// Format changes based on what's selected in the report
// =============================================================================
/*
var contextMeasures = new Dictionary<string, string>
{
    // Show different currency symbol based on selected region
    {
        "Regional Revenue",
        @"VAR SelectedRegion = SELECTEDVALUE('Geography'[Region])
RETURN
SWITCH(
    SelectedRegion,
    ""North America"", ""$#,##0"",
    ""Europe"", ""€#,##0"",
    ""Asia"", ""¥#,##0"",
    ""$#,##0""  // default USD
)"
    },

    // Show daily format for short periods, monthly for long periods
    {
        "Period Value",
        @"VAR DaysInContext = COUNTROWS(ALLSELECTED('Date'))
RETURN
IF(
    DaysInContext <= 31,
    ""$#,##0.00"",        // Daily - show cents
    ""$#,0,,\""M\""""     // Monthly - show millions
)"
    }
};

foreach(var entry in contextMeasures)
{
    if(Model.AllMeasures.Any(m => m.Name == entry.Key))
    {
        var measure = Model.AllMeasures.First(m => m.Name == entry.Key);
        measure.FormatStringExpression = entry.Value;
    }
}
*/

// =============================================================================
// PATTERN 5: ALL Calculation Groups - Apply SELECTEDMEASUREFORMATSTRING()
// Apply to all calculation groups in the model
// =============================================================================

foreach(var table in Model.Tables.Where(t => t.CalculationItems.Any()))
{
    foreach(var item in table.CalculationItems)
    {
        // Preserve base measure format for all calc items
        item.FormatStringExpression = "SELECTEDMEASUREFORMATSTRING()";
    }
    Info("Applied SELECTEDMEASUREFORMATSTRING() to calculation group: " + table.Name);
}

// =============================================================================
// CUSTOM CONFIGURATION: Specific Measures with Dynamic Formats
// =============================================================================
/*
var customDynamicFormats = new Dictionary<string, string>
{
    // Value-based scaling
    {
        "Total Sales",
        @"IF(
    [Total Sales] >= 1000000,
    ""$0.0,,\""M\"""",
    IF(
        [Total Sales] >= 1000,
        ""$0.0,\""K\"""",
        ""$#,##0""
    )
)"
    },

    // Context-based precision
    {
        "Margin %",
        @"VAR MarginValue = [Margin %]
RETURN
IF(
    MarginValue < 0.01,
    ""0.000%"",  // Show 3 decimals for very small margins
    IF(
        MarginValue < 0.1,
        ""0.00%"",   // Show 2 decimals for small margins
        ""0.0%""     // Show 1 decimal for normal margins
    )
)"
    },

    // Selection-based format (switch measure pattern)
    {
        "Dynamic Metric",
        @"VAR SelectedValue = SELECTEDVALUE('Metrics'[Metric Name])
RETURN
SWITCH(
    SelectedValue,
    ""Revenue"", ""$#,##0"",
    ""Cost"", ""$#,##0"",
    ""Margin"", ""0.00%"",
    ""Units"", ""#,##0"",
    ""#,##0""
)"
    }
};

foreach(var entry in customDynamicFormats)
{
    if(Model.AllMeasures.Any(m => m.Name == entry.Key))
    {
        var measure = Model.AllMeasures.First(m => m.Name == entry.Key);
        measure.FormatStringExpression = entry.Value;
        Info("Set dynamic format for '" + entry.Key + "'");
    }
}
*/

// =============================================================================
// IMPORTANT NOTES
// =============================================================================
//
// 1. FormatStringExpression vs FormatString:
//    - They are MUTUALLY EXCLUSIVE
//    - Setting FormatStringExpression clears FormatString (and vice versa)
//    - Use FormatStringExpression ONLY when format needs to be dynamic
//
// 2. Only works on MEASURES (not columns):
//    - DataColumn and CalculatedColumn do NOT support FormatStringExpression
//    - Only Measure and CalculationItem support it
//
// 3. Must return a STRING:
//    - The DAX expression must return a valid format string
//    - Cannot return BLANK() - must have a default format
//
// 4. Escaping quotes:
//    - In C# string: Use "" for literal " in DAX
//    - Example: ""$#,##0"" becomes "$#,##0" in DAX
//    - For format string with literal text: ""$0.0,,\""M\""""
//
// 5. Common use cases:
//    - Calculation groups: SELECTEDMEASUREFORMATSTRING()
//    - Switch measures: SWITCH(SELECTEDVALUE(...), ...)
//    - Value-based: IF([Measure] >= threshold, format1, format2)
//    - Context-based: IF(COUNTROWS(ALLSELECTED(...)), format1, format2)
//
// 6. Performance considerations:
//    - FormatStringExpression evaluates for EVERY cell
//    - Keep logic simple and efficient
//    - Avoid complex calculations in format expressions
//
// =============================================================================
// EXAMPLE OUTPUTS
// =============================================================================
//
// SELECTEDMEASUREFORMATSTRING():
//   - [Revenue] (format: "$#,##0") → Calc group item shows "$#,##0"
//   - [Margin %] (format: "0.00%") → Calc group item shows "0.00%"
//
// Value-based conditional:
//   IF([Sales] >= 1000000, "$0.0,,\"M\"", "$#,##0")
//   - $1,500,000 → $1.5M
//   - $450,000 → $450,000
//
// Switch-based:
//   SWITCH(SELECTEDVALUE('Metrics'[Type]), "Revenue", "$#,##0", ...)
//   - When "Revenue" selected → Shows as $1,234
//   - When "Margin %" selected → Shows as 12.34%
