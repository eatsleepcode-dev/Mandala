// Set Table Properties
// Comprehensive script to modify any table property

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

var tableName = "FactSales";

// Core properties (set to null to skip)
var newDescription = "Fact table containing sales transactions";
var newIsHidden = false;
var newIsPrivate = null;  // Boolean or null
var newDataCategory = null;  // "Time", "Geography", "Organization", "Products", "Accounts", "Customers", etc. or null

// Display & Organization
var newTableGroup = "Sales";  // Table group name (uses TabularEditor_TableGroup annotation)

// Detail Rows (drill-through)
var newDetailRowsExpression = null;  // DAX expression or null
// Example: "TOPN(100, 'FactSales', 'FactSales'[OrderDate], DESC)"

// Refresh settings
var newExcludeFromModelRefresh = null;  // Boolean or null

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];
var changes = new System.Collections.Generic.List<string>();

// ============================================================================
// APPLY PROPERTY CHANGES
// ============================================================================

// Description
if (newDescription != null && table.Description != newDescription)
{
    var oldValue = table.Description ?? "(empty)";
    table.Description = newDescription;
    changes.Add("Description: " + oldValue + " → " + newDescription);
}

// IsHidden
if (newIsHidden != null && table.IsHidden != newIsHidden)
{
    var oldValue = table.IsHidden;
    table.IsHidden = newIsHidden.Value;
    changes.Add("IsHidden: " + oldValue + " → " + newIsHidden);
}

// IsPrivate
if (newIsPrivate != null && table.IsPrivate != newIsPrivate)
{
    var oldValue = table.IsPrivate;
    table.IsPrivate = newIsPrivate.Value;
    changes.Add("IsPrivate: " + oldValue + " → " + newIsPrivate);
}

// DataCategory
if (newDataCategory != null && table.DataCategory != newDataCategory)
{
    var oldValue = table.DataCategory ?? "(none)";
    table.DataCategory = newDataCategory;
    changes.Add("DataCategory: " + oldValue + " → " + newDataCategory);
}

// Table Group (via annotation)
if (newTableGroup != null)
{
    var annotationName = "TabularEditor_TableGroup";
    var oldValue = table.GetAnnotation(annotationName) ?? "(none)";

    if (oldValue != newTableGroup)
    {
        table.SetAnnotation(annotationName, newTableGroup);
        changes.Add("TableGroup: " + oldValue + " → " + newTableGroup);
    }
}

// Detail Rows Expression
if (newDetailRowsExpression != null && table.DefaultDetailRowsExpression != newDetailRowsExpression)
{
    var oldValue = table.DefaultDetailRowsExpression ?? "(none)";
    table.DefaultDetailRowsExpression = newDetailRowsExpression;
    changes.Add("DetailRowsExpression: " + (oldValue.Length > 50 ? oldValue.Substring(0, 50) + "..." : oldValue) + " → (updated)");
}

// Exclude From Model Refresh
if (newExcludeFromModelRefresh != null && table.ExcludeFromModelRefresh != newExcludeFromModelRefresh)
{
    var oldValue = table.ExcludeFromModelRefresh;
    table.ExcludeFromModelRefresh = newExcludeFromModelRefresh.Value;
    changes.Add("ExcludeFromModelRefresh: " + oldValue + " → " + newExcludeFromModelRefresh);
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

if (changes.Count == 0)
{
    Info("No changes made to table: " + tableName);
}
else
{
    Info("Updated table: " + tableName + "\n\n" +
         "Changes:\n" + string.Join("\n", changes));
}
