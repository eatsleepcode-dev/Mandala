// Configure Row-Level Security (RLS)
// Adds or updates table permissions with DAX row filters

// ============================================================================
// CONFIGURATION
// ============================================================================

var roleName = "SalesRegion";

// Mode: "add", "update", "remove"
var mode = "add";

// Table permissions to configure
var tablePermissions = new Dictionary<string, string>()
{
    // TableName -> FilterExpression
    { "FactSales", "'DimRegion'[Region] = USERNAME()" },
    { "DimCustomer", "'DimRegion'[Region] = USERNAME()" }
};

// For dynamic RLS with lookup table pattern
var dynamicRlsExample = @"
VAR UserEmail = USERPRINCIPALNAME()
VAR UserRegion =
    CALCULATE(
        VALUES('UserRegions'[Region]),
        'UserRegions'[Email] = UserEmail
    )
RETURN
    'DimRegion'[Region] IN UserRegion
";

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Roles.Contains(roleName))
{
    Error("Role not found: " + roleName + "\n\n" +
          "Create role first using add-role.csx");
}

var role = Model.Roles[roleName];

// ============================================================================
// CONFIGURE TABLE PERMISSIONS
// ============================================================================

int permissionsAdded = 0;
int permissionsUpdated = 0;
int permissionsRemoved = 0;

foreach (var kvp in tablePermissions)
{
    var tableName = kvp.Key;
    var filterExpression = kvp.Value;

    if (!Model.Tables.Contains(tableName))
    {
        Info("Warning: Table not found: " + tableName);
        continue;
    }

    var table = Model.Tables[tableName];

    if (mode == "add" || mode == "update")
    {
        // Get or create table permission
        var existingPermission = role.TablePermissions.FirstOrDefault(tp => tp.Table == table);

        if (existingPermission != null)
        {
            // Update existing
            existingPermission.FilterExpression = filterExpression;
            permissionsUpdated++;
        }
        else
        {
            // Add new
            role.TablePermissions[table] = filterExpression;
            permissionsAdded++;
        }
    }
    else if (mode == "remove")
    {
        var existingPermission = role.TablePermissions.FirstOrDefault(tp => tp.Table == table);

        if (existingPermission != null)
        {
            existingPermission.Delete();
            permissionsRemoved++;
        }
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var report = "Configured Row-Level Security\n" +
             "==============================\n\n" +
             "Role: " + roleName + "\n" +
             "Mode: " + mode + "\n\n";

if (mode == "add")
{
    report += "Permissions added: " + permissionsAdded + "\n\n";
}
else if (mode == "update")
{
    report += "Permissions updated: " + permissionsUpdated + "\n\n";
}
else if (mode == "remove")
{
    report += "Permissions removed: " + permissionsRemoved + "\n\n";
}

report += "Current table permissions in role: " + role.TablePermissions.Count + "\n\n";

if (role.TablePermissions.Count > 0)
{
    report += "Table filters:\n";
    foreach (var tp in role.TablePermissions)
    {
        report += "  " + tp.Table.Name + ":\n";
        report += "    " + tp.FilterExpression.Replace("\n", "\n    ") + "\n\n";
    }
}

Info(report);
