// Example: Custom Format String (Millions/Thousands)
// This script applies a custom format that shows values in millions or thousands

var measure = Model.Tables["Sales"].Measures["Total Revenue"];

// Format: >= 1M show as "M", >= 1K show as "K", else show number
measure.FormatString = "[>=1000000]$0.0,,\"M\";[>=1000]$0.0,\"K\";$#,0";

Info("Applied custom format to " + measure.Name);
