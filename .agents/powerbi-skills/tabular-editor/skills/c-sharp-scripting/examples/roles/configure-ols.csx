// Configure Object-Level Security (OLS)
// Hides tables and columns from specific roles

// ============================================================================
// CONFIGURATION
// ============================================================================

var roleName = "RestrictedUsers";

// Mode: "hide", "show", "remove"
var mode = "hide";

// Tables to hide/show metadata
var tablesToSecure = new string[] {
    "DimEmployee",
    "FactSalary"
};

// Columns to hide/show (format: "TableName/ColumnName")
var columnsToSecure = new string[] {
    "DimCustomer/Email",
    "DimCustomer/Phone",
    "FactSales/Cost"
};

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Roles.Contains(roleName))
{
    Error("Role not found: " + roleName + "\n\n" +
          "Create role first using add-role.csx");
}

var role = Model.Roles[roleName];

// Check compatibility level
if (Model.Database.CompatibilityLevel < 1400)
{
    Error("Object-Level Security requires CompatibilityLevel 1400 or higher.\n" +
          "Current level: " + Model.Database.CompatibilityLevel);
}

// ============================================================================
// CONFIGURE TABLE OLS
// ============================================================================

int tablesSecured = 0;

foreach (var tableName in tablesToSecure)
{
    if (!Model.Tables.Contains(tableName))
    {
        Info("Warning: Table not found: " + tableName);
        continue;
    }

    var table = Model.Tables[tableName];

    if (mode == "hide")
    {
        // None = hide metadata
        table.ObjectLevelSecurity[role] = MetadataPermission.None;
        tablesSecured++;
    }
    else if (mode == "show")
    {
        // Default = allow metadata
        table.ObjectLevelSecurity[role] = MetadataPermission.Default;
        tablesSecured++;
    }
    else if (mode == "remove")
    {
        // Remove OLS setting (inherit default by setting to Default)
        table.ObjectLevelSecurity[role] = MetadataPermission.Default;
        tablesSecured++;
    }
}

// ============================================================================
// CONFIGURE COLUMN OLS
// ============================================================================

int columnsSecured = 0;

foreach (var columnPath in columnsToSecure)
{
    var parts = columnPath.Split('/');
    if (parts.Length != 2)
    {
        Info("Warning: Invalid column path: " + columnPath);
        continue;
    }

    var tableName = parts[0];
    var columnName = parts[1];

    if (!Model.Tables.Contains(tableName))
    {
        Info("Warning: Table not found: " + tableName);
        continue;
    }

    var table = Model.Tables[tableName];

    if (!table.Columns.Contains(columnName))
    {
        Info("Warning: Column not found: " + columnPath);
        continue;
    }

    var column = table.Columns[columnName];

    if (mode == "hide")
    {
        // None = hide metadata
        column.ObjectLevelSecurity[role] = MetadataPermission.None;
        columnsSecured++;
    }
    else if (mode == "show")
    {
        // Default = allow metadata
        column.ObjectLevelSecurity[role] = MetadataPermission.Default;
        columnsSecured++;
    }
    else if (mode == "remove")
    {
        // Remove OLS setting (inherit default by setting to Default)
        column.ObjectLevelSecurity[role] = MetadataPermission.Default;
        columnsSecured++;
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var actionVerb = mode == "hide" ? "Hidden" :
                 mode == "show" ? "Shown" :
                 "Removed OLS from";

Info("Configured Object-Level Security\n" +
     "=================================\n\n" +
     "Role: " + roleName + "\n" +
     "Mode: " + mode + "\n\n" +
     actionVerb + " objects:\n" +
     "  Tables: " + tablesSecured + "\n" +
     "  Columns: " + columnsSecured + "\n\n" +
     "Note: Objects with OLS set to 'None' will be invisible to this role.\n" +
     "      Users will not see these objects in the field list.");
