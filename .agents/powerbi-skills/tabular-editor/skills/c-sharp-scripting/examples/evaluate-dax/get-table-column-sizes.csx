// Get table and column sizes using DAX INFO functions
// Usage: te "workspace/model" get-table-column-sizes.csx --file
// Requirements: Model data must be loaded

Info("=== TABLE AND COLUMN SIZES ===\n");

// Column cardinality using COLUMNSTATISTICS
try {
    var query = "TOPN(10, COLUMNSTATISTICS(), [Cardinality], DESC)";
    dynamic result = EvaluateDax(query);

    Info("TOP 10 BY CARDINALITY:");
    for (int i = 0; i < result.Rows.Count; i++) {
        var table = result.Rows[i][0];
        var column = result.Rows[i][1];
        var card = Convert.ToInt64(result.Rows[i][4]).ToString("N0");
        Info("  " + table + "[" + column + "]: " + card);
    }
} catch (Exception ex) {
    Error("Failed to get cardinality: " + ex.Message);
}

// Column storage size using INFO.STORAGETABLECOLUMNS
try {
    var query = @"
TOPN(
    10,
    SELECTCOLUMNS(
        INFO.STORAGETABLECOLUMNS(),
        ""Table"", [DIMENSION_NAME],
        ""Column"", [ATTRIBUTE_NAME],
        ""Size MB"", [DICTIONARY_SIZE] / 1024 / 1024
    ),
    [Size MB],
    DESC
)";

    dynamic result = EvaluateDax(query);

    Info("\nTOP 10 BY SIZE:");
    for (int i = 0; i < result.Rows.Count; i++) {
        var table = result.Rows[i][0];
        var column = result.Rows[i][1];
        var sizeMB = Convert.ToDouble(result.Rows[i][2]).ToString("N2");
        Info("  " + table + "[" + column + "]: " + sizeMB + " MB");
    }
} catch (Exception ex) {
    Error("Failed to get sizes: " + ex.Message);
}
