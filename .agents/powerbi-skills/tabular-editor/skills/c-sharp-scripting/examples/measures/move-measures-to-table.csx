// Move all measures from one table to another
// Usage: Modify sourceTableName and targetTableName variables

var sourceTableName = "Old Table";
var targetTableName = "Measures";  // Common pattern: centralized measures table

var sourceTable = Model.Tables[sourceTableName];
var targetTable = Model.Tables[targetTableName];

if (sourceTable == null) {
    Error("Source table '" + sourceTableName + "' not found");
    return;
}

if (targetTable == null) {
    Error("Target table '" + targetTableName + "' not found");
    return;
}

int count = 0;
var measuresToMove = sourceTable.Measures.ToList();  // ToList() to avoid collection modification issues

foreach(var measure in measuresToMove) {
    // Create a copy of the measure in the target table
    var newMeasure = measure.Clone(targetTable.Name, measure.Name);
    // Delete the original measure
    measure.Delete();
    count++;
}

Info("Moved " + count + " measures from '" + sourceTableName + "' to '" + targetTableName + "'");
