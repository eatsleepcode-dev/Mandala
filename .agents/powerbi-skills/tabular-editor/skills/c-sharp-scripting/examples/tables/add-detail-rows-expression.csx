// Add Detail Rows Expression
// Sets drill-through DAX expression for a table

// Config
var tableName = "FactSales";

// DAX expression for drill-through
var detailRowsExpression = @"
SELECTCOLUMNS(
    TOPN(100, 'FactSales', 'FactSales'[OrderDate], DESC),
    ""Order Date"", 'FactSales'[OrderDate],
    ""Customer"", RELATED('DimCustomer'[CustomerName]),
    ""Product"", RELATED('DimProduct'[ProductName]),
    ""Quantity"", 'FactSales'[Quantity],
    ""Amount"", 'FactSales'[SalesAmount]
)";

if (!Model.Tables.Contains(tableName))
{
    Error("Table not found: " + tableName);
}

var table = Model.Tables[tableName];
table.DefaultDetailRowsExpression = detailRowsExpression;

Info("Added detail rows expression to: " + tableName);
