// List all Security Roles
// Reports all roles with their members and permissions

// ============================================================================
// CONFIGURATION
// ============================================================================

var showMembers = true;  // List all members in each role
var showTablePermissions = true;  // List RLS filters
var showOlsSettings = false;  // List OLS settings (can be verbose)
var filterByPermission = "";  // "Read", "Administrator", etc., empty for all

// ============================================================================
// BUILD ROLE LIST
// ============================================================================

var roles = Model.Roles.AsEnumerable();

if (!string.IsNullOrWhiteSpace(filterByPermission))
{
    ModelPermission filterPerm;
    if (Enum.TryParse(filterByPermission, out filterPerm))
    {
        roles = roles.Where(r => r.ModelPermission == filterPerm);
    }
}

var roleList = roles.ToList();

if (roleList.Count == 0)
{
    Info("No roles found" +
         (string.IsNullOrWhiteSpace(filterByPermission) ? "" : " with permission: " + filterByPermission));
    return;
}

// ============================================================================
// BUILD REPORT
// ============================================================================

var report = new System.Text.StringBuilder();
report.AppendLine("Security Roles");
report.AppendLine("==============\n");

if (!string.IsNullOrWhiteSpace(filterByPermission))
{
    report.AppendLine("Filter: Model Permission = " + filterByPermission);
}

report.AppendLine("\nTotal roles: " + roleList.Count + "\n");

// Summary by permission
var byPermission = roleList.GroupBy(r => r.ModelPermission.ToString())
    .Select(g => g.Key + ": " + g.Count())
    .ToList();

report.AppendLine("By Model Permission:");
foreach (var item in byPermission)
{
    report.AppendLine("  " + item);
}

report.AppendLine("\n" + new string('=', 50) + "\n");

// List each role
foreach (var role in roleList.OrderBy(r => r.Name))
{
    report.AppendLine("Role: " + role.Name);
    report.AppendLine("  Model Permission: " + role.ModelPermission);

    if (!string.IsNullOrWhiteSpace(role.Description))
    {
        report.AppendLine("  Description: " + role.Description);
    }

    // Members
    if (showMembers && role.Members.Count > 0)
    {
        report.AppendLine("\n  Members (" + role.Members.Count + "):");

        foreach (var member in role.Members.Take(10))
        {
            var memberType = member.GetType().Name == "WindowsModelRoleMember" ? "[Windows]" : "[Azure AD]";
            report.AppendLine("    " + memberType + " " + member.MemberName);
        }

        if (role.Members.Count > 10)
        {
            report.AppendLine("    ... and " + (role.Members.Count - 10) + " more");
        }
    }
    else if (role.Members.Count == 0)
    {
        report.AppendLine("  Members: (none)");
    }

    // Table Permissions (RLS)
    if (showTablePermissions && role.TablePermissions.Count > 0)
    {
        report.AppendLine("\n  Row-Level Security (" + role.TablePermissions.Count + " tables):");

        foreach (var tp in role.TablePermissions.Take(5))
        {
            report.AppendLine("    " + tp.Table.Name + ":");
            var filterPreview = tp.FilterExpression.Replace("\n", " ").Trim();
            if (filterPreview.Length > 60)
            {
                filterPreview = filterPreview.Substring(0, 57) + "...";
            }
            report.AppendLine("      " + filterPreview);
        }

        if (role.TablePermissions.Count > 5)
        {
            report.AppendLine("    ... and " + (role.TablePermissions.Count - 5) + " more tables");
        }
    }

    // Object-Level Security
    if (showOlsSettings)
    {
        var tablesWithOls = new System.Collections.Generic.List<string>();
        var columnsWithOls = new System.Collections.Generic.List<string>();

        foreach (var table in Model.Tables)
        {
            var perm = table.ObjectLevelSecurity[role];
            if (perm == MetadataPermission.None)
            {
                tablesWithOls.Add(table.Name);
            }

            foreach (var column in table.Columns)
            {
                var perm = column.ObjectLevelSecurity[role];
                if (perm == MetadataPermission.None)
                {
                    columnsWithOls.Add(table.Name + "/" + column.Name);
                }
            }
        }

        if (tablesWithOls.Count > 0 || columnsWithOls.Count > 0)
        {
            report.AppendLine("\n  Object-Level Security:");

            if (tablesWithOls.Count > 0)
            {
                report.AppendLine("    Hidden tables (" + tablesWithOls.Count + "): " +
                    string.Join(", ", tablesWithOls.Take(5)) +
                    (tablesWithOls.Count > 5 ? "..." : ""));
            }

            if (columnsWithOls.Count > 0)
            {
                report.AppendLine("    Hidden columns (" + columnsWithOls.Count + "): " +
                    string.Join(", ", columnsWithOls.Take(5)) +
                    (columnsWithOls.Count > 5 ? "..." : ""));
            }
        }
    }

    report.AppendLine("");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info(report.ToString());
