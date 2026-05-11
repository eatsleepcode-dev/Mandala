# Evaluate DAX - Execute DAX queries from C# scripts

## EvaluateDax() API

- **Scalar**: Returns simple values (Int64, String, Double, DateTime)
- **Table**: Returns DataTable-like object with `.Rows` and `.Columns`
- Must use `dynamic result = EvaluateDax(query)` to access .Rows/.Columns

## Patterns

```csharp
// Scalar
var count = EvaluateDax("1 + 1");  // Returns: 2

// Table query
dynamic result = EvaluateDax("TOPN(10, VALUES('Sales'[Product]))");
var rowCount = result.Rows.Count;
var firstValue = result.Rows[0][0];
var columnName = result.Columns[0].ColumnName;

// From .dax file
var dax = File.ReadAllText("query.dax");
dynamic result = EvaluateDax(dax);
```

## INFO Functions (TE2)

### COLUMNSTATISTICS()
Returns column statistics (one row per column):
- `[Table Name]`, `[Column Name]`, `[Min]`, `[Max]`, `[Cardinality]`, `[Max Length]`

### INFO.STORAGETABLECOLUMNS()
Returns storage details:
- `[DIMENSION_NAME]` - Table
- `[ATTRIBUTE_NAME]` - Column
- `[DICTIONARY_SIZE]` - Size in bytes

## Examples

- `execute-scalar-dax.csx` - Scalar expressions (arithmetic, text, dates)
- `execute-table-query.csx` - Table queries with .Rows/.Columns
- `execute-dax-from-file.csx` - Read and execute .dax files
- `get-table-column-sizes.csx` - COLUMNSTATISTICS + INFO.STORAGETABLECOLUMNS
- `optimize-model-size.csx` - Find high-cardinality columns
