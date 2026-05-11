// Add SVG Diverging Bar Chart
// Creates an SVG measure for diverging bar chart showing variance from target
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetTable = "Measures";  // Table to add the SVG measure to
var measureName = "SVG Diverging Bar Chart";  // Name of the SVG measure

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
-- Use this inside of a Table or a Matrix visual.
-- The 'Image size' property of the Table or Matrix should be set to ""Height"" of 25 px and ""Width"" of 100 px for the best results.


----------------------------------------------------------------------------------------
-------------------- START CONFIG - SAFELY CHANGE STUFF IN THIS AREA -------------------
----------------------------------------------------------------------------------------


-- Color config.

-- Input field config
VAR _Actual = __ACTUAL_MEASURE
VAR _Target = __TARGET_MEASURE
VAR _Performance = _Actual - _Target
VAR _AbsPerformance = ABS ( _Performance )

VAR _LabelFont = ""Segoe UI""
VAR _LabelWeight = ""600"" -- Semibold-ish
VAR _LabelSize = ""11""


-- Color config.
---- Conditional bar fill
VAR _BarColor =
    SWITCH (
        TRUE(),
        _Performance < 0, ""#ffd43b"", -- Light yellow
        _Performance > 0, ""#a5d8ff"", -- Light blue
        ""#CACACA""                    -- Grey
        )

VAR _LabelColor =
    SWITCH (
        TRUE(),
        _Performance < 0, ""#c68c03"", -- Dark yellow
        _Performance > 0, ""#1971c2"", -- Dark blue
        ""#CACACA""                    -- Grey
        )

    -- How to format actuals
    VAR _NumberFormat =
        SWITCH (
            TRUE (),
            _AbsPerformance <= 1E3,  FORMAT ( _Performance, ""+#,0;-#,0"" ),
            _AbsPerformance <= 1E4,  FORMAT ( _Performance, ""+#,0,.00 K;-#,0,.00 K"" ),
            _AbsPerformance <= 1E5,  FORMAT ( _Performance, ""+#,0,.0 K;-#,0,.0 K"" ),
            _AbsPerformance <= 1E6,  FORMAT ( _Performance, ""+#,0, K;-#,0, K"" ),
            _AbsPerformance <= 1E7,  FORMAT ( _Performance, ""+#,0,,.00 M;-#,0,,.00 M"" ),
            _AbsPerformance <= 1E8,  FORMAT ( _Performance, ""+#,0,,.0 M;-#,0,,.0 M"" ),
            _AbsPerformance <= 1E9,  FORMAT ( _Performance, ""+#,0,, M;-#,0,, M"" ),
            _AbsPerformance <= 1E10, FORMAT ( _Performance, ""+#,0,,,.00 bn;-#,0,,,.00 bn"" ),
            _AbsPerformance <= 1E11, FORMAT ( _Performance, ""+#,0,,,.0 bn;-#,0,,,.0 bn"" ),
            _AbsPerformance <= 1E12, FORMAT ( _Performance, ""+#,0,,, bn;-#,0,,, bn"" )
        )

-- Chart Config
VAR _BarMax = 50
VAR _BarMin = 0
VAR _Scope = ALLSELECTED ( __GROUPBY_COLUMN ) -- Table comprising all values that group the actuals and targets


----------------------------------------------------------------------------------------
----------------------- END CONFIG - BEYOND HERE THERE BE DRAGONS ----------------------
----------------------------------------------------------------------------------------


-- Only change the parts of this code if you want to adjust how the SVG visual works or add / remove stuff.

    -- Get axis maximum
    VAR _MaxActualsInScope =
        CALCULATE(
            MAXX(
                _Scope,
                ABS ( __ACTUAL_MEASURE - __TARGET_MEASURE )
            ),
            REMOVEFILTERS( __GROUPBY_COLUMN )
        )

    VAR _AxisMax =
        IF (
            HASONEVALUE ( __GROUPBY_COLUMN ),
            _MaxActualsInScope
        ) * 1.1


    -- Normalize values (to get position along X-axis)
    VAR _AxisRange =
        _BarMax - _BarMin

    VAR _PerformanceNormalized =
        DIVIDE ( _AbsPerformance, _AxisMax ) * _AxisRange


-- Vectors and SVG code
VAR _SvgPrefix = ""data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg'>""

---- To sort the SVG in a table or matrix by the bar length
VAR _Sort = ""<desc>"" & FORMAT ( _Performance, ""000000000000;""""0"""";0"" ) & FORMAT ( _BarMax - _PerformanceNormalized, ""000000000000"" ) & ""</desc>""

VAR _BarBaseline =
    IF (
        HASONEVALUE ( __GROUPBY_COLUMN ),
        ""<rect x='50%' y='0' width='1' height='100%' fill='#33333399'/>"",
        ""<text x='40' y='16' font-family='"" & _LabelFont & ""' font-size='"" & _LabelSize & ""' font-weight='"" & _LabelWeight & ""'  text-anchor='end' fill='"" & _LabelColor & ""'>"" & _NumberFormat & ""</text>""
    )

VAR _ActualBar =
    IF (
        _Performance > 0,
        ""<rect x='50%' y='5' width='"" & _PerformanceNormalized & ""' height='50%' fill='"" & _BarColor & ""'/>"",
        ""<rect x='"" & 50 - _PerformanceNormalized & ""' y='5' width='"" & _PerformanceNormalized & ""' height='50%' fill='"" & _BarColor & ""'/>""
    )

VAR _SvgSuffix = ""</svg>""


-- Final result
VAR _SVG =
    _SvgPrefix

    & _Sort

    & _ActualBar

    & _BarBaseline

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

Info("Created: " + table.Name + "[" + measureName + "]");
