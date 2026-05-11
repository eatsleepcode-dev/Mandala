// Example: Set Column Data Category
// This script marks geographic columns with appropriate data categories

// Mark geographic columns
Model.Tables["Locations"].Columns["Country"].DataCategory = "Country";
Model.Tables["Locations"].Columns["State"].DataCategory = "StateOrProvince";
Model.Tables["Locations"].Columns["City"].DataCategory = "City";
Model.Tables["Locations"].Columns["Postal Code"].DataCategory = "PostalCode";

Info("Set data categories for location columns");
