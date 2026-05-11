// Add DirectQuery Table
// Creates table with M partition in DirectQuery mode. Columns must be manually defined
// Use: tableName="DimProduct" mExpression="let Source=Sql.Database(...) in Source"
var tableName = "DimProduct";
var partitionName = "DirectQuery Partition";

// SQL query for the partition
var sqlQuery = @"
SELECT
    ProductKey,
    ProductName,
    ProductCategory,
    ProductSubcategory,
    UnitPrice,
    StandardCost
FROM dbo.DimProduct
";

// Option 1: Using M expression with DirectQuery mode
// This is more flexible and works with various data sources

var mExpression = @"
let
    Source = Sql.Database(""your-server.database.windows.net"", ""your-database""),
    dbo_DimProduct = Source{[Schema=""dbo"",Item=""DimProduct""]}[Data]
in
    dbo_DimProduct
";

// Create the table
var table = Model.AddTable(tableName);

// Add M partition in DirectQuery mode
var partition = table.AddMPartition(partitionName, mExpression);
partition.Mode = ModeType.DirectQuery;

// Add data columns (schema must match the source)
var productKeyCol = table.AddDataColumn("ProductKey", "ProductKey", "Columns", DataType.Int64);
productKeyCol.IsKey = true;
productKeyCol.SummarizeBy = AggregateFunction.None;

var productNameCol = table.AddDataColumn("ProductName", "ProductName", "Columns", DataType.String);
productNameCol.SummarizeBy = AggregateFunction.None;

var categoryCol = table.AddDataColumn("ProductCategory", "ProductCategory", "Columns", DataType.String);
categoryCol.SummarizeBy = AggregateFunction.None;

var subcategoryCol = table.AddDataColumn("ProductSubcategory", "ProductSubcategory", "Columns", DataType.String);
subcategoryCol.SummarizeBy = AggregateFunction.None;

var unitPriceCol = table.AddDataColumn("UnitPrice", "UnitPrice", "Columns", DataType.Decimal);
unitPriceCol.FormatString = "$#,##0.00";

var standardCostCol = table.AddDataColumn("StandardCost", "StandardCost", "Columns", DataType.Decimal);
standardCostCol.FormatString = "$#,##0.00";

// Set table description
table.Description = "Product dimension table in DirectQuery mode";

Info("Created DirectQuery table: " + tableName +
     "\nMode: DirectQuery" +
     "\nColumns: " + table.Columns.Count +
     "\n\nNOTE: Update the M expression with your actual server and database names.");


// Alternative Option 2: Using legacy SQL partition (if using SQL Server data source)
/*
// First, ensure you have a legacy data source defined
var dataSourceName = "SqlServerDataSource";
if(!Model.DataSources.Contains(dataSourceName))
{
    // You may need to create the data source first
    Error("Data source not found: " + dataSourceName);
}

var dataSource = Model.DataSources[dataSourceName];

// Add partition using legacy SQL syntax
var sqlPartition = table.AddPartition(partitionName, sqlQuery);
sqlPartition.DataSource = dataSource;
sqlPartition.Mode = ModeType.DirectQuery;
*/
