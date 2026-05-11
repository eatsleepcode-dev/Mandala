// Check Model Compatibility Level
// Displays current compatibility level and available upgrade paths
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// GET CURRENT COMPATIBILITY LEVEL
// ============================================================================

var currentLevel = Model.Database.CompatibilityLevel;
var modelName = Model.Database.Name;

// Compatibility level mapping
var levelNames = new Dictionary<int, string>
{
    { 1100, "SQL Server 2012 / Power BI (1100)" },
    { 1103, "SQL Server 2012 SP1 (1103)" },
    { 1200, "SQL Server 2016 / Azure AS (1200)" },
    { 1400, "SQL Server 2017 / Azure AS (1400)" },
    { 1450, "SQL Server 2017 / Azure AS (1450)" },
    { 1455, "SQL Server 2017 / Azure AS (1455)" },
    { 1460, "SQL Server 2017 / Azure AS (1460)" },
    { 1465, "SQL Server 2019 / Azure AS / Power BI (1465)" },
    { 1470, "SQL Server 2019 / Azure AS / Power BI (1470)" },
    { 1500, "SQL Server 2019 / Azure AS / Power BI (1500)" },
    { 1520, "Power BI / Azure AS (1520)" },
    { 1530, "Power BI / Azure AS (1530)" },
    { 1540, "Power BI / Azure AS (1540)" },
    { 1550, "Power BI / Azure AS (1550)" },
    { 1560, "Power BI / Azure AS (1560)" },
    { 1565, "Power BI / Azure AS (1565)" },
    { 1570, "Power BI / Azure AS (1570)" }
};

var levelName = levelNames.ContainsKey(currentLevel)
    ? levelNames[currentLevel]
    : "Unknown (" + currentLevel + ")";

// ============================================================================
// BUILD OUTPUT MESSAGE
// ============================================================================

var message = "MODEL COMPATIBILITY LEVEL\n";
message += "═══════════════════════════════════════════════════════════\n\n";
message += "Model: " + modelName + "\n";
message += "Current Level: " + levelName + "\n\n";

// Show available upgrade paths
message += "AVAILABLE UPGRADE PATHS\n";
message += "───────────────────────────────────────────────────────────\n\n";

var upgradeLevels = levelNames.Keys.Where(l => l > currentLevel).OrderBy(l => l).ToList();

if (upgradeLevels.Count > 0)
{
    foreach (var level in upgradeLevels)
    {
        message += "→ " + levelNames[level] + "\n";
    }

    message += "\n";
    message += "To upgrade, use: set-compatibility-level.csx\n";
    message += "⚠️  WARNING: Compatibility level upgrades are IRREVERSIBLE\n";
}
else
{
    message += "Model is at the highest known compatibility level.\n";
}

// ============================================================================
// SHOW FEATURE INFORMATION
// ============================================================================

message += "\n";
message += "KEY FEATURES BY COMPATIBILITY LEVEL\n";
message += "───────────────────────────────────────────────────────────\n\n";

message += "1200+: Calculated tables, many-to-many relationships\n";
message += "1400+: Object-level security, detail rows, metadata translations\n";
message += "1450+: Improved calculation groups\n";
message += "1465+: Composite models (Power BI)\n";
message += "1470+: Enhanced refresh policies\n";
message += "1500+: Query interleaving, DirectQuery improvements\n";
message += "1520+: Field parameters (Power BI)\n";
message += "1530+: Format string expressions (Power BI)\n";
message += "1540+: Hybrid tables (Power BI Premium)\n";
message += "1550+: DirectLake support (Fabric)\n";
message += "1560+: Enhanced DirectLake features (Fabric)\n";
message += "1565+: Calculation groups in DirectLake (Fabric)\n";
message += "1570+: Latest features (Fabric)\n";

Info(message);
