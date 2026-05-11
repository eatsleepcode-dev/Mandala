// Add Relationship
// Creates a single relationship between two tables

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// From side (many side / fact table)
var fromTableName = "FactSales";
var fromColumnName = "CustomerKey";

// To side (one side / dimension table)
var toTableName = "DimCustomer";
var toColumnName = "CustomerKey";

// Relationship properties
var crossFilterDirection = "SingleDirection";  // "SingleDirection", "BothDirections"
var isActive = true;
var securityFilteringBehavior = "OneDirection";  // "OneDirection", "BothDirections", "None"

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Tables.Contains(fromTableName))
{
    Error("From table not found: " + fromTableName);
}

if (!Model.Tables.Contains(toTableName))
{
    Error("To table not found: " + toTableName);
}

var fromTable = Model.Tables[fromTableName];
var toTable = Model.Tables[toTableName];

if (!fromTable.Columns.Contains(fromColumnName))
{
    Error("From column not found in " + fromTableName + ": " + fromColumnName);
}

if (!toTable.Columns.Contains(toColumnName))
{
    Error("To column not found in " + toTableName + ": " + toColumnName);
}

var fromColumn = fromTable.Columns[fromColumnName];
var toColumn = toTable.Columns[toColumnName];

// Check if relationship already exists
var existingRel = Model.Relationships.FirstOrDefault(
    r => r.FromColumn == fromColumn && r.ToColumn == toColumn
);

if (existingRel != null)
{
    Error("Relationship already exists between " + fromTableName + "[" + fromColumnName + "] and " +
          toTableName + "[" + toColumnName + "]");
}

// ============================================================================
// CREATE RELATIONSHIP
// ============================================================================

var rel = Model.AddRelationship();

// Set columns
rel.FromColumn = fromColumn;
rel.ToColumn = toColumn;

// Set cardinality (typically many-to-one for fact-to-dimension)
rel.FromCardinality = RelationshipEndCardinality.Many;
rel.ToCardinality = RelationshipEndCardinality.One;

// Set cross-filter direction
if (crossFilterDirection == "BothDirections")
{
    rel.CrossFilteringBehavior = CrossFilteringBehavior.BothDirections;
}
else
{
    rel.CrossFilteringBehavior = CrossFilteringBehavior.OneDirection;
}

// Set active state
rel.IsActive = isActive;

// Set security filtering behavior
if (securityFilteringBehavior == "BothDirections")
{
    rel.SecurityFilteringBehavior = SecurityFilteringBehavior.BothDirections;
}
else if (securityFilteringBehavior == "None")
{
    rel.SecurityFilteringBehavior = SecurityFilteringBehavior.None;
}
else
{
    rel.SecurityFilteringBehavior = SecurityFilteringBehavior.OneDirection;
}

Info("Created relationship:\n" +
     "From: " + fromTableName + "[" + fromColumnName + "] (many)\n" +
     "To: " + toTableName + "[" + toColumnName + "] (one)\n" +
     "Cross-filter: " + crossFilterDirection + "\n" +
     "Active: " + isActive + "\n" +
     "Security filtering: " + securityFilteringBehavior);
