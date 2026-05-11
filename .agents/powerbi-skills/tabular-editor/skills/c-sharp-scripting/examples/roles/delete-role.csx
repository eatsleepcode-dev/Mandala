// Delete Role(s)
// Removes security roles from the model

// ============================================================================
// CONFIGURATION
// ============================================================================

var deleteMode = "single";  // "single", "pattern", "all"

// Single mode
var roleName = "SalesRegion";

// Pattern mode (wildcard matching)
var rolePattern = "Test*";

// Confirmation for "all" mode
var confirmDeleteAll = false;

// ============================================================================
// BUILD DELETE LIST
// ============================================================================

var rolesToDelete = new System.Collections.Generic.List<ModelRole>();

if (deleteMode == "single")
{
    if (!Model.Roles.Contains(roleName))
    {
        Error("Role not found: " + roleName);
    }

    rolesToDelete.Add(Model.Roles[roleName]);
}
else if (deleteMode == "pattern")
{
    var regex = "^" + rolePattern.Replace("*", ".*").Replace("?", ".") + "$";

    rolesToDelete.AddRange(
        Model.Roles.Where(r =>
            System.Text.RegularExpressions.Regex.IsMatch(r.Name, regex))
    );
}
else if (deleteMode == "all")
{
    if (!confirmDeleteAll)
    {
        Error("Safety check: Set confirmDeleteAll = true to delete all roles");
    }

    rolesToDelete.AddRange(Model.Roles);
}
else
{
    Error("Invalid deleteMode: " + deleteMode);
}

if (rolesToDelete.Count == 0)
{
    Error("No roles found to delete");
}

// ============================================================================
// DELETE ROLES
// ============================================================================

var deletedRoles = new System.Collections.Generic.List<string>();
int totalMembers = 0;
int totalTablePermissions = 0;

foreach (var role in rolesToDelete.ToList())
{
    var roleSummary = role.Name +
        " (Members: " + role.Members.Count +
        ", Table Permissions: " + role.TablePermissions.Count + ")";

    deletedRoles.Add(roleSummary);
    totalMembers += role.Members.Count;
    totalTablePermissions += role.TablePermissions.Count;

    role.Delete();
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Deleted Roles\n" +
     "=============\n\n" +
     "Mode: " + deleteMode + "\n" +
     "Count: " + deletedRoles.Count + "\n\n" +
     "Deleted roles:\n" +
     string.Join("\n", deletedRoles.Select(r => "  - " + r)) + "\n\n" +
     "Total members removed: " + totalMembers + "\n" +
     "Total table permissions removed: " + totalTablePermissions + "\n\n" +
     "Note: All RLS/OLS settings for these roles have been removed.");
