// Modify Translations
// Add or update translated names and descriptions for objects

// ============================================================================
// CONFIGURATION
// ============================================================================

var cultureName = "es-ES";

// Translation mode
var translationMode = "specific";  // "specific", "table", "measure", "column"

// Specific translations (exact object references)
var tableTranslations = new Dictionary<string, string>()
{
    { "FactSales", "Ventas" },
    { "DimProduct", "Productos" },
    { "DimDate", "Fecha" }
};

var measureTranslations = new Dictionary<string, string>()
{
    { "Total Sales", "Ventas Totales" },
    { "Total Quantity", "Cantidad Total" }
};

var columnTranslations = new Dictionary<string, string>()
{
    { "DimProduct/ProductName", "Nombre del Producto" },
    { "DimDate/Year", "Año" },
    { "FactSales/Amount", "Importe" }
};

var hierarchyTranslations = new Dictionary<string, string>()
{
    { "DimDate/Calendar", "Calendario" }
};

// Also translate descriptions
var translateDescriptions = false;

var tableDescriptions = new Dictionary<string, string>()
{
    { "FactSales", "Tabla de hechos de ventas" }
};

// ============================================================================
// VALIDATION
// ============================================================================

if (!Model.Cultures.Contains(cultureName))
{
    Error("Culture not found: " + cultureName + "\n\n" +
          "Create culture first using add-culture.csx");
}

var culture = Model.Cultures[cultureName];

// ============================================================================
// APPLY TRANSLATIONS
// ============================================================================

int tablesTranslated = 0;
int measuresTranslated = 0;
int columnsTranslated = 0;
int hierarchiesTranslated = 0;
int descriptionsTranslated = 0;

// Translate tables
foreach (var kvp in tableTranslations)
{
    if (Model.Tables.Contains(kvp.Key))
    {
        var table = Model.Tables[kvp.Key];
        table.TranslatedNames[culture] = kvp.Value;
        tablesTranslated++;

        if (translateDescriptions && tableDescriptions.ContainsKey(kvp.Key))
        {
            table.TranslatedDescriptions[culture] = tableDescriptions[kvp.Key];
            descriptionsTranslated++;
        }
    }
    else
    {
        Info("Warning: Table not found: " + kvp.Key);
    }
}

// Translate measures
foreach (var kvp in measureTranslations)
{
    var measure = Model.AllMeasures.FirstOrDefault(m => m.Name == kvp.Key);
    if (measure != null)
    {
        measure.TranslatedNames[culture] = kvp.Value;
        measuresTranslated++;
    }
    else
    {
        Info("Warning: Measure not found: " + kvp.Key);
    }
}

// Translate columns
foreach (var kvp in columnTranslations)
{
    var parts = kvp.Key.Split('/');
    if (parts.Length == 2 && Model.Tables.Contains(parts[0]))
    {
        var table = Model.Tables[parts[0]];
        if (table.Columns.Contains(parts[1]))
        {
            table.Columns[parts[1]].TranslatedNames[culture] = kvp.Value;
            columnsTranslated++;
        }
        else
        {
            Info("Warning: Column not found: " + kvp.Key);
        }
    }
    else
    {
        Info("Warning: Invalid column path: " + kvp.Key);
    }
}

// Translate hierarchies
foreach (var kvp in hierarchyTranslations)
{
    var parts = kvp.Key.Split('/');
    if (parts.Length == 2 && Model.Tables.Contains(parts[0]))
    {
        var table = Model.Tables[parts[0]];
        if (table.Hierarchies.Contains(parts[1]))
        {
            table.Hierarchies[parts[1]].TranslatedNames[culture] = kvp.Value;
            hierarchiesTranslated++;
        }
        else
        {
            Info("Warning: Hierarchy not found: " + kvp.Key);
        }
    }
    else
    {
        Info("Warning: Invalid hierarchy path: " + kvp.Key);
    }
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info("Applied Translations\n" +
     "====================\n\n" +
     "Culture: " + cultureName + "\n\n" +
     "Translations applied:\n" +
     "  Tables: " + tablesTranslated + "\n" +
     "  Measures: " + measuresTranslated + "\n" +
     "  Columns: " + columnsTranslated + "\n" +
     "  Hierarchies: " + hierarchiesTranslated + "\n" +
     "  Descriptions: " + descriptionsTranslated);
