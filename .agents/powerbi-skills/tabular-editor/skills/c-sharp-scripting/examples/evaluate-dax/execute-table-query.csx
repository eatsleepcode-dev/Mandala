// Execute DAX table queries
// Table queries return DataTable with .Rows and .Columns

var sampleTable = Model.Tables.FirstOrDefault(t => !t.Name.StartsWith("_"));
if (sampleTable == null) {
    Error("No suitable table found");
}

// Basic table query
try {
    var query = "TOPN(3, VALUES(" + sampleTable.DaxObjectFullName + "[" + sampleTable.Columns.First().Name + "]))";
    dynamic result = EvaluateDax(query);

    Info("BASIC TABLE QUERY:");
    Info("  Rows: " + result.Rows.Count);
    Info("  Columns: " + result.Columns.Count);
    for (int i = 0; i < Math.Min(3, result.Rows.Count); i++) {
        Info("  Row " + i + ": " + result.Rows[i][0]);
    }
} catch (Exception ex) {
    Error("Failed: " + ex.Message.Substring(0, Math.Min(80, ex.Message.Length)));
}

// SUMMARIZECOLUMNS
try {
    var col1 = sampleTable.Columns.First().Name;
    var query = "SUMMARIZECOLUMNS(" + sampleTable.DaxObjectFullName + "[" + col1 + "])";
    dynamic result = EvaluateDax(query);

    Info("\nSUMMARIZECOLUMNS:");
    Info("  Rows: " + result.Rows.Count);
    Info("  First: " + result.Rows[0][0]);
} catch (Exception ex) {
    Error("Failed: " + ex.Message.Substring(0, Math.Min(80, ex.Message.Length)));
}

// ROW() - single row
try {
    var query = "ROW(\"Metric\", \"Test\", \"Value\", 42, \"Date\", TODAY())";
    dynamic result = EvaluateDax(query);

    Info("\nROW():");
    for (int i = 0; i < result.Columns.Count; i++) {
        Info("  " + result.Columns[i].ColumnName + " = " + result.Rows[0][i]);
    }
} catch (Exception ex) {
    Error("Failed: " + ex.Message.Substring(0, Math.Min(80, ex.Message.Length)));
}
