// Add Security Role
// Creates a new role with optional members and permissions

// ============================================================================
// CONFIGURATION
// ============================================================================

var roleName = "SalesRegion";
var description = "Sales users filtered by region";

// Model permission
var modelPermission = ModelPermission.Read;
// Options: None, Read, ReadRefresh, Refresh, Administrator

// Add members to role
var addMembers = true;

// Member type: "windows" or "external" (Azure AD)
var memberType = "external";

// For Windows AD members (domain\user or domain\group)
var windowsMembers = new string[] {
    "DOMAIN\\SalesTeam",
    "DOMAIN\\jdoe"
};

// For Azure AD members (email addresses or group object IDs)
var externalMembers = new string[] {
    "sales@contoso.com",
    "12345678-1234-1234-1234-123456789012"  // Azure AD group object ID
};

// ============================================================================
// VALIDATION
// ============================================================================

if (Model.Roles.Contains(roleName))
{
    Error("Role already exists: " + roleName);
}

// ============================================================================
// CREATE ROLE
// ============================================================================

var role = Model.AddRole(roleName);
role.ModelPermission = modelPermission;

if (!string.IsNullOrWhiteSpace(description))
{
    role.Description = description;
}

// ============================================================================
// ADD MEMBERS
// ============================================================================

int membersAdded = 0;

if (addMembers)
{
    if (memberType == "windows")
    {
        foreach (var member in windowsMembers)
        {
            if (!string.IsNullOrWhiteSpace(member))
            {
                role.AddWindowsMember(member);
                membersAdded++;
            }
        }
    }
    else if (memberType == "external")
    {
        foreach (var member in externalMembers)
        {
            if (!string.IsNullOrWhiteSpace(member))
            {
                role.AddExternalMember(member);
                membersAdded++;
            }
        }
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Created Role\n" +
     "=============\n\n" +
     "Name: " + roleName + "\n" +
     "Model Permission: " + modelPermission + "\n" +
     "Description: " + (string.IsNullOrWhiteSpace(description) ? "(none)" : description) + "\n" +
     "Members added: " + membersAdded + "\n" +
     "Member type: " + (membersAdded > 0 ? memberType : "(none)") + "\n\n" +
     "Next steps:\n" +
     "  - Use configure-rls.csx to add row filters (RLS)\n" +
     "  - Use configure-ols.csx to hide objects (OLS)\n" +
     "  - Use add-role-members.csx to add more members");
