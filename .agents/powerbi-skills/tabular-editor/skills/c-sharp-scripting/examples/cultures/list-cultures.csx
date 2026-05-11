// List all Cultures and Translations
// Reports all cultures in the model and translation coverage

// ============================================================================
// CONFIGURATION
// ============================================================================

var showTranslationCoverage = true;  // Show % of objects translated
var showSampleTranslations = false;  // Show sample translated names (verbose)
var sampleCount = 5;  // Number of sample translations to show

// ============================================================================
// BUILD CULTURE LIST
// ============================================================================

if (Model.Cultures.Count == 0)
{
    Info("No cultures (translations) found in model");
    return;
}

// ============================================================================
// BUILD REPORT
// ============================================================================

var report = new System.Text.StringBuilder();
report.AppendLine("Cultures and Translations");
report.AppendLine("=========================\n");
report.AppendLine("Total cultures: " + Model.Cultures.Count + "\n");
report.AppendLine(new string('=', 50) + "\n");

// List each culture
foreach (var culture in Model.Cultures)
{
    report.AppendLine("Culture: " + culture.Name);

    if (showTranslationCoverage)
    {
        // Count translated vs total objects
        int totalTables = Model.Tables.Count;
        int translatedTables = 0;
        int totalMeasures = Model.AllMeasures.Count();
        int translatedMeasures = 0;
        int totalColumns = Model.AllColumns.Count();
        int translatedColumns = 0;
        int totalHierarchies = Model.AllHierarchies.Count();
        int translatedHierarchies = 0;

        foreach (var table in Model.Tables)
        {
            if (!string.IsNullOrWhiteSpace(table.TranslatedNames[culture]))
            {
                translatedTables++;
            }

            foreach (var measure in table.Measures)
            {
                if (!string.IsNullOrWhiteSpace(measure.TranslatedNames[culture]))
                {
                    translatedMeasures++;
                }
            }

            foreach (var column in table.Columns)
            {
                if (!string.IsNullOrWhiteSpace(column.TranslatedNames[culture]))
                {
                    translatedColumns++;
                }
            }

            foreach (var hierarchy in table.Hierarchies)
            {
                if (!string.IsNullOrWhiteSpace(hierarchy.TranslatedNames[culture]))
                {
                    translatedHierarchies++;
                }
            }
        }

        report.AppendLine("\n  Translation coverage:");

        if (totalTables > 0)
        {
            var pct = (int)((translatedTables / (double)totalTables) * 100);
            report.AppendLine("    Tables: " + translatedTables + "/" + totalTables + " (" + pct + "%)");
        }

        if (totalMeasures > 0)
        {
            var pct = (int)((translatedMeasures / (double)totalMeasures) * 100);
            report.AppendLine("    Measures: " + translatedMeasures + "/" + totalMeasures + " (" + pct + "%)");
        }

        if (totalColumns > 0)
        {
            var pct = (int)((translatedColumns / (double)totalColumns) * 100);
            report.AppendLine("    Columns: " + translatedColumns + "/" + totalColumns + " (" + pct + "%)");
        }

        if (totalHierarchies > 0)
        {
            var pct = (int)((translatedHierarchies / (double)totalHierarchies) * 100);
            report.AppendLine("    Hierarchies: " + translatedHierarchies + "/" + totalHierarchies + " (" + pct + "%)");
        }
    }

    if (showSampleTranslations)
    {
        var samples = new System.Collections.Generic.List<string>();

        // Collect sample translations
        foreach (var table in Model.Tables.Take(sampleCount))
        {
            var translated = table.TranslatedNames[culture];
            if (!string.IsNullOrWhiteSpace(translated))
            {
                samples.Add("Table: " + table.Name + " → " + translated);
            }
        }

        foreach (var measure in Model.AllMeasures.Take(sampleCount))
        {
            var translated = measure.TranslatedNames[culture];
            if (!string.IsNullOrWhiteSpace(translated))
            {
                samples.Add("Measure: " + measure.Name + " → " + translated);
            }
        }

        if (samples.Count > 0)
        {
            report.AppendLine("\n  Sample translations:");
            foreach (var sample in samples.Take(10))
            {
                report.AppendLine("    " + sample);
            }
        }
    }

    report.AppendLine("");
}

// ============================================================================
// REPORT RESULTS
// ============================================================================

Info(report.ToString());
