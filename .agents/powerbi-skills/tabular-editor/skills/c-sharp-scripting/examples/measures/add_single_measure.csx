// Example: Add a Single Measure
// This script adds one measure with all properties set

var measure = Model.Tables["Sales"].AddMeasure("Total Revenue");
measure.Expression = "SUM(Sales[Amount])";
measure.FormatString = "$#,0";
measure.Description = "Total sales revenue";
measure.DisplayFolder = "Base Measures";

Info("Added measure: " + measure.Name);
