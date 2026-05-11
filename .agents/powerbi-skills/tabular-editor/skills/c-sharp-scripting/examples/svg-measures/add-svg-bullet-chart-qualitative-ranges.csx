// Add SVG Bullet Chart with Qualitative Ranges
// Creates an SVG measure for bullet chart with color-coded performance ranges
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetTable = "Measures";  // Table to add the SVG measure to
var measureName = "SVG Bullet Chart (with Qualitative Ranges)";  // Name of the SVG measure

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
-- The 'Image size' property of the Table or Matrix should be set to 'Height' of 25 and 'Width' of 100 for best results.


----------------------------------------------------------------------------------------
-------------------- START CONFIG - SAFELY CHANGE STUFF IN THIS AREA -------------------
----------------------------------------------------------------------------------------


-- Input field config
VAR _Actual = __ACTUAL_MEASURE
VAR _Target = __TARGET_MEASURE


-- Chart Config
VAR _BarMax = 100
VAR _BarMin = 0
VAR _Scope = ALLSELECTED ( __GROUPBY_COLUMN )

-- Sentiment config
VAR _BadThreshold       = 0.75
VAR _AcceptableThreshold= 0.90
VAR _BadColor           = ""#f8f9fa""
VAR _AcceptableColor    = ""#e9ecef""
VAR _SatisfactoryColor  = ""#ced4da""


-- Color config.
VAR _BarFillColor       = ""#ffd43b"" -- Yellow
VAR _BarStrokeColor     = ""#fab005"" -- Dark Yellow
VAR _BaselineColor      = ""#737373"" -- Dark grey
VAR _TargetColor        = ""black""   -- Black


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
        DIVIDE ( _Target, _AxisMax ) * _AxisRange + _BarMin - 1


-- Sentiment normalized (percent)
VAR _Bad                = _BadThreshold * _TargetNormalized
VAR _Acceptable         = _AcceptableThreshold * _TargetNormalized


-- Vectors and SVG code
VAR _SvgPrefix = ""data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg'>""

VAR _Sort = ""<desc>"" & FORMAT ( _Actual, ""000000000000"" ) & ""</desc>""

VAR _BarBaseline = ""<rect x='"" & _BarMin - 1 & ""' y='0' width='1' height='100%' fill='"" & _BaselineColor & ""'/>""

VAR _BarSatisfactory = ""<rect x='"" & _BarMin & ""' y='2' width='"" & _Bad & ""' height='75%' fill='"" & _SatisfactoryColor & ""'/>""
VAR _BarAcceptable = ""<rect x='"" & _BarMin & ""' y='2' width='"" & _Acceptable & ""' height='75%' fill='"" & _AcceptableColor & ""'/>""
VAR _BarBad = ""<rect x='"" & _BarMin & ""' y='2' width='"" & _BarMax & ""' height='75%' fill='"" & _BadColor & ""'/>""

VAR _ActualBar  = ""<rect x='"" & _BarMin & ""' y='7' width='"" & _ActualNormalized & ""' height='33%' fill='"" & _BarFillColor & ""' stroke='"" & _BarStrokeColor & ""' stroke-width='1'/>""
VAR _TargetLine = ""<rect x='"" & _TargetNormalized & ""' y='2' width='1.5' height='80%' fill='"" & _TargetColor & ""'/>""

VAR _SvgSuffix = ""</svg>""


-- Final result
VAR _SVG =
    _SvgPrefix

    & _Sort

    & _BarBad
    & _BarAcceptable
    & _BarSatisfactory

    & _ActualBar
    & _TargetLine
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
     "3. Adjust qualitative thresholds and colors in DAX\n" +
     "4. Validate the SVG in different filter contexts");
