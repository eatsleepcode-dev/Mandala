// Add SVG Bar Chart (Overlapping Bars with Variance)
// Creates an SVG measure for bar chart with overlapping actual/target bars and variance indicator
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetTable = "Measures";  // Table to add the SVG measure to
var measureName = "SVG Bar Chart (Overlapping with Variance)";  // Name of the SVG measure

// Measure references
var actualMeasureName = "Sales Actual";  // Measure to display as actual
var targetMeasureName = "Sales Target";  // Measure to display as target

// Column for grouping (used in table/matrix visual)
var groupByTable = "DimProduct";
var groupByColumn = "ProductName";

// Display folder
var displayFolder = "SVGs\\Bar Chart";

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(targetTable))
{
    Error("Target table not found: " + targetTable);
}

var table = Model.Tables[targetTable];

var actualMeasure = Model.AllMeasures.FirstOrDefault(m => m.Name == actualMeasureName);
if (actualMeasure == null)
{
    Error("Actual measure not found: " + actualMeasureName);
}

var targetMeasure = Model.AllMeasures.FirstOrDefault(m => m.Name == targetMeasureName);
if (targetMeasure == null)
{
    Error("Target measure not found: " + targetMeasureName);
}

if (!Model.Tables.Contains(groupByTable))
{
    Error("GroupBy table not found: " + groupByTable);
}

var groupByCol = Model.Tables[groupByTable].Columns[groupByColumn];
if (groupByCol == null)
{
    Error("GroupBy column not found: " + groupByTable + "[" + groupByColumn + "]");
}

// ============================================================================
// DAX TEMPLATE
// ============================================================================

string svgDax = @"
-- SVG measure
-- Use this inside of a Table or a Matrix visual.
-- The 'Image size' property of the Table or Matrix must match the values in the config below


----------------------------------------------------------------------------------------
-------------------- START CONFIG - SAFELY CHANGE STUFF IN THIS AREA -------------------
----------------------------------------------------------------------------------------


-- Input field config
VAR _Actual = __ACTUAL_MEASURE
VAR _Target = __TARGET_MEASURE
VAR _Performance = DIVIDE ( _Actual - _Target, _Target )


-- Font config
VAR _Font = ""Segoe UI""
VAR _FontSize = 10
VAR _FontWeight = 600


-- Chart Config
VAR _BarMax = 100
VAR _BarMin = 30
VAR _Scope = ALLSELECTED ( __GROUPBY_COLUMN )


-- Color config.
VAR _ActualColor        = ""#686868"" -- Charcoal
VAR _TargetColor        = ""#e1dfdd"" -- Grey
VAR _VarianceColor     =
    IF (
        _Performance < 0,
        ""#fab005"",  -- Yellow
        ""#2094ff""   -- Blue
    )


----------------------------------------------------------------------------------------
----------------------- END CONFIG - BEYOND HERE THERE BE DRAGONS ----------------------
----------------------------------------------------------------------------------------


VAR _MaxActualsInScope =
    CALCULATE(
        MAXX(
            _Scope,
            __ACTUAL_MEASURE
        ),
        REMOVEFILTERS( __GROUPBY_COLUMN )
    )

VAR _MaxTargetInScope =
    CALCULATE(
        MAXX(
            _Scope,
            __TARGET_MEASURE
        ),
        REMOVEFILTERS( __GROUPBY_COLUMN )
    )

VAR _AxisMax =
    IF (
        HASONEVALUE ( __GROUPBY_COLUMN ),
        MAX( _MaxActualsInScope, _MaxTargetInScope ),
        CALCULATE( MAX( __ACTUAL_MEASURE, __TARGET_MEASURE ), REMOVEFILTERS( __GROUPBY_COLUMN ) )
    ) * 1.1


-- Normalize values (to get position along X-axis)
    VAR _AxisRange =
        _BarMax - _BarMin

    VAR _ActualNormalized =
        DIVIDE ( _Actual, _AxisMax ) * _AxisRange

    VAR _TargetNormalized =
        DIVIDE ( _Target, _AxisMax ) * _AxisRange


-- Vectors and SVG code
VAR _SvgPrefix = ""data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg'>""

VAR _Sort = ""<desc>"" & FORMAT ( _Actual, ""000000000000"" ) & ""</desc>""

VAR _Icon  = ""<text x='"" & _BarMin - 3 & ""' y='13.5' font-family='Segoe UI' font-size='6' font-weight='700' text-anchor='end' fill='"" & _VarianceColor & ""'>"" & FORMAT ( _Performance, ""▲;▼;"" ) & ""</text>""
VAR _Label = ""<text x='"" & _BarMin - 10 & ""' y='15' font-family='"" & _Font & ""' font-size='"" & _FontSize & ""' font-weight='"" & _FontWeight & ""' text-anchor='end' fill='"" & _VarianceColor & ""'>"" & FORMAT ( _Performance, ""#,##0%;#,##0%;#,##0%"" ) & ""</text>""

VAR _ActualBar     = ""<rect x='"" & _BarMin & ""' y='3' width='"" & _ActualNormalized & ""' height='12' stroke ='"" & _ActualColor & ""' fill='"" & _ActualColor & ""'/>""
VAR _TargetBar     = ""<rect x='"" & _BarMin & ""' y='10' width='"" & _TargetNormalized & ""' height='12' stroke='"" & _ActualColor & ""' fill='"" & _TargetColor & ""'/>""
VAR _VarianceBar   = ""<rect x='"" & _BarMin + MIN( _ActualNormalized, _TargetNormalized ) + 1 & ""' y='"" & IF ( _Target > _Actual, 2.9, 9 ) & ""' width='"" & ABS( _ActualNormalized - _TargetNormalized ) - 1 & ""' height='6' stroke='"" & _VarianceColor & ""' fill='"" & _VarianceColor & ""'/>""

VAR _SvgSuffix = ""</svg>""


-- Final result
VAR _SVG =
    _SvgPrefix

    & _Sort

    & _Icon
    & _Label

    & _TargetBar
    & _ActualBar
    & _VarianceBar

    & _SvgSuffix

RETURN
    _SVG
";

// ============================================================================
// SUBSTITUTE PLACEHOLDERS
// ============================================================================

svgDax = svgDax
    .Replace("__ACTUAL_MEASURE", actualMeasure.DaxObjectFullName)
    .Replace("__TARGET_MEASURE", targetMeasure.DaxObjectFullName)
    .Replace("__GROUPBY_COLUMN", groupByCol.DaxObjectFullName);

// ============================================================================
// CREATE MEASURE
// ============================================================================

var svgMeasure = table.AddMeasure(measureName, svgDax, displayFolder);

svgMeasure.DataCategory = "ImageUrl";
svgMeasure.IsHidden = true;
svgMeasure.Description = measureName + " of " + actualMeasure.Name + " vs. " + targetMeasure.Name + ", grouped by " + groupByCol.Name;

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Created SVG Measure\n" +
     "====================\n\n" +
     "Measure: " + table.Name + "[" + measureName + "]\n" +
     "Actual: " + actualMeasure.DaxObjectFullName + "\n" +
     "Target: " + targetMeasure.DaxObjectFullName + "\n" +
     "Group By: " + groupByCol.DaxObjectFullName + "\n\n" +
     "Usage Instructions:\n" +
     "1. Add the measure to a table or matrix visual\n" +
     "2. Set 'Image size' to Height: 25px, Width: 100px\n" +
     "3. Validate the SVG in different filter contexts\n" +
     "4. Adjust colors in the DAX as needed");
