
// ----------------------------- MEASURES --------------------------------------- //

// Format all DAX measures in the model
var _measures = Model.AllMeasures;
_measures.CallDaxFormatter();

// Count & report in an info box the # measures formatted


// ----------------------------- CALCULATION GROUPS ----------------------------- //

// Loop through calculation groups & items, counting and formatting them
int _counter = 0;
foreach (  var _calcgroup  in Model.CalculationGroups )
{
 foreach (  var _item  in _calcgroup.CalculationItems )
 {
 _counter = _counter + 1;
 _item.Expression = "\n" + CallDaxFormatter( _item.Expression );
 }
}


// ----------------------------- CALCULATED TABLES ----------------------------- //

// Loop through calculated tables in the model and format their DAX expressions
foreach (  var _tables  in Model.Tables )
{
 if ( Convert.ToString( _tables.Columns[0].Type ) == "CalculatedTableColumn")
 {
 _tables.Partitions[0].Expression = "\n" + CallDaxFormatter( _tables.Partitions[0].Expression );
 }
}

// Count & report in an info box the # Calculated Tables formatted
int _nrtables = Model.Tables.Where(_tables => Convert.ToString(_tables.Columns[0].Type) == "CalculatedTableColumn").Count();


// ----------------------------- CALCULATED COLUMNS ----------------------------- //

// Loop through calculated columns in the model and format their DAX expressions
foreach (  var _columns  in Model.AllColumns )
{
 if ( Convert.ToString( _columns.Type ) == "Calculated")
 {
 (_columns as CalculatedColumn).Expression = "\n" + CallDaxFormatter( (_columns as CalculatedColumn).Expression );
 }
}

// Count the # Calculated Columns formatted
int _nrcolumns = Model.AllColumns.Where(_columns => Convert.ToString(_columns.Type) == "Calculated").Count();


// ----------------------------- TABLE PERMISSIONS (RLS) ----------------------------- //

// Loop through all roles and format RLS filter expressions
int _rlsCounter = 0;
foreach (var _role in Model.Roles)
{
    foreach (var _permission in _role.TablePermissions)
    {
        if (!string.IsNullOrWhiteSpace(_permission.FilterExpression))
        {
            _permission.FilterExpression = "\n" + CallDaxFormatter(_permission.FilterExpression);
            _rlsCounter++;
        }
    }
}


// ----------------------------- KPI EXPRESSIONS ----------------------------- //

// Format KPI Target, Status, and Trend expressions
int _kpiCounter = 0;
foreach (var _measure in Model.AllMeasures)
{
    if (_measure.KPI != null)
    {
        if (!string.IsNullOrWhiteSpace(_measure.KPI.TargetExpression))
        {
            _measure.KPI.TargetExpression = "\n" + CallDaxFormatter(_measure.KPI.TargetExpression);
            _kpiCounter++;
        }

        if (!string.IsNullOrWhiteSpace(_measure.KPI.StatusExpression))
        {
            _measure.KPI.StatusExpression = "\n" + CallDaxFormatter(_measure.KPI.StatusExpression);
            _kpiCounter++;
        }

        if (!string.IsNullOrWhiteSpace(_measure.KPI.TrendExpression))
        {
            _measure.KPI.TrendExpression = "\n" + CallDaxFormatter(_measure.KPI.TrendExpression);
            _kpiCounter++;
        }
    }
}


// ----------------------------- DETAIL ROWS EXPRESSIONS ----------------------------- //

// Format detail rows (drill-through) expressions on tables
int _detailRowsCounter = 0;
foreach (var _table in Model.Tables)
{
    if (!string.IsNullOrWhiteSpace(_table.DetailRowsExpression))
    {
        _table.DetailRowsExpression = "\n" + CallDaxFormatter(_table.DetailRowsExpression);
        _detailRowsCounter++;
    }
}


// Return an info box counting what was formatted
Info(   "Formatted all the things! \n\n" +
        Convert.ToString(_measures.Count()) + " measures,\n" +
        Convert.ToString( _counter ) + " calculation items,\n" +
        Convert.ToString( _nrtables ) + " calculated tables,\n" +
        Convert.ToString( _nrcolumns ) + " calculated columns,\n" +
        Convert.ToString( _rlsCounter ) + " RLS filter expressions,\n" +
        Convert.ToString( _kpiCounter ) + " KPI expressions &\n" +
        Convert.ToString( _detailRowsCounter ) + " detail rows expressions." );