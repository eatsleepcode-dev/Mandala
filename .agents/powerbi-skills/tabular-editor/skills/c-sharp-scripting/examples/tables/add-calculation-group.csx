// Add Calculation Group
// Creates calc group with time intelligence items (YTD, QTD, MTD, PY, etc)
// Use: calcGroupName="Time Intelligence" precedence=10
var calcGroupName = "Time Intelligence";
var precedence = 10;

// Create the calculation group
var cg = Model.AddCalculationGroup(calcGroupName);
// Note: Precedence property only exists in TE3, not TE2
cg.Description = "Common time intelligence calculations";

// Add calculation items
var ytd = cg.AddCalculationItem("YTD", "CALCULATE(SELECTEDMEASURE(), DATESYTD('Date'[Date]))");
ytd.Ordinal = 0;
ytd.FormatStringExpression = "SELECTEDMEASUREFORMATSTRING()";

var qtd = cg.AddCalculationItem("QTD", "CALCULATE(SELECTEDMEASURE(), DATESQTD('Date'[Date]))");
qtd.Ordinal = 1;
qtd.FormatStringExpression = "SELECTEDMEASUREFORMATSTRING()";

var mtd = cg.AddCalculationItem("MTD", "CALCULATE(SELECTEDMEASURE(), DATESMTD('Date'[Date]))");
mtd.Ordinal = 2;
mtd.FormatStringExpression = "SELECTEDMEASUREFORMATSTRING()";

var py = cg.AddCalculationItem("PY", "CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR('Date'[Date]))");
py.Ordinal = 3;
py.FormatStringExpression = "SELECTEDMEASUREFORMATSTRING()";

var pyGrowth = cg.AddCalculationItem(
    "PY Growth %",
    @"
VAR CurrentValue = SELECTEDMEASURE()
VAR PriorValue = CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR('Date'[Date]))
RETURN
    DIVIDE(CurrentValue - PriorValue, PriorValue)
"
);
pyGrowth.Ordinal = 4;
pyGrowth.FormatStringExpression = "\"0.0%\"";

var mom = cg.AddCalculationItem(
    "MoM",
    @"
VAR CurrentValue = SELECTEDMEASURE()
VAR PriorValue = CALCULATE(SELECTEDMEASURE(), DATEADD('Date'[Date], -1, MONTH))
RETURN
    CurrentValue - PriorValue
"
);
mom.Ordinal = 5;
mom.FormatStringExpression = "SELECTEDMEASUREFORMATSTRING()";

// Set the Name column (first column in calculation group) properties
cg.Columns[calcGroupName].IsAvailableInMDX = false;

Info("Created calculation group: " + calcGroupName + " with " + cg.CalculationItems.Count + " items");
