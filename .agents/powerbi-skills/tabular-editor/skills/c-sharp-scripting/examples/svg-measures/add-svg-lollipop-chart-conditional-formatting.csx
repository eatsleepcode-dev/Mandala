// Add SVG Lollipop Chart (Conditional Formatting)
// Creates an SVG measure for lollipop chart with conditional colors based on performance
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetTable = "Measures";
var measureName = "SVG Lollipop Chart (Conditional Formatting with Label)";

var actualMeasureName = "Sales Actual";
var targetMeasureName = "Sales Target";

var groupByTable = "DimProduct";
var groupByColumn = "ProductName";

var displayFolder = "SVGs\\Lollipop Chart";

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
---- Bar fill
VAR _LabelFont = ""Segoe UI""
VAR _LabelWeight = ""600"" -- Semibold-ish
VAR _LabelSize = ""11""    -- Semibold-ish


-- Input field config
VAR _Actual = __ACTUAL_MEASURE

VAR _Target = __TARGET_MEASURE
VAR _Performance = DIVIDE ( _Actual - _Target, _Target )


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
            _Actual <= 1E3,  FORMAT ( _Actual, ""#,0."" ),
            _Actual <= 1E4,  FORMAT ( _Actual, ""#,0,.00 K"" ),
            _Actual <= 1E5,  FORMAT ( _Actual, ""#,0,.0 K"" ),
            _Actual <= 1E6,  FORMAT ( _Actual, ""#,0,. K"" ),
            _Actual <= 1E7,  FORMAT ( _Actual, ""#,0,,.00 M"" ),
            _Actual <= 1E8,  FORMAT ( _Actual, ""#,0,,.0 M"" ),
            _Actual <= 1E9,  FORMAT ( _Actual, ""#,0,,. M"" ),
            _Actual <= 1E10, FORMAT ( _Actual, ""#,0,,,.00 bn"" ),
            _Actual <= 1E11, FORMAT ( _Actual, ""#,0,,,.0 bn"" ),
            _Actual <= 1E12, FORMAT ( _Actual, ""#,0,,,. bn"" )
        )

-- Chart Config
VAR _BarMax = 95
VAR _BarMin = 44
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
                __ACTUAL_MEASURE
            ),
            REMOVEFILTERS( __GROUPBY_COLUMN )
        )

    VAR _AxisMax =
        IF (
            HASONEVALUE ( __GROUPBY_COLUMN ),
            _MaxActualsInScope
        ) * 1.1

    VAR _DotSizeMin =
        IF (
            HASONEVALUE ( __GROUPBY_COLUMN ),
            3.5
        )

    -- Normalize values (to get position along X-axis)
    VAR _AxisRange =
        _BarMax - _BarMin

    VAR _ActualNormalized =
        DIVIDE ( _Actual, _AxisMax ) * _AxisRange


-- Vectors and SVG code
VAR _SvgPrefix = ""data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg'>""

---- To sort the SVG in a table or matrix by the bar length
VAR _Sort = ""<desc>"" & FORMAT ( _Actual, ""000000000000"" ) & ""</desc>""

VAR _ActualBar = ""<rect x='"" & _BarMin & ""' y='10' width='"" & _ActualNormalized & ""' height='15%' fill='"" & _BarColor & ""'/>""
VAR _ActualDot = ""<circle cx='"" & _ActualNormalized + _BarMin & ""' cy='11.75' r='"" & MAX ( DIVIDE ( _Actual, _AxisMax ) * 7.5, _DotSizeMin ) & ""' fill='"" & _BarColor &""'/>""

VAR _ActualLabel = ""<text x='40' y='16' font-family='"" & _LabelFont & ""' font-size='"" & _LabelSize & ""' font-weight='"" & _LabelWeight & ""'  text-anchor='end' fill='"" & _LabelColor & ""'>"" & _NumberFormat & ""</text>""

VAR _SvgSuffix = ""</svg>""


-- Final result
VAR _SVG =
    _SvgPrefix

    & _Sort

    & _ActualBar
    & _ActualDot
    & _ActualLabel

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
