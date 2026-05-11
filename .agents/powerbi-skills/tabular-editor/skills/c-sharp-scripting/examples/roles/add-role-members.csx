// Add Members to Role
// Adds Windows AD or Azure AD members to an existing role

// ============================================================================
// CONFIGURATION
// ============================================================================

var roleName = "SalesRegion";

// Member type: "windows" or "external"
var memberType = "external";

// For Windows AD members (domain\user or domain\group)
var windowsMembers = new string[] {
    "DOMAIN\\SalesTeam",
    "DOMAIN\\jdoe",
    "DOMAIN\\FinanceGroup"
};

// For Azure AD members (email addresses or object IDs)
var externalMembers = new string[] {
    "sales@contoso.com",
    "user1@contoso.com",
    "12345678-1234-1234-1234-123456789012"  // Group object ID
};

// Skip if member already exists
var skipDuplicates = true;

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Roles.Contains(roleName))
{
    Error("Role not found: " + roleName);
}

var role = Model.Roles[roleName];

// ============================================================================
// ADD MEMBERS
// ============================================================================

int membersAdded = 0;
int membersSkipped = 0;

if (memberType == "windows")
{
    foreach (var member in windowsMembers)
    {
        if (string.IsNullOrWhiteSpace(member))
        {
            continue;
        }

        // Check if already exists
        if (skipDuplicates)
        {
            var existing = role.Members.FirstOrDefault(m => m.MemberName == member);
            if (existing != null)
            {
                membersSkipped++;
                continue;
            }
        }

        role.AddWindowsMember(member);
        membersAdded++;
    }
}
else if (memberType == "external")
{
    foreach (var member in externalMembers)
    {
        if (string.IsNullOrWhiteSpace(member))
        {
            continue;
        }

        // Check if already exists
        if (skipDuplicates)
        {
            var existing = role.Members.FirstOrDefault(m =>
                m.MemberName == member);

            if (existing != null)
            {
                membersSkipped++;
                continue;
            }
        }

        role.AddExternalMember(member);
        membersAdded++;
    }
}
else
{
    Error("Invalid memberType: " + memberType + ". Must be 'windows' or 'external'");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

var report = "Added Members to Role\n" +
             "=====================\n\n" +
             "Role: " + roleName + "\n" +
             "Member Type: " + memberType + "\n\n" +
             "Members added: " + membersAdded + "\n";

if (skipDuplicates && membersSkipped > 0)
{
    report += "Members skipped (already exist): " + membersSkipped + "\n";
}

report += "\nTotal members in role: " + role.Members.Count + "\n\n";

if (role.Members.Count > 0)
{
    report += "Current members:\n";
    foreach (var m in role.Members.Take(10))
    {
        var type = m.GetType().Name == "WindowsModelRoleMember" ? "[Windows]" : "[Azure AD]";
        report += "  " + type + " " + m.MemberName + "\n";
    }

    if (role.Members.Count > 10)
    {
        report += "  ... and " + (role.Members.Count - 10) + " more\n";
    }
}

Info(report);
