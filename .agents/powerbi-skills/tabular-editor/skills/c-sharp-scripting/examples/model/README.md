# Model-Level Scripts

These scripts manage model-level properties and settings.

## Compatibility Level

**check-compatibility-level.csx** - View current compatibility level and available upgrades
- Shows current level with description
- Lists all available upgrade paths
- Displays key features by compatibility level
- Read-only, safe to run anytime

**set-compatibility-level.csx** - Upgrade model compatibility level
- **⚠️ WARNING: IRREVERSIBLE** - Compatibility levels can only be upgraded, never downgraded
- Configure target level at top of script
- Includes validation to prevent invalid upgrades
- Shows confirmation message with recommendations

## Model Properties

**check-model-properties.csx** - Comprehensive model properties report
- General settings (implicit measures, default mode, culture)
- Storage mode summary across all tables
- Object counts (tables, measures, columns, relationships, etc.)
- Data source listing
- Recommendations for improvements

**set-discourage-implicit-measures.csx** - Enable/disable implicit measures
- Controls whether users can create implicit aggregations
- Best practice: Enable to force explicit measures
- Configure `enableDiscourage` variable (true/false)
- Shows impact and next steps

**set-auto-date-time.csx** - Enable/disable Auto Date/Time
- Controls automatic hidden date table generation
- Best practice: Disable for production, use explicit date tables
- Configure `enableAutoDateTime` variable (true/false)
- Checks for existing date tables
- Shows detailed impact and recommendations

**set-default-mode.csx** - Set default storage mode
- Options: Import, DirectQuery, Dual
- Only affects new tables, not existing
- Shows current table mode distribution
- Useful when switching model strategy

## Usage Pattern

All scripts follow the same pattern:

```csharp
// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var setting = value;  // Configure here

// ============================================================================
// VALIDATION
// ============================================================================

// Check if changes are valid

// ============================================================================
// EXECUTE
// ============================================================================

// Make the change

// ============================================================================
// CONFIRMATION
// ============================================================================

// Show detailed results
```

## Safety Notes

- **Compatibility Level**: Upgrades are IRREVERSIBLE - backup first
- **Auto Date/Time**: Disabling requires explicit date table - check first
- **Default Mode**: Only affects new tables, safe to change
- **Discourage Implicit Measures**: Affects user experience, communicate changes
- All scripts show confirmation messages with details
- Check scripts are read-only and safe to run anytime

## Best Practices

Recommended settings for production models:
- ✓ Discourage Implicit Measures: **Enabled**
- ✓ Auto Date/Time: **Disabled** (use explicit date table)
- ✓ Compatibility Level: Latest supported by your environment
- ✓ Default Mode: Depends on requirements (Import for performance, DirectQuery for real-time)
