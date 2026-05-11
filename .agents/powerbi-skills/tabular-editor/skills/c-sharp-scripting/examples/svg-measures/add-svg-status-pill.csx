// Add SVG Status Pill
// Creates an SVG measure for status pill/badge visualization
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetTable = "Measures";  // Table to add the SVG measure to
var measureName = "SVG Status Pill";  // Name of the SVG measure

// Column for the status text
var groupByTable = "DimProduct";
var groupByColumn = "Status";  // Column containing the status values

// Display folder
var displayFolder = "SVGs\\Text or Callouts";

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(targetTable))
{
    Error("Target table not found: " + targetTable);
}

var table = Model.Tables[targetTable];

// Find column
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


-- Input field config
IF (
    HASONEVALUE( __GROUPBY_COLUMN ),

VAR _CategoryValue =
    SELECTEDVALUE (
        __GROUPBY_COLUMN
    )

VAR _LabelCased = UPPER ( _CategoryValue )

-- Color config.
-- IMPORTANT: You need to change these values to the values you want to color.

VAR _Color =
    SWITCH (
        _CategoryValue,
        ""Active"",     ""#2f9e44"", -- Green
        ""Inactive"",   ""#e03131"", -- Red
        ""Pending"",    ""#f08c00"", -- Yellow
        ""Complete"",   ""#1971c2"", -- Blue
        ""Cancelled"",  ""#343a40"", -- Dark Grey
        ""#000000""
    )


-- Font config.
-- IMPORTANT: You need to change these values to the values you want to bold / lighten.

VAR _FontWeight =
    SWITCH (
        _CategoryValue,
        ""Active"",     ""700"", -- Bold
        ""Complete"",   ""700"", -- Bold
        ""Pending"",    ""600"", -- Semi Bold
        ""Inactive"",   ""400"", -- Normal
        ""Cancelled"",  ""400"", -- Normal
        ""400""
    )

----------------------------------------------------------------------------------------
----------------------- END CONFIG - BEYOND HERE THERE BE DRAGONS ----------------------
----------------------------------------------------------------------------------------


-- Vectors and SVG code
VAR _SvgPrefix =
    ""data:image/svg+xml;utf8, <svg xmlns='http://www.w3.org/2000/svg'>""

VAR _Background =
    ""<rect x='0.5' y='0.5' width='98%' height='95%' rx='15%' fill='""
        & _Color & ""22""
        & ""' stroke='""
        & _Color
        & ""'/>""

VAR _Label =
    ""<text x='50%' y='53%' font-family='Segoe UI' font-size='10.5' font-weight='""
        & _FontWeight
        & ""' fill='""
        & _Color
        & ""' text-anchor='middle' dominant-baseline='middle'>""
        & _LabelCased
        & ""</text>""

VAR _SvgSuffix = ""</svg>""


-- Result
VAR _SVG =
    _SvgPrefix
    & _Background
    & _Label
    & _SvgSuffix


RETURN
    _SVG
)
";

// ============================================================================
// SUBSTITUTE PLACEHOLDERS
// ============================================================================

svgDax = svgDax
    .Replace("__GROUPBY_COLUMN", groupByCol.DaxObjectFullName);

// ============================================================================
// CREATE MEASURE
// ============================================================================

var svgMeasure = table.AddMeasure(measureName, svgDax, displayFolder);

// Set measure properties
svgMeasure.DataCategory = "ImageUrl";
svgMeasure.IsHidden = true;
svgMeasure.Description = measureName + " of " + groupByCol.Name;

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Created SVG Measure\n" +
     "====================\n\n" +
     "Measure: " + table.Name + "[" + measureName + "]\n" +
     "Status Column: " + groupByCol.DaxObjectFullName + "\n\n" +
     "Usage Instructions:\n" +
     "1. Add the measure to a table or matrix visual\n" +
     "2. Set 'Image size' to Height: 25px, Width: 100px\n" +
     "3. Adjust colors and font weights in the SWITCH statements\n" +
     "4. Update status values to match your data\n" +
     "5. Validate the SVG in different filter contexts");
