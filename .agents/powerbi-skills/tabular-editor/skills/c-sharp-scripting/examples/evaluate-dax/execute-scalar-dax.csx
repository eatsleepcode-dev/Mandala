// Execute scalar DAX expressions
// Scalar expressions return simple values: Int64, String, Double, DateTime

Info("=== SCALAR DAX EXAMPLES ===\n");

// Arithmetic
Info("ARITHMETIC:");
Info("  1 + 1 = " + EvaluateDax("1 + 1"));
Info("  100 / 4 = " + EvaluateDax("100 / 4"));
Info("  POWER(2, 10) = " + EvaluateDax("POWER(2, 10)"));

// Text
Info("\nTEXT:");
Info("  CONCATENATE: " + EvaluateDax("CONCATENATE(\"DAX \", \"Rocks\")"));
Info("  UPPER: " + EvaluateDax("UPPER(\"tabular editor\")"));

// Dates
Info("\nDATE:");
Info("  TODAY() = " + EvaluateDax("TODAY()"));
Info("  DATE(2025, 1, 1) = " + EvaluateDax("DATE(2025, 1, 1)"));

// Logic
Info("\nLOGIC:");
Info("  IF: " + EvaluateDax("IF(10 > 5, \"Yes\", \"No\")"));
Info("  SWITCH: " + EvaluateDax("SWITCH(2, 1, \"One\", 2, \"Two\", 3, \"Three\")"));

// Requires data
try {
    Info("\nAGGREGATE (requires data):");
    Info("  COUNTROWS: " + EvaluateDax("COUNTROWS(" + Model.Tables.First().DaxObjectFullName + ")"));
} catch { }
