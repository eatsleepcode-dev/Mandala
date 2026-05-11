// Model size optimization analysis
// Usage: te "workspace/model" optimize-model-size.csx --file
// Requirements: Model data must be loaded

Info("=== MODEL SIZE OPTIMIZATION ===\n");

// High cardinality columns
try {
    var query = "TOPN(15, COLUMNSTATISTICS(), [Cardinality], DESC)";
    dynamic result = EvaluateDax(query);

    Info("HIGH-CARDINALITY COLUMNS:");
    for (int i = 0; i < result.Rows.Count; i++) {
        var table = result.Rows[i][0];
        var column = result.Rows[i][1];
        var card = Convert.ToInt64(result.Rows[i][4]).ToString("N0");
        Info("  " + table + "[" + column + "]: " + card);
    }
    Info("");
} catch (Exception ex) {
    Error("Failed: " + ex.Message);
}

// High cardinality string columns
try {
    var query = "FILTER(COLUMNSTATISTICS(), [Max Length] > 0 && [Cardinality] > 100000)";
    dynamic result = EvaluateDax(query);

    if (result.Rows.Count > 0) {
        Info("HIGH-CARDINALITY STRINGS (consider removing):");
        for (int i = 0; i < Math.Min(5, result.Rows.Count); i++) {
            var table = result.Rows[i][0];
            var column = result.Rows[i][1];
            var card = Convert.ToInt64(result.Rows[i][4]).ToString("N0");
            Info("  " + table + "[" + column + "]: " + card);
        }
        Info("");
    }
} catch { }

// Calculated columns
var calcCols = Model.AllColumns.Count(c => c.Type == ColumnType.Calculated);
Info("CALCULATED COLUMNS: " + calcCols);
Info("  → Move to measures if possible");
Info("");

Info("RECOMMENDATIONS:");
Info("  1. Remove unused tables/columns");
Info("  2. Use integer keys instead of strings");
Info("  3. Aggregate fact tables when possible");
Info("  4. Use appropriate data types");
Info("  5. Hide unused columns");
