// Add SVG Jitter Plot (Single Category)
// Creates an SVG measure for jitter plot showing distribution of values
// Author: Kurt Buhler, Data Goblins
// Original template: Kerry Kolosko

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetTable = "Measures";
var measureName = "SVG Jitter Plot (Single Category)";

var measureValueName = "Sales Amount";  // Measure to plot
var detailColumnTable = "FactSales";
var detailColumnName = "TransactionID";  // Column with individual values to plot as dots (WARNING: LIMITED UNIQUE VALUES)

var groupByTable = "DimProduct";
var groupByColumn = "ProductName";  // Column to group by in table/matrix visual

var displayFolder = "SVGs\\Jitter Plot";

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(targetTable))
{
    Error("Target table not found: " + targetTable);
}

var table = Model.Tables[targetTable];

var measureValue = Model.AllMeasures.FirstOrDefault(m => m.Name == measureValueName);
if (measureValue == null)
{
    Error("Measure not found: " + measureValueName);
}

if (!Model.Tables.Contains(detailColumnTable))
{
    Error("Detail column table not found: " + detailColumnTable);
}

var detailCol = Model.Tables[detailColumnTable].Columns[detailColumnName];
if (detailCol == null)
{
    Error("Detail column not found: " + detailColumnTable + "[" + detailColumnName + "]");
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


-- Fields config
VAR _Values = VALUES( __DETAIL_COLUMN ) -- NOTE: This column has a limited number of values that you can use.
VAR _ValuesByMeasure = ADDCOLUMNS( _Values, ""@Measure"", __MEASURE )


-- Chart config
VAR _SvgWidth = 100     -- NOTE: Match this value in the Image size property of the table or matrix
VAR _SvgHeight = 25     -- NOTE: Match this value in the Image size property of the table or matrix
VAR _JitterAmount = 10  -- NOTE: Adjust this value to control the amount of jitter


----------------------------------------------------------------------------------------
----------------------- END CONFIG - BEYOND HERE THERE BE DRAGONS ----------------------
----------------------------------------------------------------------------------------


VAR _AxisMax = CALCULATE(MAXX( _ValuesByMeasure, [@Measure] ), REMOVEFILTERS( __DETAIL_COLUMN )) * 1.1
    -- NOTE: If the detail column uses a 'Sort By' or 'Group By' property, you need to add it to the REMOVEFILTERS as well.


-- Average line config
VAR _Avg = DIVIDE( AVERAGEX( _ValuesByMeasure, [@Measure] ), _AxisMax ) * _SvgWidth


-- Vectors and SVG code
VAR _SvgPrefix = ""data:image/svg+xml;utf8, <svg width='"" & _SvgWidth & ""' height='"" & _SvgHeight & ""' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' overflow='visible'>""
VAR _Sort = ""<desc>"" & FORMAT ( _Avg, ""000000000000"" ) & ""</desc>""
VAR _AvgLine = ""<rect x='"" & _Avg & ""' y='2' width='1.25' height='80%' fill='red'/>""
VAR _SvgSuffix = ""</svg>""


-- Final result
VAR _SVG =
IF(
    HASONEVALUE( __GROUP_BY_COLUMN ),
    _SvgPrefix &
    _Sort &

    CONCATENATEX( -- Repeats the <circle> tag for each one of the values in the group by column
        _Values,
        VAR _JitterValue = RAND() * _JitterAmount - (_JitterAmount / 2)
        RETURN
        ""<circle cx='"" &
        (__MEASURE / _AxisMax * _SvgWidth) &
        ""' cy='"" & ( _SvgHeight / 2 + _JitterValue) & ""' stroke='#333333' stroke-width='1' stroke-opacity='0.5' r='1.5' fill='gainsboro' fill-opacity='0.5' />"",
        """"
    ) &

    _AvgLine &
    _SvgSuffix
)

RETURN
    _SVG
";

// ============================================================================
// SUBSTITUTE PLACEHOLDERS
// ============================================================================

svgDax = svgDax
    .Replace("__DETAIL_COLUMN", detailCol.DaxObjectFullName)
    .Replace("__GROUP_BY_COLUMN", groupByCol.DaxObjectFullName)
    .Replace("__MEASURE", measureValue.DaxObjectFullName);

// ============================================================================
// CREATE MEASURE
// ============================================================================

var svgMeasure = table.AddMeasure(measureName, svgDax, displayFolder);

svgMeasure.DataCategory = "ImageUrl";
svgMeasure.IsHidden = true;
svgMeasure.Description = measureName + " of " + measureValue.Name + " for each " + detailCol.Name + ", grouped by " + groupByCol.Name;

Info("Created: " + table.Name + "[" + measureName + "]");
