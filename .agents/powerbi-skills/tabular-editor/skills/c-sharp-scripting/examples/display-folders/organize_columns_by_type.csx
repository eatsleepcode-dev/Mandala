// Example: Organize Columns by Semantic Type
// This script organizes columns into display folders by their semantic meaning

var invoices = Model.Tables["Invoices"];

// Keys
invoices.Columns["Invoice ID"].DisplayFolder = "Columns/Keys";
invoices.Columns["Customer Key"].DisplayFolder = "Columns/Keys";
invoices.Columns["Product Key"].DisplayFolder = "Columns/Keys";

// Dates
invoices.Columns["Invoice Date"].DisplayFolder = "Columns/Dates";
invoices.Columns["Due Date"].DisplayFolder = "Columns/Dates";
invoices.Columns["Ship Date"].DisplayFolder = "Columns/Dates";

// Metrics
invoices.Columns["Quantity"].DisplayFolder = "Columns/Metrics";
invoices.Columns["Unit Price"].DisplayFolder = "Columns/Metrics";
invoices.Columns["Total Amount"].DisplayFolder = "Columns/Metrics";

Info("Organized columns in Invoices table");
