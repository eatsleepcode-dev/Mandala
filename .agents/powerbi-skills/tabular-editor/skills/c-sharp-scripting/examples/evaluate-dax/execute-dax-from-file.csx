// Execute DAX queries from .dax files
// Pattern: File.ReadAllText("query.dax") then EvaluateDax()

var sampleQuery = @"
ADDCOLUMNS(
    {""Table Count""},
    ""Value"",
    " + Model.Tables.Count + @"
)";

var daxFilePath = @"sample-query.dax";

try {
    System.IO.File.WriteAllText(daxFilePath, sampleQuery);
    var daxFromFile = System.IO.File.ReadAllText(daxFilePath);
    dynamic result = EvaluateDax(daxFromFile);

    Info("EXECUTE FROM FILE:");
    Info("  Result: " + result.Rows[0][1]);

    System.IO.File.Delete(daxFilePath);
} catch (Exception ex) {
    Error("Failed: " + ex.Message.Substring(0, Math.Min(100, ex.Message.Length)));
}
