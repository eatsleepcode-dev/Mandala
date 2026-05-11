// Add Date Table
// Creates a comprehensive date dimension table with calendar hierarchy
// Based on SQLBI.com date table pattern

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

var tableName = "Date";
var measureTableName = "_Measures";  // Where to place RefDate measure

// Option 1: Use explicit date range
var useExplicitDates = true;
var startDate = "DATE(2020, 1, 1)";
var endDate = "DATE(2025, 12, 31)";

// Option 2: Use date columns from model (if useExplicitDates = false)
var earliestDateColumn = "'Sales'[OrderDate]";  // Must be valid DAX column reference
var latestDateColumn = "'Sales'[OrderDate]";

// ============================================================================
// BUILD DATE TABLE DAX EXPRESSION
// ============================================================================

// Determine date range source
var earliestDateLogic = useExplicitDates
    ? startDate
    : "DATE ( YEAR ( MIN ( " + earliestDateColumn + " ) ) - 2, 1, 1 )";

var latestDateLogic = useExplicitDates
    ? endDate
    : "DATE ( YEAR ( MAX ( " + latestDateColumn + " ) ) + 2, 12, 31 )";

// Create RefDate measure (reference date for "current" calculations)
var measureTable = Model.Tables.Contains(measureTableName)
    ? Model.Tables[measureTableName]
    : Model.Tables[0];  // Fallback to first table

var refDateMeasure = measureTable.AddMeasure(
    "RefDate",
    useExplicitDates
        ? "TODAY()"
        : "CALCULATE ( MAX ( " + latestDateColumn + " ), REMOVEFILTERS ( ) )"
);
refDateMeasure.IsHidden = true;
refDateMeasure.Description = "Reference date for time intelligence calculations";

// Build the date table DAX expression
var dateDaxExpression = @"
-- Reference date for the latest date in the report
VAR _Refdate_Measure = [RefDate]
VAR _Today = TODAY()
VAR _Refdate = IF ( ISBLANK ( _Refdate_Measure ), _Today, _Refdate_Measure )
    VAR _RefYear = YEAR ( _Refdate )
    VAR _RefQuarter = _RefYear * 100 + QUARTER(_Refdate)
    VAR _RefMonth = _RefYear * 100 + MONTH(_Refdate)
    VAR _RefWeek_EU = _RefYear * 100 + WEEKNUM(_Refdate, 2)

-- Date range
VAR _EarliestDate = " + earliestDateLogic + @"
VAR _LatestDate = " + latestDateLogic + @"

-- Base calendar table
VAR _Base_Calendar = CALENDAR ( _EarliestDate, _LatestDate )

-- Add calculated columns
VAR _IntermediateResult =
    ADDCOLUMNS ( _Base_Calendar,

        -- Year columns
        ""Calendar Year Number (ie 2021)"", YEAR ([Date]),
        ""Calendar Year (ie 2021)"", FORMAT ([Date], ""YYYY""),

        -- Quarter columns
        ""Calendar Quarter Year (ie Q1 2021)"", ""Q"" & CONVERT(QUARTER([Date]), STRING) & "" "" & CONVERT(YEAR([Date]), STRING),
        ""Calendar Year Quarter (ie 202101)"", YEAR([Date]) * 100 + QUARTER([Date]),
        ""Calendar Quarter # (ie 1)"", QUARTER([Date]),

        -- Month columns
        ""Calendar Month Year (ie Jan 21)"", FORMAT ( [Date], ""MMM YY"" ),
        ""Calendar Year Month (ie 202101)"", YEAR([Date]) * 100 + MONTH([Date]),
        ""Calendar Month (ie Jan)"", FORMAT ( [Date], ""MMM"" ),
        ""Calendar Month # (ie 1)"", MONTH([Date]),
        ""Calendar Month Day (i.e. Jan 05)"", FORMAT ( [Date], ""MMM DD"" ),
        ""Calendar Month Day (i.e. 0105)"", MONTH([Date]) * 100 + DAY([Date]),

        -- Week columns
        ""Calendar Year Week Number EU (ie 202125)"", YEAR([Date]) * 100 + WEEKNUM([Date], 2),
        ""Calendar Week Number EU (ie 25)"", WEEKNUM([Date], 2),
        ""Calendar Week EU (ie WK25)"", ""WK"" & FORMAT(WEEKNUM([Date], 2), ""00""),

        -- Day columns
        ""Weekday Number EU (i.e. 1)"", WEEKDAY([Date], 2),
        ""Weekday Name (i.e. Monday)"", FORMAT([Date], ""DDDD""),
        ""Weekday Short (i.e. Mon)"", FORMAT([Date], ""DDD""),
        ""Day of Month (i.e. 15)"", DAY([Date]),

        -- Boolean flags for working days
        ""IsWeekday"", WEEKDAY([Date], 2) IN {1, 2, 3, 4, 5}
    )

-- Add time intelligence boolean flags
VAR _Result =
    ADDCOLUMNS (
        _IntermediateResult,
        ""IsThisYear"", [Calendar Year Number (ie 2021)] = _RefYear,
        ""IsThisMonth"", [Calendar Year Month (ie 202101)] = _RefMonth,
        ""IsThisQuarter"", [Calendar Year Quarter (ie 202101)] = _RefQuarter,
        ""IsThisWeek"", [Calendar Year Week Number EU (ie 202125)] = _RefWeek_EU
    )

RETURN _Result";

// ============================================================================
// CREATE DATE TABLE
// ============================================================================

var dateTable = Model.AddCalculatedTable(tableName, dateDaxExpression);
dateTable.DataCategory = "Time";
dateTable.Description = "Calendar date dimension with year/quarter/month/week/day hierarchy";

// ============================================================================
// CONFIGURE SORT BY COLUMNS (TE3 auto-creates columns)
// ============================================================================

// Check if running in TE2 (columns not auto-created)
var isTE2 = dateTable.Columns.Count == 0;

if (!isTE2)
{
    // TE3: Columns exist, configure sorting

    // Weekday sorting
    if(dateTable.Columns.Contains("Weekday Name (i.e. Monday)"))
        dateTable.Columns["Weekday Name (i.e. Monday)"].SortByColumn = dateTable.Columns["Weekday Number EU (i.e. 1)"];
    if(dateTable.Columns.Contains("Weekday Short (i.e. Mon)"))
        dateTable.Columns["Weekday Short (i.e. Mon)"].SortByColumn = dateTable.Columns["Weekday Number EU (i.e. 1)"];

    // Week sorting
    if(dateTable.Columns.Contains("Calendar Week EU (ie WK25)"))
        dateTable.Columns["Calendar Week EU (ie WK25)"].SortByColumn = dateTable.Columns["Calendar Week Number EU (ie 25)"];

    // Month sorting
    if(dateTable.Columns.Contains("Calendar Month (ie Jan)"))
        dateTable.Columns["Calendar Month (ie Jan)"].SortByColumn = dateTable.Columns["Calendar Month # (ie 1)"];
    if(dateTable.Columns.Contains("Calendar Month Day (i.e. Jan 05)"))
        dateTable.Columns["Calendar Month Day (i.e. Jan 05)"].SortByColumn = dateTable.Columns["Calendar Month Day (i.e. 0105)"];
    if(dateTable.Columns.Contains("Calendar Month Year (ie Jan 21)"))
        dateTable.Columns["Calendar Month Year (ie Jan 21)"].SortByColumn = dateTable.Columns["Calendar Year Month (ie 202101)"];

    // Quarter sorting
    if(dateTable.Columns.Contains("Calendar Quarter Year (ie Q1 2021)"))
        dateTable.Columns["Calendar Quarter Year (ie Q1 2021)"].SortByColumn = dateTable.Columns["Calendar Year Quarter (ie 202101)"];

    // Year sorting
    if(dateTable.Columns.Contains("Calendar Year (ie 2021)"))
        dateTable.Columns["Calendar Year (ie 2021)"].SortByColumn = dateTable.Columns["Calendar Year Number (ie 2021)"];

    // ========================================================================
    // ORGANIZE INTO DISPLAY FOLDERS
    // ========================================================================

    foreach (var col in dateTable.Columns)
    {
        // Default: Hide all boolean columns
        if(col.DataType == DataType.Boolean || col.Name.StartsWith("Is"))
        {
            col.DisplayFolder = "7. Boolean Fields";
            col.IsHidden = true;
        }

        // Date column
        if(col.DataType == DataType.DateTime && col.Name.Contains("Date"))
        {
            col.DisplayFolder = "6. Calendar Date";
            col.IsHidden = false;
            col.IsKey = true;
        }

        // Year columns
        if(col.Name.Contains("Year") && col.DataType != DataType.Boolean)
        {
            col.DisplayFolder = "1. Year";
            col.IsHidden = false;
        }

        // Quarter columns
        if(col.Name.Contains("Quarter") && col.DataType != DataType.Boolean)
        {
            col.DisplayFolder = "2. Quarter";
            col.IsHidden = false;
        }

        // Month columns
        if(col.Name.Contains("Month") && col.DataType != DataType.Boolean)
        {
            col.DisplayFolder = "3. Month";
            col.IsHidden = false;
        }

        // Week columns
        if(col.Name.Contains("Week") && col.DataType != DataType.Boolean)
        {
            col.DisplayFolder = "4. Week";
            col.IsHidden = true;  // Hide by default, show if needed
        }

        // Weekday columns
        if(col.Name.Contains("day") && col.DataType != DataType.Boolean)
        {
            col.DisplayFolder = "5. Weekday";
            col.IsHidden = false;
        }

        // Hide helper columns (number keys for sorting)
        if(col.Name.Contains("#") || col.Name.Contains("Number") && !col.Name.Contains("Year Number"))
        {
            col.IsHidden = true;
        }
    }
}

Info("Created date table: " + tableName +
     "\nDate range: " + (useExplicitDates ? "Explicit dates" : "Based on " + earliestDateColumn) +
     "\nColumns: " + dateTable.Columns.Count +
     "\nRefDate measure: [RefDate] in " + measureTable.Name);
