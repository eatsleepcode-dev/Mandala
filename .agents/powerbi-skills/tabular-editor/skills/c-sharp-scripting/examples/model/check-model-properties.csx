// Check Model Properties
// Displays important model-level configuration settings
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// GATHER MODEL PROPERTIES
// ============================================================================

var modelName = Model.Database.Name;
var compatLevel = Model.Database.CompatibilityLevel;

// ============================================================================
// BUILD REPORT
// ============================================================================

var message = "MODEL PROPERTIES REPORT\n";
message += "═══════════════════════════════════════════════════════════\n\n";
message += "Model Name: " + modelName + "\n";
message += "Compatibility Level: " + compatLevel + "\n\n";

// Model settings
message += "GENERAL SETTINGS\n";
message += "───────────────────────────────────────────────────────────\n";
message += "Discourage Implicit Measures: " + (Model.DiscourageImplicitMeasures ? "✓ Yes" : "✗ No") + "\n";

// Check Auto Date/Time setting (via annotation)
var autoDateTimeEnabled = Model.GetAnnotation("__PBI_TimeIntelligenceEnabled");
message += "Auto Date/Time: " + (autoDateTimeEnabled == "1" ? "✓ Enabled" : "✗ Disabled") + "\n";

// Check if DiscourageMeasuresFromCounts exists (1565+)
if (compatLevel >= 1565)
{
    try
    {
        var discourageCounts = Model.GetAnnotation("PBI_DiscourageMeasuresFromCounts");
        message += "Discourage Measures from Counts: " + (discourageCounts == "true" ? "✓ Yes" : "✗ No") + "\n";
    }
    catch
    {
        message += "Discourage Measures from Counts: Not set\n";
    }
}

message += "Default Mode: " + Model.DefaultMode + "\n";
message += "Culture: " + (Model.Culture ?? "Default") + "\n\n";

// Storage mode statistics
message += "STORAGE MODE SUMMARY\n";
message += "───────────────────────────────────────────────────────────\n";

var importCount = Model.Tables.Where(t => t.Partitions.Any(p => p.Mode == ModeType.Import)).Count();
var directQueryCount = Model.Tables.Where(t => t.Partitions.Any(p => p.Mode == ModeType.DirectQuery)).Count();
var dualCount = Model.Tables.Where(t => t.Partitions.Any(p => p.Mode == ModeType.Dual)).Count();

message += "Import Tables: " + importCount + "\n";
message += "DirectQuery Tables: " + directQueryCount + "\n";
message += "Dual Tables: " + dualCount + "\n\n";

// Table statistics
message += "OBJECT COUNTS\n";
message += "───────────────────────────────────────────────────────────\n";
message += "Tables: " + Model.Tables.Count + "\n";
message += "Measures: " + Model.AllMeasures.Count() + "\n";
message += "Calculated Columns: " + Model.AllColumns.Where(c => c.Type == ColumnType.Calculated).Count() + "\n";
message += "Calculated Tables: " + Model.Tables.Where(t => t.Partitions.Any(p => p.SourceType == PartitionSourceType.Calculated)).Count() + "\n";
message += "Relationships: " + Model.Relationships.Count + "\n";
message += "Hierarchies: " + Model.AllHierarchies.Count() + "\n";

// Calculation groups (1450+)
if (compatLevel >= 1450)
{
    var calcGroupCount = Model.Tables.Where(t => t.ObjectType == ObjectType.Table && t.GetType().Name == "CalculationGroupTable").Count();
    message += "Calculation Groups: " + calcGroupCount + "\n";
}

message += "\n";

// Data sources
message += "DATA SOURCES\n";
message += "───────────────────────────────────────────────────────────\n";

foreach (var ds in Model.DataSources)
{
    message += "• " + ds.Name + " (" + ds.Type + ")\n";
}

message += "\n";

// Recommendations
message += "RECOMMENDATIONS\n";
message += "───────────────────────────────────────────────────────────\n";

var recommendations = new List<string>();

if (!Model.DiscourageImplicitMeasures)
{
    recommendations.Add("Consider enabling 'Discourage Implicit Measures' to prevent users from creating implicit measures");
}

// Check Auto Date/Time (reusing variable from above)
if (autoDateTimeEnabled == "1")
{
    recommendations.Add("Consider disabling 'Auto Date/Time' for production models - use explicit date tables instead");
}

var hiddenMeasures = Model.AllMeasures.Where(m => m.IsHidden).Count();
var visibleMeasures = Model.AllMeasures.Where(m => !m.IsHidden).Count();

if (visibleMeasures > 0 && hiddenMeasures == 0)
{
    recommendations.Add("No measures are hidden - consider hiding intermediate calculation measures");
}

var measuresWithoutFolders = Model.AllMeasures.Where(m => string.IsNullOrEmpty(m.DisplayFolder)).Count();
if (measuresWithoutFolders > 10)
{
    recommendations.Add("Many measures lack display folders (" + measuresWithoutFolders + ") - consider organizing measures");
}

var columnsWithoutFolders = Model.AllColumns.Where(c => string.IsNullOrEmpty(c.DisplayFolder) && !c.IsHidden).Count();
if (columnsWithoutFolders > 20)
{
    recommendations.Add("Many columns lack display folders (" + columnsWithoutFolders + ") - consider organizing columns");
}

if (recommendations.Count > 0)
{
    foreach (var rec in recommendations)
    {
        message += "• " + rec + "\n";
    }
}
else
{
    message += "No recommendations at this time.\n";
}

Info(message);
