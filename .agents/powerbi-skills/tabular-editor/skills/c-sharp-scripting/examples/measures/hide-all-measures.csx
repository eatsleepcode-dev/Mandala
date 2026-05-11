// Hide all measures in the entire model
// Useful for hiding intermediate/helper measures

int count = 0;

foreach(var measure in Model.AllMeasures) {
    if (!measure.IsHidden) {
        measure.IsHidden = true;
        count++;
    }
}

Info("Hidden " + count + " measures across all tables");
