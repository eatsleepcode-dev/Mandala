// Set Model Compatibility Level
// Upgrades model compatibility level (IRREVERSIBLE - USE WITH CAUTION)
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetLevel = 1570;  // Target compatibility level

// ⚠️  WARNING: COMPATIBILITY LEVEL UPGRADES ARE IRREVERSIBLE
// Once upgraded, the model cannot be downgraded without recreating it
// Ensure you have a backup before proceeding

// Common levels:
// 1200 = SQL Server 2016 / Azure AS
// 1400 = SQL Server 2017 / Azure AS
// 1465 = SQL Server 2019 / Azure AS / Power BI
// 1500 = SQL Server 2019 / Azure AS / Power BI
// 1520 = Power BI / Azure AS
// 1530 = Power BI / Azure AS (Format string expressions)
// 1540 = Power BI / Azure AS (Hybrid tables)
// 1550 = Power BI / Azure AS / Fabric (DirectLake)
// 1560 = Power BI / Azure AS / Fabric
// 1565 = Power BI / Azure AS / Fabric (Calculation groups in DirectLake)
// 1570 = Power BI / Azure AS / Fabric (Latest)

// ============================================================================
// VALIDATION
// ============================================================================

var currentLevel = Model.Database.CompatibilityLevel;

if (targetLevel <= currentLevel)
{
    Error("Target level (" + targetLevel + ") must be higher than current level (" + currentLevel + ").\n\n" +
          "⚠️  DOWNGRADING IS NOT POSSIBLE - compatibility levels can only be upgraded.");
}

// Validate target level is a known level
var validLevels = new List<int> { 1100, 1103, 1200, 1400, 1450, 1455, 1460, 1465, 1470, 1500, 1520, 1530, 1540, 1550, 1560, 1565, 1570 };

if (!validLevels.Contains(targetLevel))
{
    Error("Target level (" + targetLevel + ") is not a recognized compatibility level.\n\n" +
          "Valid levels: " + string.Join(", ", validLevels));
}

// ============================================================================
// UPGRADE COMPATIBILITY LEVEL
// ============================================================================

var oldLevel = Model.Database.CompatibilityLevel;
Model.Database.CompatibilityLevel = targetLevel;

// ============================================================================
// CONFIRMATION MESSAGE
// ============================================================================

var message = "COMPATIBILITY LEVEL UPGRADED\n";
message += "═══════════════════════════════════════════════════════════\n\n";
message += "Previous Level: " + oldLevel + "\n";
message += "New Level: " + targetLevel + "\n\n";
message += "⚠️  This change is IRREVERSIBLE\n";
message += "⚠️  Save and validate the model carefully\n";
message += "⚠️  Test thoroughly before deploying to production\n\n";
message += "Next steps:\n";
message += "1. Save the model\n";
message += "2. Test all existing functionality\n";
message += "3. Validate DAX expressions\n";
message += "4. Check for any compatibility warnings\n";

Info(message);
