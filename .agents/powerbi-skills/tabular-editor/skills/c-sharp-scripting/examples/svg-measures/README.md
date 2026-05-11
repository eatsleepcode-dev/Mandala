# SVG Measure Scripts

These scripts create DAX measures that generate inline SVG visualizations for use in Power BI table and matrix visuals.

**All scripts have been converted to non-interactive mode** - configure at the top of each script.

## Configuration Pattern

All updated scripts follow this pattern:

```csharp
// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetTable = "Measures";  // Table to add the SVG measure to
var measureName = "SVG Chart Name";  // Name of the SVG measure

// Measure references (for charts comparing actual vs target)
var actualMeasureName = "Sales Actual";
var targetMeasureName = "Sales Target";

// Column for grouping (used in table/matrix visual)
var groupByTable = "DimProduct";
var groupByColumn = "ProductName";

// Display folder
var displayFolder = "SVGs\\Chart Type";
```

## Usage Instructions

1. Edit the configuration section at the top of the script
2. Update measure names and column references to match your model
3. Run the script to create the SVG measure
4. Add the measure to a table or matrix visual
5. Set Image Size property to Height: 25px, Width: 100px
6. Adjust colors/formatting in the generated DAX as needed

## Special Script

- `add-svg-measure-from-definition-on-clipboard.csx` - Creates SVG measure from clipboard DAX (uses interactive dialog - different workflow)
