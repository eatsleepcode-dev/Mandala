// List all measures in the model with key properties
// Useful for documentation or audit purposes

Info("=== Model Measures ===\n");

foreach(var table in Model.Tables.OrderBy(t => t.Name)) {
    var measures = table.Measures.OrderBy(m => m.Name).ToList();

    if (measures.Count > 0) {
        Info("Table: " + table.Name + " (" + measures.Count + " measures)");

        foreach(var measure in measures) {
            Info("  - " + measure.Name);
            Info("    Format: " + (string.IsNullOrEmpty(measure.FormatString) ? "(none)" : measure.FormatString));
            Info("    Folder: " + (string.IsNullOrEmpty(measure.DisplayFolder) ? "(root)" : measure.DisplayFolder));
            Info("    Hidden: " + measure.IsHidden);
        }

        Info("");  // Blank line between tables
    }
}

Info("Total measures: " + Model.AllMeasures.Count());
