// Set Default Mode
// Sets the default storage mode for new tables
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var targetMode = "Import";  // Options: "Import", "DirectQuery", "Dual"

// About Storage Modes:
// - Import: Data is cached in-memory, fast queries, scheduled refresh required
// - DirectQuery: Queries execute against source, always current data, slower
// - Dual: Can use either Import or DirectQuery based on query context
//
// Note: This sets the DEFAULT mode for new tables
// Existing tables are not affected

// ============================================================================
// VALIDATION
// ============================================================================

ModeType modeType;

switch (targetMode.ToUpper())
{
    case "IMPORT":
        modeType = ModeType.Import;
        break;
    case "DIRECTQUERY":
        modeType = ModeType.DirectQuery;
        break;
    case "DUAL":
        modeType = ModeType.Dual;
        break;
    default:
        Error("Invalid mode: " + targetMode + "\n\nValid options: Import, DirectQuery, Dual");
        return;
}

// ============================================================================
// SET DEFAULT MODE
// ============================================================================

var previousMode = Model.DefaultMode;
Model.DefaultMode = modeType;

// ============================================================================
// CONFIRMATION MESSAGE
// ============================================================================

var message = "DEFAULT STORAGE MODE UPDATED\n";
message += "═══════════════════════════════════════════════════════════\n\n";
message += "Previous Default: " + previousMode + "\n";
message += "New Default: " + modeType + "\n\n";

message += "CURRENT TABLE MODE SUMMARY\n";
message += "───────────────────────────────────────────────────────────\n";

var importCount = Model.Tables.Where(t => t.Partitions.Any(p => p.Mode == ModeType.Import)).Count();
var directQueryCount = Model.Tables.Where(t => t.Partitions.Any(p => p.Mode == ModeType.DirectQuery)).Count();
var dualCount = Model.Tables.Where(t => t.Partitions.Any(p => p.Mode == ModeType.Dual)).Count();

message += "Import Tables: " + importCount + "\n";
message += "DirectQuery Tables: " + directQueryCount + "\n";
message += "Dual Tables: " + dualCount + "\n\n";

message += "Note: This setting only affects NEW tables.\n";
message += "Existing tables retain their current storage mode.\n";

Info(message);
