/*
 * Title: Get Table Statistics
 *
 * Author: Tabular Editor Community
 *
 * Description: Retrieves comprehensive statistics for all tables including
 * row counts, size, column count, and measure count. Useful for understanding
 * model structure and identifying optimization opportunities.
 *
 * Usage: Run against connected model
 * CLI: te "workspace/model" samples/tables/get-table-stats.csx --file
 *
 * Non-interactive: Yes (works on Model object)
 */

// Collect VertiPaq statistics (required for size analysis)
try {
    Info("Collecting VertiPaq statistics...");
    CollectVertiPaqAnalyzerStats();
    Info("Statistics collected successfully");
} catch (Exception ex) {
    Error("Failed to collect VertiPaq stats: " + ex.Message);
    return;
}

// Collect table stats
var tableStats = new List<(string Name, long RowCount, long Size, int Columns, int Measures)>();

foreach(var table in Model.Tables) {
    long tableSize = 0;
    long rowCount = 0;

    // Get table size
    try {
        tableSize = table.GetTotalSize();
    } catch {
        // Size unavailable
    }

    // Get row count using DAX
    try {
        dynamic result = EvaluateDax("COUNTROWS(" + table.DaxObjectFullName + ")");
        if (result != null && long.TryParse(result.ToString(), out long rc)) {
            rowCount = rc;
        }
    } catch {
        // Row count unavailable
    }

    int columnCount = table.Columns.Count(c => c.Type != ColumnType.RowNumber);
    int measureCount = table.Measures.Count;

    tableStats.Add((table.Name, rowCount, tableSize, columnCount, measureCount));
}

// Format size helper
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

string FormatNumber(long number) {
    return number.ToString("N0");
}

// Sort by size
var sortedBySize = tableStats.OrderByDescending(t => t.Size).ToList();

// Output results
Info("=== TABLE STATISTICS ===");
Info("Total Tables: " + tableStats.Count);
Info("");
Info("=== TABLES (sorted by size) ===");
Info("Table Name | Rows | Size | Columns | Measures");
Info("".PadRight(70, '-'));

foreach(var table in sortedBySize) {
    string rowCountStr = table.RowCount > 0 ? FormatNumber(table.RowCount) : "N/A";
    string sizeStr = table.Size > 0 ? FormatBytes(table.Size) : "N/A";
    Info(table.Name.PadRight(30) + " | " + rowCountStr.PadLeft(12) + " | " + sizeStr.PadLeft(10) + " | " + table.Columns.ToString().PadLeft(7) + " | " + table.Measures.ToString().PadLeft(8));
}

Info("");
Info("=== SUMMARY ===");
var totalRows = tableStats.Sum(t => t.RowCount);
var totalSize = tableStats.Sum(t => t.Size);
var totalColumns = tableStats.Sum(t => t.Columns);
var totalMeasures = tableStats.Sum(t => t.Measures);

Info("Total Rows: " + FormatNumber(totalRows));
Info("Total Size: " + FormatBytes(totalSize));
Info("Total Columns: " + totalColumns);
Info("Total Measures: " + totalMeasures);

// Identify measure tables
var measureTables = tableStats.Where(t => t.Measures > 0 && t.Columns <= 2).ToList();
if (measureTables.Any()) {
    Info("");
    Info("=== MEASURE TABLES ===");
    foreach(var table in measureTables) {
        Info(table.Name + " (" + table.Measures + " measures)");
    }
}
