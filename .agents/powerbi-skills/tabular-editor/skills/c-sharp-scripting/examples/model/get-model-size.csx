/*
 * Title: Get Model Size Statistics
 *
 * Author: Tabular Editor Community
 *
 * Description: Retrieves VertiPaq storage statistics for the entire model,
 * showing total size and breakdown by tables.
 *
 * Usage: Run against connected model to get size analysis
 * CLI: te "workspace/model" samples/model/get-model-size.csx --file
 *
 * Non-interactive: Yes (works on Model object)
 */

var query = @"
SELECTCOLUMNS(
    INFO.STORAGETABLECOLUMNS(),
    ""Table"", [DIMENSION_NAME],
    ""Size"", [DICTIONARY_SIZE]
)";

try {
    dynamic result = EvaluateDax(query);

    var tableSizes = new Dictionary<string, long>();
    long totalModelSize = 0;

    for (int i = 0; i < result.Rows.Count; i++) {
        string table = result.Rows[i][0].ToString();
        long size = Convert.ToInt64(result.Rows[i][1]);

        if (!tableSizes.ContainsKey(table)) {
            tableSizes[table] = 0;
        }
        tableSizes[table] += size;
        totalModelSize += size;
    }

    var sortedTables = tableSizes.OrderByDescending(t => t.Value).ToList();

    Info("=== MODEL SIZE ANALYSIS ===");
    double totalMB = totalModelSize / 1024.0 / 1024.0;
    Info("Total Model Size: " + totalMB.ToString("N2") + " MB");
    Info("Total Tables: " + tableSizes.Count);
    Info("");
    Info("=== TABLES BY SIZE (Top 10) ===");
    Info("Table | Size | % of Model");
    Info("".PadRight(70, '-'));

    foreach(var table in sortedTables.Take(10)) {
        double sizeMB = table.Value / 1024.0 / 1024.0;
        double percentage = totalModelSize > 0 ? (double)table.Value / totalModelSize * 100 : 0;
        string tableName = "[" + table.Key + "]";
        Info(tableName.PadRight(35) + " | " + sizeMB.ToString("N2").PadLeft(10) + " MB | " + percentage.ToString("F1") + "%");
    }
} catch (Exception ex) {
    Error("Failed to get model size: " + ex.Message);
}
