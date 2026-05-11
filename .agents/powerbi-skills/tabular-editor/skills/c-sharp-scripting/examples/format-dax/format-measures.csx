// Format all DAX measures in the model

var _measures = Model.AllMeasures;
_measures.FormatDax();

Info("Formatted " + Convert.ToString(_measures.Count()) + " measures.");
