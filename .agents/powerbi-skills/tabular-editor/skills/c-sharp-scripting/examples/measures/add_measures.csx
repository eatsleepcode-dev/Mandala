// Example: Add Multiple Measures to Sales Table
// This script creates common base measures for a Sales fact table

var sales = Model.Tables["Sales"];

Info("Adding base measures to Sales table...");

// Total Sales Amount
var totalSales = sales.AddMeasure("Total Sales", "SUM(Sales[Amount])");
totalSales.FormatString = "$#,0";
totalSales.DisplayFolder = "Sales/Base Measures";
totalSales.Description = "Total sales amount";

// Total Quantity
var totalQty = sales.AddMeasure("Total Quantity", "SUM(Sales[Quantity])");
totalQty.FormatString = "#,0";
totalQty.DisplayFolder = "Sales/Base Measures";
totalQty.Description = "Total quantity sold";

// Sales Count
var salesCount = sales.AddMeasure("Sales Count", "COUNTROWS(Sales)");
salesCount.FormatString = "#,0";
salesCount.DisplayFolder = "Sales/Base Measures";
salesCount.Description = "Number of sales transactions";

// Average Sale Amount
var avgSale = sales.AddMeasure("Average Sale Amount");
avgSale.Expression = "DIVIDE([Total Sales], [Sales Count])";
avgSale.FormatString = "$#,0.00";
avgSale.DisplayFolder = "Sales/Calculated Measures";
avgSale.Description = "Average amount per sale";

// Average Unit Price
var avgPrice = sales.AddMeasure("Average Unit Price");
avgPrice.Expression = "DIVIDE([Total Sales], [Total Quantity])";
avgPrice.FormatString = "$#,0.00";
avgPrice.DisplayFolder = "Sales/Calculated Measures";
avgPrice.Description = "Average price per unit";

Info("Successfully added 5 measures to Sales table!");
