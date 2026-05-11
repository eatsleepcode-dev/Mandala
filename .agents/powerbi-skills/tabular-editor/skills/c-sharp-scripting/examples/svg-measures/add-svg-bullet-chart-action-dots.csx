// Add SVG Bullet Chart with Action Dots
// Creates an SVG measure for bullet chart with performance-based action indicator dots
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetTable = "Measures";  // Table to add the SVG measure to
var measureName = "SVG Bullet Chart (with Action Dots)";  // Name of the SVG measure

// Measure references
var actualMeasureName = "Sales Actual";  // Measure to display as actual
var targetMeasureName = "Sales Target";  // Measure to display as target

// Column for grouping (used in table/matrix visual)
var groupByTable = "DimProduct";
var groupByColumn = "ProductName";

// Display folder
var displayFolder = "SVGs\\Bullet Chart";

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
-- The 'Image size' property of the Table or Matrix should be set to a 'Height' of 25px and a 'Width' of 100px


----------------------------------------------------------------------------------------
-------------------- START CONFIG - SAFELY CHANGE STUFF IN THIS AREA -------------------
----------------------------------------------------------------------------------------


-- Input field config
VAR _Actual = __ACTUAL_MEASURE
VAR _Target = __TARGET_MEASURE
VAR _Performance = DIVIDE ( _Actual - _Target, _Target )


-- Sentiment config (percent)
VAR _VeryBad    = -0.25
VAR _Bad        = -0.1
VAR _Good       = 0.1
VAR _VeryGood   = 0.25


-- Chart Config
VAR _BarMax = 100
VAR _BarMin = 20
VAR _Scope = ALL ( __GROUPBY_COLUMN )


-- Color config.
VAR _BackgroundColor = ""#F5F5F5""                  -- Light grey
VAR _BarFillColor  = ""#CFCFCF""                    -- Medium grey
VAR _BaselineColor = ""#737373""                    -- Dark grey
VAR _TargetColor = ""black""                        -- Black

VAR _ActionDotFill =
    SWITCH (
        TRUE(),
        _Performance < _VeryBad, ""#f4ae4c"",       -- Dark yellow
        _Performance < _Bad, ""#ffe075"",           -- Light yellow
        _Performance > _Good, ""#74B2FF"",          -- Light blue
        _Performance > _VeryGood, ""#2D6390"",      -- Dark blue
        ""#FFFFFF00""                               -- Transparent
    )


----------------------------------------------------------------------------------------
----------------------- END CONFIG - BEYOND HERE THERE BE DRAGONS ----------------------
----------------------------------------------------------------------------------------


    -- Get axis maximum
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

    VAR _AxisRange =
        _BarMax - _BarMin

    -- Normalize values (to get position along X-axis)
    VAR _ActualNormalized = ( DIVIDE ( _Actual, _AxisMax ) * _AxisRange )
    VAR _TargetNormalized = ( DIVIDE ( _Target, _AxisMax ) * _AxisRange ) + _BarMin - 1


-- Vectors and SVG code
VAR _SvgPrefix = ""data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg'>""

VAR _Sort = ""<desc>"" & FORMAT ( _Actual, ""000000000000"" ) & ""</desc>""

VAR _ActionDot  = ""<circle cx='10' cy='11' r='5' fill='"" & _ActionDotFill &""'/>""

VAR _BarBaseline = ""<rect x='"" & _BarMin & ""' y='4' width='1' height='60%' fill='"" & _BaselineColor & ""'/>""
VAR _BarBackground = ""<rect x='"" & _BarMin & ""' y='2' width='"" & _BarMax & ""' height='80%' fill='"" & _BackgroundColor & ""'/>""
VAR _ActualBar  = ""<rect x='"" & _BarMin & ""' y='5' width='"" & _ActualNormalized & ""' height='50%' fill='"" & _BarFillColor & ""'/>""
VAR _TargetLine = ""<rect x='"" & _TargetNormalized & ""' y='2' width='2' height='80%' fill='"" & _TargetColor & ""'/>""

VAR _SvgSuffix = ""</svg>""


-- Final result
VAR _SVG =
    _SvgPrefix

    & _Sort

    & _ActionDot

    & _BarBackground
    & _ActualBar
    & _BarBaseline
    & _TargetLine

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
     "3. Adjust sentiment thresholds in DAX as needed\n" +
     "4. Validate the SVG in different filter contexts");
