// Add Direct Lake Table
// Creates table with EntityPartition for Fabric Lakehouse/Warehouse. Requires workspaceId and resourceId GUIDs
// Use: tableName="FactSales" entityName="FactSales" workspaceId="GUID" resourceId="GUID"
var tableName = "FactSales";
var schemaName = "dbo";  // Schema name in the lakehouse (optional)
var entityName = "FactSales";  // Table name in the lakehouse

// Fabric Lakehouse/Warehouse configuration
// Get these GUIDs from the Fabric portal URL when viewing your lakehouse/warehouse
var workspaceId = "YOUR-WORKSPACE-ID";  // Replace with actual workspace GUID
var resourceId = "YOUR-LAKEHOUSE-ID";   // Replace with actual lakehouse/warehouse GUID

// Create or get the shared expression for Direct Lake connection
var sharedExpressionName = "DatabaseQuery";
var sharedExpression = Model.Expressions.Contains(sharedExpressionName)
    ? Model.Expressions[sharedExpressionName]
    : Model.AddExpression(sharedExpressionName);

// Set the M expression for Direct Lake using AzureStorage.DataLake connector
sharedExpression.Kind = ExpressionKind.M;
sharedExpression.Expression = string.Format(@"
let
    database = AzureStorage.DataLake(
        ""https://onelake.dfs.fabric.microsoft.com/{0}/{1}.Lakehouse/Tables""
    )
in
    database
", workspaceId, resourceId);

// Create the table
var table = Model.AddTable(tableName);

// Add Entity Partition for Direct Lake
var partition = table.AddEntityPartition();
partition.Name = tableName;
partition.EntityName = entityName;
partition.ExpressionSource = sharedExpression;
partition.SchemaName = schemaName;
partition.Mode = ModeType.DirectLake;

// Remove any automatically created partitions
foreach(var p in table.Partitions.ToList())
{
    if(p != partition) p.Delete();
}

// Note: Columns are not automatically created for Direct Lake tables
// You need to either:
// 1. Refresh the partition to discover columns, OR
// 2. Manually add columns with AddDataColumn()

Info("Created Direct Lake table: " + tableName +
     "\nConnected to: " + entityName +
     "\nWorkspace: " + workspaceId +
     "\n\nNOTE: Refresh the table to discover columns from the lakehouse.");
