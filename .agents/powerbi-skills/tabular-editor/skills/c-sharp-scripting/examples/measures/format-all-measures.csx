// Format DAX for all measures in the model
// Uses Tabular Editor's built-in DAX formatter

int count = 0;

foreach(var measure in Model.AllMeasures) {
    measure.FormatDax();
    count++;
}

Info("Formatted " + count + " measures");
