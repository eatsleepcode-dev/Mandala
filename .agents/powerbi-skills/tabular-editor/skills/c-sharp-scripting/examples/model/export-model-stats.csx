/*
 * Title: Export Model Statistics to TSV
 *
 * Author: Tabular Editor Community
 *
 * Description: Exports comprehensive model statistics to tab-separated files
 * for analysis in Excel, Power BI, or other tools. Creates three files:
 * - table_stats.tsv (table-level statistics)
 * - column_stats.tsv (column-level statistics)
 * - model_summary.tsv (overall model summary)
 *
 * Usage: Run against connected model
 * CLI: te "workspace/model" samples/model/export-model-stats.csx --file
 *
 * Non-interactive: Yes (works on Model object)
 */

// Output directory - defaults to Desktop
string outputDir = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
string modelName = Model?.Name?.Replace(" ", "_") ?? "Model";
string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");

// Collect VertiPaq statistics
try {
    Info("Collecting VertiPaq statistics...");
    CollectVertiPaqAnalyzerStats();
    Info("Statistics collected successfully");
} catch (Exception ex) {
    Error("Failed to collect VertiPaq stats: " + ex.Message);
    return;
}

// Helper: Format bytes
string FormatBytes(long bytes) {
    string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
    int suffixIndex = 0;
    double size = bytes;

    while (size >= 1024 && suffixIndex < suffixes.Length - 1) {
        size /= 1024;
        suffixIndex++;
    }

    return size.ToString("N2") + " " + suffixes[suffixIndex];
}

// Collect table statistics
var tableStatsFile = Path.Combine(outputDir, modelName + "_table_stats_" + timestamp + ".tsv");
var tableSb = new System.Text.StringBuilder();
tableSb.AppendLine("TableName\tRowCount\tSizeBytes\tSizeFormatted\tColumns\tMeasures\tRelationships");

long totalModelSize = 0;
foreach(var table in Model.Tables) {
    long tableSize = 0;
    long rowCount = 0;

    try { tableSize = table.GetTotalSize(); totalModelSize += tableSize; } catch { }

    try {
        dynamic result = EvaluateDax("COUNTROWS(" + table.DaxObjectFullName + ")");
        if (result != null && long.TryParse(result.ToString(), out long rc)) {
            rowCount = rc;
        }
    } catch { }

    int columnCount = table.Columns.Count(c => c.Type != ColumnType.RowNumber);
    int measureCount = table.Measures.Count;
    int relationshipCount = Model.Relationships.Count(r =>
        r.FromTable == table || r.ToTable == table);

    tableSb.AppendLine(table.Name + "\t" + rowCount + "\t" + tableSize + "\t" + FormatBytes(tableSize) + "\t" + columnCount + "\t" + measureCount + "\t" + relationshipCount);
}

File.WriteAllText(tableStatsFile, tableSb.ToString());
Info("Exported table statistics to: " + tableStatsFile);

// Collect column statistics
var columnStatsFile = Path.Combine(outputDir, modelName + "_column_stats_" + timestamp + ".tsv");
var columnSb = new System.Text.StringBuilder();
columnSb.AppendLine("TableName\tColumnName\tDataType\tSizeBytes\tSizeFormatted\tCardinality\tIsHidden\tSummarizeBy");

foreach(var table in Model.Tables) {
    foreach(var column in table.Columns.Where(c => c.Type != ColumnType.RowNumber)) {
        long columnSize = 0;
        long cardinality = 0;

        try {
            if (column is DataColumn dataColumn) {
                columnSize = dataColumn.GetTotalSize();
            }
        } catch { }

        try {
            dynamic result = EvaluateDax("COUNTROWS(DISTINCT(" + column.DaxObjectFullName + "))");
            if (result != null && long.TryParse(result.ToString(), out long card)) {
                cardinality = card;
            }
        } catch { }

        columnSb.AppendLine(table.Name + "\t" + column.Name + "\t" + column.DataType + "\t" + columnSize + "\t" + FormatBytes(columnSize) + "\t" + cardinality + "\t" + column.IsHidden + "\t" + column.SummarizeBy);
    }
}

File.WriteAllText(columnStatsFile, columnSb.ToString());
Info("Exported column statistics to: " + columnStatsFile);

// Create model summary
var summaryFile = Path.Combine(outputDir, modelName + "_summary_" + timestamp + ".tsv");
var summarySb = new System.Text.StringBuilder();
summarySb.AppendLine("Metric\tValue");
summarySb.AppendLine("Model Name\t" + Model.Name);
summarySb.AppendLine("Total Tables\t" + Model.Tables.Count);
summarySb.AppendLine("Total Columns\t" + Model.AllColumns.Count());
summarySb.AppendLine("Total Measures\t" + Model.AllMeasures.Count());
summarySb.AppendLine("Total Relationships\t" + Model.Relationships.Count);
summarySb.AppendLine("Total Size (bytes)\t" + totalModelSize);
summarySb.AppendLine("Total Size (formatted)\t" + FormatBytes(totalModelSize));
summarySb.AppendLine("Calculation Groups\t" + (Model.CalculationGroups?.Count ?? 0));
summarySb.AppendLine("Roles\t" + (Model.Roles?.Count ?? 0));
summarySb.AppendLine("Export Timestamp\t" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));

File.WriteAllText(summaryFile, summarySb.ToString());
Info("Exported model summary to: " + summaryFile);

Info("");
Info("=== EXPORT COMPLETE ===");
Info("Total Model Size: " + FormatBytes(totalModelSize));
Info("Files exported to: " + outputDir);
