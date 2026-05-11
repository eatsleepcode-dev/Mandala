// Modify Role
// Updates role properties and members

// ============================================================================
// CONFIGURATION
// ============================================================================

var roleName = "SalesRegion";

// What to modify
var modifyModelPermission = false;
var modifyDescription = true;
var addMembers = true;
var removeMembers = false;

// New values
var newModelPermission = ModelPermission.ReadRefresh;
var newDescription = "Updated: Sales users with regional filtering";

// Add members (specify type: "windows" or "external")
var memberTypeToAdd = "external";
var windowsMembersToAdd = new string[] { "DOMAIN\\NewUser" };
var externalMembersToAdd = new string[] { "newuser@contoso.com" };

// Remove members (by member name/identity)
var membersToRemove = new string[] { "olduser@contoso.com" };

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Roles.Contains(roleName))
{
    Error("Role not found: " + roleName);
}

var role = Model.Roles[roleName];

// ============================================================================
// MODIFY ROLE
// ============================================================================

var changes = new System.Collections.Generic.List<string>();

if (modifyModelPermission)
{
    role.ModelPermission = newModelPermission;
    changes.Add("Model Permission: " + newModelPermission);
}

if (modifyDescription)
{
    role.Description = newDescription;
    changes.Add("Description updated");
}

// Add members
int membersAddedCount = 0;
if (addMembers)
{
    if (memberTypeToAdd == "windows")
    {
        foreach (var member in windowsMembersToAdd)
        {
            if (!string.IsNullOrWhiteSpace(member))
            {
                role.AddWindowsMember(member);
                membersAddedCount++;
            }
        }
    }
    else if (memberTypeToAdd == "external")
    {
        foreach (var member in externalMembersToAdd)
        {
            if (!string.IsNullOrWhiteSpace(member))
            {
                role.AddExternalMember(member);
                membersAddedCount++;
            }
        }
    }

    if (membersAddedCount > 0)
    {
        changes.Add("Added " + membersAddedCount + " members");
    }
}

// Remove members
int membersRemovedCount = 0;
if (removeMembers)
{
    foreach (var memberIdentity in membersToRemove)
    {
        var member = role.Members.FirstOrDefault(m =>
            m.MemberName == memberIdentity);

        if (member != null)
        {
            member.Delete();
            membersRemovedCount++;
        }
        else
        {
            Info("Warning: Member not found: " + memberIdentity);
        }
    }

    if (membersRemovedCount > 0)
    {
        changes.Add("Removed " + membersRemovedCount + " members");
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Modified Role\n" +
     "=============\n\n" +
     "Name: " + roleName + "\n\n" +
     "Changes made: " + (changes.Count == 0 ? "(none)" : string.Join(", ", changes)) + "\n\n" +
     "Current state:\n" +
     "  Model Permission: " + role.ModelPermission + "\n" +
     "  Total Members: " + role.Members.Count + "\n" +
     "  Description: " + (string.IsNullOrWhiteSpace(role.Description) ? "(none)" : role.Description));
