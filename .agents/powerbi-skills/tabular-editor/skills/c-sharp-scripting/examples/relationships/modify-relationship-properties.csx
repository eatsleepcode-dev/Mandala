// Modify Relationship Properties
// Updates properties of an existing relationship

// ============================================================================
// CONFIGURATION - Modify these values
// ============================================================================

// Identify the relationship to modify
var fromTableName = "FactSales";
var fromColumnName = "CustomerKey";
var toTableName = "DimCustomer";
var toColumnName = "CustomerKey";

// Properties to modify (set to null to skip)
var newCrossFilterDirection = "BothDirections";  // "SingleDirection", "BothDirections", or null
var newIsActive = true;                          // true, false, or null
var newSecurityFilteringBehavior = "BothDirections";  // "OneDirection", "BothDirections", "None", or null

// Cardinality changes (rarely needed, but available)
string newFromCardinality = null;  // "One", "Many", or null to keep current
string newToCardinality = null;    // "One", "Many", or null to keep current

// ============================================================================
// FIND RELATIONSHIP
// ============================================================================

if (!Model.Tables.Contains(fromTableName) || !Model.Tables.Contains(toTableName))
{
    Error("Table not found: " + fromTableName + " or " + toTableName);
}

var fromColumn = Model.Tables[fromTableName].Columns[fromColumnName];
var toColumn = Model.Tables[toTableName].Columns[toColumnName];

var rel = Model.Relationships.FirstOrDefault(
    r => r.FromColumn == fromColumn && r.ToColumn == toColumn
);

if (rel == null)
{
    Error("Relationship not found between " + fromTableName + "[" + fromColumnName + "] and " +
          toTableName + "[" + toColumnName + "]");
}

// ============================================================================
// TRACK CHANGES
// ============================================================================

var changes = new System.Collections.Generic.List<string>();

// ============================================================================
// MODIFY PROPERTIES
// ============================================================================

// Cross-filter direction
if (newCrossFilterDirection != null)
{
    var oldValue = rel.CrossFilteringBehavior.ToString();
    if (newCrossFilterDirection == "BothDirections")
    {
        rel.CrossFilteringBehavior = CrossFilteringBehavior.BothDirections;
    }
    else
    {
        rel.CrossFilteringBehavior = CrossFilteringBehavior.OneDirection;
    }
    changes.Add("Cross-filter: " + oldValue + " → " + newCrossFilterDirection);
}

// Active state
if (newIsActive != null)
{
    var oldValue = rel.IsActive;
    rel.IsActive = newIsActive.Value;
    if (oldValue != newIsActive.Value)
    {
        changes.Add("Active: " + oldValue + " → " + newIsActive.Value);
    }
}

// Security filtering behavior
if (newSecurityFilteringBehavior != null)
{
    var oldValue = rel.SecurityFilteringBehavior.ToString();
    if (newSecurityFilteringBehavior == "BothDirections")
    {
        rel.SecurityFilteringBehavior = SecurityFilteringBehavior.BothDirections;
    }
    else if (newSecurityFilteringBehavior == "None")
    {
        rel.SecurityFilteringBehavior = SecurityFilteringBehavior.None;
    }
    else
    {
        rel.SecurityFilteringBehavior = SecurityFilteringBehavior.OneDirection;
    }
    changes.Add("Security filtering: " + oldValue + " → " + newSecurityFilteringBehavior);
}

// Cardinality (from side)
if (newFromCardinality != null)
{
    var oldValue = rel.FromCardinality.ToString();
    if (newFromCardinality == "One")
    {
        rel.FromCardinality = RelationshipEndCardinality.One;
    }
    else
    {
        rel.FromCardinality = RelationshipEndCardinality.Many;
    }
    changes.Add("From cardinality: " + oldValue + " → " + newFromCardinality);
}

// Cardinality (to side)
if (newToCardinality != null)
{
    var oldValue = rel.ToCardinality.ToString();
    if (newToCardinality == "One")
    {
        rel.ToCardinality = RelationshipEndCardinality.One;
    }
    else
    {
        rel.ToCardinality = RelationshipEndCardinality.Many;
    }
    changes.Add("To cardinality: " + oldValue + " → " + newToCardinality);
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

if (changes.Count == 0)
{
    Info("No changes made to relationship:\n" +
         fromTableName + "[" + fromColumnName + "] → " +
         toTableName + "[" + toColumnName + "]");
}
else
{
    Info("Modified relationship:\n" +
         fromTableName + "[" + fromColumnName + "] → " +
         toTableName + "[" + toColumnName + "]\n\n" +
         "Changes:\n" + string.Join("\n", changes));
}
