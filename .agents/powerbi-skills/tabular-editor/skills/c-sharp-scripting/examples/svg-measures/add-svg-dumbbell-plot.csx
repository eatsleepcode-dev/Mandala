// Add SVG Dumbbell Plot
// Creates an SVG measure for dumbbell plot comparing actual vs target
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetTable = "Measures";
var measureName = "SVG Dumbbell Plot";

var actualMeasureName = "Sales Actual";
var targetMeasureName = "Sales Target";

var groupByTable = "DimProduct";
var groupByColumn = "ProductName";

var displayFolder = "SVGs\\Dumbbell Plot";

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

-- Input field config
VAR _Actual = __ACTUAL_MEASURE
VAR _Target = __TARGET_MEASURE


-- SVG configuration
VAR _SvgWidth = 100
VAR _SvgMin = 0
VAR _SvgHeight = 25

VAR _Scope = ALLSELECTED ( __GROUPBY_COLUMN )
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

VAR _AxisRange = _SvgWidth - _SvgMin

VAR _ActualNormalized = DIVIDE ( _Actual, _AxisMax ) * _AxisRange
VAR _TargetNormalized = DIVIDE ( _Target, _AxisMax ) * _AxisRange


-- Color config
VAR _TargetCircleColor = ""#F5F5F5""
VAR _TargetStrokeColor = ""#C7C7C7""
VAR _AxisColor =         ""#C7C7C7""

-- Blue
VAR _OnTargetFill      = ""#448FD6""
VAR _OnTargetStroke    = ""#2F6698""

-- Red
VAR _OffTargetFill     = ""#D64444""
VAR _OffTargetStroke   = ""#982F2F""

VAR _Fill = IF ( _Actual > _Target, _OnTargetFill, _OffTargetFill )
VAR _Stroke = IF ( _Actual > _Target, _OnTargetStroke, _OffTargetStroke )

-- Vectors and SVG specification
VAR _SvgPrefix = ""data:image/svg+xml;utf8, <svg width='"" & _SvgWidth & ""' height='"" & _SvgHeight & ""' xmlns='http://www.w3.org/2000/svg'>""

VAR _Sort = ""<desc>"" & FORMAT ( _Actual, ""000000000000"" ) & ""</desc>""

VAR _Axis = ""<line x1='0' y1='"" & _SvgHeight / 2 & ""' x2='"" & _SvgWidth & ""' y2='"" & _SvgHeight / 2 & ""' stroke='"" & _AxisColor & ""'/>""
VAR _Origin = ""<circle cx='2' cy='"" & _SvgHeight / 2 & ""' r='2' fill='"" & _AxisColor & ""'/>""

VAR _ActualCircle = ""<circle cx='"" & _ActualNormalized & ""' cy='"" & _SvgHeight / 2 & ""' r='4' fill='"" & _Fill & ""' stroke='"" & _Stroke & ""' stroke-width='1.5'/>""
VAR _TargetCircle = ""<circle cx='"" & _TargetNormalized & ""' cy='"" & _SvgHeight / 2 & ""' r='4' fill='"" & _TargetCircleColor & ""' stroke='"" & _TargetStrokeColor & ""' stroke-width='1.5'/>""
VAR _DumbbellLine = ""<line x1='"" & _ActualNormalized & ""' y1='"" & _SvgHeight / 2 & ""' x2='"" & _TargetNormalized & ""' y2='"" & _SvgHeight / 2 & ""' stroke='"" & _Fill & ""' stroke-width='3'/>""

VAR _SvgSuffix = ""</svg>""


-- Final result
VAR _Svg =
    _SvgPrefix

    & _Sort

    & _Axis
    & _Origin

    & _DumbbellLine
    & _TargetCircle
    & _ActualCircle

    & _SvgSuffix

RETURN
	 _Svg
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
