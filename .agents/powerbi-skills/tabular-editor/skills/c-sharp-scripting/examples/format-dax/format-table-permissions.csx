// Format all RLS filter expressions (table permissions) across all roles

int _counter = 0;
foreach (var _role in Model.Roles)
{
    foreach (var _permission in _role.TablePermissions)
    {
        if (!string.IsNullOrWhiteSpace(_permission.FilterExpression))
        {
            _permission.FilterExpression = "\n" + FormatDax(_permission.FilterExpression, shortFormat: true);
            _counter++;
        }
    }
}

Info("Formatted " + Convert.ToString(_counter) + " RLS filter expressions across " + Convert.ToString(Model.Roles.Count) + " roles.");
