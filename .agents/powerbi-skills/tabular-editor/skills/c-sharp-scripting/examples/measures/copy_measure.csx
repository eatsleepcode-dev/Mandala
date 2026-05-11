// Example: Copy Measure to Another Table
// This script copies a measure from one table to another

var sourceMeasure = Model.Tables["Sales"].Measures["Total Revenue"];
var targetTable = Model.Tables["Summary"];

var newMeasure = targetTable.AddMeasure(sourceMeasure.Name, sourceMeasure.Expression);
newMeasure.FormatString = sourceMeasure.FormatString;
newMeasure.Description = sourceMeasure.Description;
newMeasure.DisplayFolder = sourceMeasure.DisplayFolder;

Info("Copied measure to " + targetTable.Name);
