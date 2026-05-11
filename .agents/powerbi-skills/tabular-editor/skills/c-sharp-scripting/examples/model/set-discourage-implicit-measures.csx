// Set Discourage Implicit Measures
// Enables or disables the DiscourageImplicitMeasures property
// Author: Kurt Buhler, Data Goblins

// ============================================================================
// CONFIGURATION - Update these values
// ============================================================================

var enableDiscourage = true;  // Set to true to discourage implicit measures, false to allow them

// About Implicit Measures:
// When disabled (DiscourageImplicitMeasures = false):
//   - Users can drag numeric columns directly to values in visuals
//   - Power BI creates automatic Sum/Count/Average etc. aggregations
//   - These "implicit measures" are not visible in the model
//   - Can lead to confusion and incorrect calculations
//
// When enabled (DiscourageImplicitMeasures = true):
//   - Users cannot create implicit measures
//   - All aggregations must be explicit measures in the model
//   - Better control over calculations and naming
//   - Recommended best practice for enterprise models

// ============================================================================
// SET PROPERTY
// ============================================================================

var previousValue = Model.DiscourageImplicitMeasures;
Model.DiscourageImplicitMeasures = enableDiscourage;

// ============================================================================
// CONFIRMATION MESSAGE
// ============================================================================

var message = "DISCOURAGE IMPLICIT MEASURES UPDATED\n";
message += "═══════════════════════════════════════════════════════════\n\n";
message += "Previous Setting: " + (previousValue ? "Enabled" : "Disabled") + "\n";
message += "New Setting: " + (enableDiscourage ? "Enabled" : "Disabled") + "\n\n";

if (enableDiscourage)
{
    message += "✓ Implicit measures are now discouraged\n\n";
    message += "What this means:\n";
    message += "• Users cannot drag numeric columns directly to visual values\n";
    message += "• All aggregations must use explicit measures\n";
    message += "• Provides better control over calculations\n";
    message += "• Recommended for enterprise models\n\n";
    message += "Next steps:\n";
    message += "• Ensure all necessary measures exist in the model\n";
    message += "• Communicate change to report authors\n";
    message += "• Consider creating common aggregation measures if needed\n";
}
else
{
    message += "✓ Implicit measures are now allowed\n\n";
    message += "What this means:\n";
    message += "• Users can drag numeric columns to create automatic aggregations\n";
    message += "• Power BI will generate Sum/Count/Average etc.\n";
    message += "• Less control over calculations\n";
    message += "• ⚠️  May lead to confusion or incorrect calculations\n\n";
    message += "Consider:\n";
    message += "• Re-enabling discourage implicit measures for better governance\n";
    message += "• Creating explicit measures for common calculations\n";
}

Info(message);
