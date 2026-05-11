// Configure Object-Level Security (OLS)
// Sets table/column permissions to hide objects from roles

// ============================================================================
// CONFIGURATION
// ============================================================================

var roleName = "RestrictedRole";
var tableName = "FactFinance";  // Table to restrict
var columnsToHide = new string[] { "Salary", "Bonus", "Commission" };  // Columns to hide

// Permission levels: "None" (hidden), "Read" (visible), "Default" (inherit)
var tablePermission = "Read";  // Allow table access
var columnPermission = "None";  // Hide specific columns

// Create role if missing
var createRoleIfMissing = true;

// ============================================================================
// SETUP ROLE
// ============================================================================

ModelRole role;

if (Model.Roles.Contains(roleName))
{
    role = Model.Roles[roleName];
}
else if (createRoleIfMissing)
{
    role = Model.AddRole(roleName);
    role.ModelPermission = ModelPermission.Read;
    Info("Created role: " + roleName);
}
else
{
    Error("Role not found: " + roleName);
}

// ============================================================================
// SET TABLE PERMISSION
// ============================================================================

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];

// Set table-level OLS
if (tablePermission == "None")
{
    table.ObjectLevelSecurity[role] = MetadataPermission.None;
}
else if (tablePermission == "Read")
{
    table.ObjectLevelSecurity[role] = MetadataPermission.Read;
}
else
{
    table.ObjectLevelSecurity[role] = MetadataPermission.Default;
}

// ============================================================================
// SET COLUMN PERMISSIONS
// ============================================================================

var hiddenColumns = new System.Collections.Generic.List<string>();

foreach (var columnName in columnsToHide)
{
    if (!table.Columns.Contains(columnName))
    {
        Info("Warning: Column not found: " + columnName);
        continue;
    }

    var column = table.Columns[columnName];

    // Set column-level OLS
    if (columnPermission == "None")
    {
        column.ObjectLevelSecurity[role] = MetadataPermission.None;
        hiddenColumns.Add(columnName);
    }
    else if (columnPermission == "Read")
    {
        column.ObjectLevelSecurity[role] = MetadataPermission.Read;
    }
    else
    {
        column.ObjectLevelSecurity[role] = MetadataPermission.Default;
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("OLS Configuration\n" +
     "==================\n\n" +
     "Role: " + roleName + "\n" +
     "Table: " + tableName + " (" + tablePermission + ")\n" +
     "Hidden columns: " + hiddenColumns.Count + "\n\n" +
     "Details:\n" + string.Join("\n", hiddenColumns.Select(c => "  - " + c)));
