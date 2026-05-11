/*
 * Title: Set Format String
 *
 * Description: Applies static format strings to measures/columns using the
 * FormatString property. Use for standard formatting (currency, percentage,
 * numbers, dates) or conditional formatting with [condition] syntax.
 *
 * Usage: Pattern 6 is active by default (auto-assigns based on naming).
 * Uncomment other patterns or custom configuration as needed.
 * CLI: te "workspace/model" set-format-string.csx --file
 *
 * Non-interactive: Yes
 * When to use: After adding tables/measures, or to standardize formatting
 * across the model based on naming conventions.
 */

// Choose a pattern to apply or configure specific measures/columns

// =============================================================================
// PATTERN 1: Currency Measures (Standard)
// Apply "$#,##0.00" to revenue, cost, price, amount measures
// =============================================================================
/*
var currencyPattern = new[] { "revenue", "cost", "price", "amount", "sales", "profit" };
foreach(var measure in Model.AllMeasures)
{
    if(string.IsNullOrEmpty(measure.FormatString) &&
       currencyPattern.Any(p => measure.Name.ToLower().Contains(p)))
    {
        measure.FormatString = "$#,##0.00";
    }
}
*/

// =============================================================================
// PATTERN 2: Currency Measures (Scaled - Auto M/K)
// Apply scaled format: Shows $1.2M for millions, $456K for thousands
// =============================================================================
/*
var scaledCurrencyPattern = new[] { "total", "revenue", "sales" };
foreach(var measure in Model.AllMeasures)
{
    if(string.IsNullOrEmpty(measure.FormatString) &&
       scaledCurrencyPattern.Any(p => measure.Name.ToLower().Contains(p)) &&
       !measure.Name.ToLower().Contains("%"))
    {
        measure.FormatString = "[>=1000000]$0.0,,\"M\";[>=1000]$0.0,\"K\";$#,0";
    }
}
*/

// =============================================================================
// PATTERN 3: Percentage Measures
// Apply "0.00%" to measures with %, Percent, Rate, Margin, Ratio
// =============================================================================
/*
var percentagePattern = new[] { "%", "percent", "rate", "margin", "ratio" };
foreach(var measure in Model.AllMeasures)
{
    if(string.IsNullOrEmpty(measure.FormatString) &&
       percentagePattern.Any(p => measure.Name.ToLower().Contains(p)))
    {
        measure.FormatString = "0.00%";
    }
}
*/

// =============================================================================
// PATTERN 4: Count/Integer Measures
// Apply "#,##0" to count, total, number measures
// =============================================================================
/*
foreach(var measure in Model.AllMeasures)
{
    if(string.IsNullOrEmpty(measure.FormatString) &&
       (measure.Name.StartsWith("#") ||
        measure.Name.ToLower().Contains("count") ||
        measure.Name.ToLower().Contains("number of")))
    {
        measure.FormatString = "#,##0";
    }
}
*/

// =============================================================================
// PATTERN 5: Multi-Section Format (Positive/Negative/Zero/Null)
// Apply different formats for positive, negative, zero, null values
// =============================================================================
/*
var multiSectionMeasures = new Dictionary<string, string>
{
    { "Profit", "$#,##0;-$#,##0;$0;\"N/A\"" },              // Show N/A for null
    { "Variance", "$#,##0.00;($#,##0.00);\"-\";\"\"" },     // Negatives in parens, zero as dash
    { "Change", "\"+\"$#,##0;\"-\"$#,##0;$0" }              // Explicit + and - signs
};

foreach(var entry in multiSectionMeasures)
{
    if(Model.AllMeasures.Any(m => m.Name == entry.Key))
    {
        Model.AllMeasures.First(m => m.Name == entry.Key).FormatString = entry.Value;
    }
}
*/

// =============================================================================
// PATTERN 6: All Currency, Percentage, Count Auto-Assignment
// Applies all three patterns above in one pass
// =============================================================================

foreach(var measure in Model.AllMeasures)
{
    if(!string.IsNullOrEmpty(measure.FormatString)) continue;

    var name = measure.Name.ToLower();

    // Percentage measures
    if(name.Contains("%") || name.Contains("percent") || name.Contains("rate") ||
       name.Contains("margin") || name.Contains("ratio"))
    {
        measure.FormatString = "0.00%";
    }
    // Scaled currency measures (large amounts)
    else if((name.Contains("total") || name.Contains("revenue") || name.Contains("sales")) &&
            !name.Contains("count"))
    {
        measure.FormatString = "[>=1000000]$0.0,,\"M\";[>=1000]$0.0,\"K\";$#,0";
    }
    // Standard currency measures
    else if(name.Contains("cost") || name.Contains("price") || name.Contains("amount") ||
            name.Contains("profit"))
    {
        measure.FormatString = "$#,##0.00";
    }
    // Count/integer measures
    else if(name.StartsWith("#") || name.Contains("count") || name.Contains("number of"))
    {
        measure.FormatString = "#,##0";
    }
}

Info("Format strings applied based on naming patterns");

// =============================================================================
// CUSTOM CONFIGURATION: Specific Measures
// Uncomment and configure for explicit format assignments
// =============================================================================
/*
var customFormats = new Dictionary<string, string>
{
    // Currency
    { "Total Revenue", "$#,##0.00" },
    { "Avg Order Value", "$#,##0.00" },

    // Scaled currency (millions/thousands)
    { "Annual Revenue", "[>=1000000]$0.0,,\"M\";[>=1000]$0.0,\"K\";$#,0" },

    // Percentage
    { "Margin %", "0.00%" },
    { "Growth Rate", "0.0%" },

    // Whole numbers
    { "Order Count", "#,##0" },
    { "Units Sold", "#,##0" },

    // Multi-section (pos;neg;zero;null)
    { "Profit", "$#,##0;-$#,##0;$0;\"--\"" },

    // Conditional precision
    { "Conversion Rate", "[<0.01]0.000%;[<0.1]0.00%;0.0%" }
};

foreach(var entry in customFormats)
{
    if(Model.AllMeasures.Any(m => m.Name == entry.Key))
    {
        var measure = Model.AllMeasures.First(m => m.Name == entry.Key);
        measure.FormatString = entry.Value;
        Info("Set format for '" + entry.Key + "': " + entry.Value");
    }
}
*/

// =============================================================================
// COLUMN FORMAT STRINGS (for imported/DirectQuery columns)
// =============================================================================
/*
var columnFormats = new Dictionary<string, string>
{
    { "Sales.UnitPrice", "$#,##0.00" },
    { "Sales.OrderDate", "mm/dd/yyyy" },
    { "Products.StandardCost", "$#,##0.00" },
    { "Customers.SignupDate", "yyyy-MM-dd" }
};

foreach(var entry in columnFormats)
{
    var parts = entry.Key.Split('.');
    if(parts.Length == 2 &&
       Model.Tables.Contains(parts[0]) &&
       Model.Tables[parts[0]].Columns.Contains(parts[1]))
    {
        Model.Tables[parts[0]].Columns[parts[1]].FormatString = entry.Value;
    }
}
*/

// =============================================================================
// FORMAT STRING REFERENCE
// =============================================================================
//
// CURRENCY:
// "$#,##0.00"     → $1,234.56
// "$#,0"          → $1,235
// "€#,##0.00"     → €1,234.56
//
// PERCENTAGE:
// "0.00%"         → 12.34%
// "0.0%"          → 12.3%
// "0%"            → 12%
//
// NUMBERS:
// "#,##0"         → 1,234 (whole number)
// "#,##0.00"      → 1,234.56 (two decimals)
// "0"             → 1234 (no separator)
//
// DATES:
// "mm/dd/yyyy"    → 11/01/2025
// "yyyy-MM-dd"    → 2025-11-01
// "MMM dd, yyyy"  → Nov 01, 2025
// "Long Date"     → Friday, November 01, 2025
//
// SCALED (MILLIONS/THOUSANDS):
// "#,0,,\"M\""                                    → 1M
// "#,0,\"K\""                                     → 1,234K
// "[>=1000000]$0.0,,\"M\";[>=1000]$0.0,\"K\";$#,0"  → $1.2M or $456K or $89
//
// MULTI-SECTION (positive;negative;zero;null):
// "$#,0;-$#,0;$0;N/A"
//   - Positive: $1,234
//   - Negative: -$1,234
//   - Zero: $0
//   - Null: N/A
//
// CONDITIONAL:
// "[>=1000]$#,##0;$#,##0.00"
//   - If >= 1000: Show as $1,234
//   - Else: Show as $12.34
//
// SYNTAX NOTES:
// - 0 = digit placeholder (shows 0 if no digit)
// - # = digit placeholder (shows nothing if no digit)
// - , = thousands separator
// - . = decimal separator
// - , after last digit = divide by 1,000
// - ,, after last digit = divide by 1,000,000
// - \" = escape quote for literal text
// - [condition] = conditional formatting ([>=value], [<value], etc.)
