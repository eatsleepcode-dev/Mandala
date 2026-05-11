// Configure Row-Level Security (RLS)
// Adds table permissions (row filters) to security roles

// ============================================================================
// CONFIGURATION
// ============================================================================

var roleName = "SalesRegionRole";
var tableName = "FactSales";

// DAX filter expression
var filterExpression = @"
'DimRegion'[Region] = USERNAME()
";

// Create role if it doesn't exist
var createRoleIfMissing = true;

// ============================================================================
// SETUP ROLE
// ============================================================================

ModelRole role;

if (Model.Roles.Contains(roleName))
{
    role = Model.Roles[roleName];
    Info("Using existing role: " + roleName);
}
else if (createRoleIfMissing)
{
    role = Model.AddRole(roleName);
    role.ModelPermission = ModelPermission.Read;
    Info("Created new role: " + roleName);
}
else
{
    Error("Role not found: " + roleName);
}

// ============================================================================
// ADD TABLE PERMISSION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

// Check if permission already exists for this table
var existingPermission = role.TablePermissions.FirstOrDefault(tp => tp.Table == table);

if (existingPermission != null)
{
    // Update existing permission
    existingPermission.FilterExpression = filterExpression;
    Info("Updated existing RLS filter for: " + tableName);
}
else
{
    // Add new table permission
    role.TablePermissions[table] = filterExpression;
    Info("Added new RLS filter for: " + tableName);
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("RLS Configuration\n" +
     "==================\n\n" +
     "Role: " + roleName + "\n" +
     "Table: " + tableName + "\n\n" +
     "Filter Expression:\n" + filterExpression + "\n\n" +
     "Total table permissions in role: " + role.TablePermissions.Count);
