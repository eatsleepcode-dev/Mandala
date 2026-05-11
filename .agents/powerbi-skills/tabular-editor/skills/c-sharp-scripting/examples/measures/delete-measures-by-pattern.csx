// Delete all measures matching a pattern (e.g., test measures, old measures)
// Usage: Modify pattern variable

var pattern = "_OLD";  // Delete all measures ending with "_OLD"

int count = 0;

var measuresToDelete = Model.AllMeasures.Where(m => m.Name.Contains(pattern)).ToList();

foreach(var measure in measuresToDelete) {
    Info("Deleting measure: " + measure.DaxObjectFullName);
    measure.Delete();
    count++;
}

Info("Deleted " + count + " measures matching pattern '" + pattern + "'");
