// Example: Organize Columns into Display Folders by Semantic Type
// This script organizes columns across multiple tables into logical folders

Info("Organizing columns into display folders...");

// Organize Invoices table
var invoices = Model.Tables["Invoices"];

// Keys
invoices.Columns["Invoice ID"].DisplayFolder = "Columns/Keys";
invoices.Columns["Customer Key"].DisplayFolder = "Columns/Keys";
invoices.Columns["Product Key"].DisplayFolder = "Columns/Keys";
invoices.Columns["Salesperson Key"].DisplayFolder = "Columns/Keys";

// Dates
invoices.Columns["Invoice Date"].DisplayFolder = "Columns/Dates";
invoices.Columns["Due Date"].DisplayFolder = "Columns/Dates";
invoices.Columns["Ship Date"].DisplayFolder = "Columns/Dates";

// Metrics
invoices.Columns["Net Invoice Value"].DisplayFolder = "Columns/Metrics";
invoices.Columns["Net Invoice Quantity"].DisplayFolder = "Columns/Metrics";
invoices.Columns["Unit Price"].DisplayFolder = "Columns/Metrics";

// Costs
invoices.Columns["Delivery Cost"].DisplayFolder = "Columns/Costs";
invoices.Columns["Freight"].DisplayFolder = "Columns/Costs";

Info("Organized Invoices table columns");

// Organize Customers table
var customers = Model.Tables["Customers"];

customers.Columns["Customer Key"].DisplayFolder = "Columns/Keys";
customers.Columns["Customer Name"].DisplayFolder = "Columns/Names";
customers.Columns["Account Name"].DisplayFolder = "Columns/Names";
customers.Columns["Type"].DisplayFolder = "Columns/Attributes";
customers.Columns["Category"].DisplayFolder = "Columns/Attributes";

Info("Organized Customers table columns");

// Organize Products table
var products = Model.Tables["Products"];

products.Columns["Product Key"].DisplayFolder = "Columns/Keys";
products.Columns["Product Name"].DisplayFolder = "Columns/Names";
products.Columns["Type"].DisplayFolder = "Columns/Attributes";
products.Columns["Subtype"].DisplayFolder = "Columns/Attributes";
products.Columns["Size"].DisplayFolder = "Columns/Specifications";
products.Columns["Weight"].DisplayFolder = "Columns/Specifications";

Info("Organized Products table columns");

Info("Column organization complete!");
