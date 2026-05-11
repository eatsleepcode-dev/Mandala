# KPIs Should Not Be Used

**IMPORTANT:** KPIs in Power BI and Analysis Services tabular models should generally be avoided for the following reasons:

## Why Not to Use KPIs

1. **Limited Client Support**
   - KPIs are poorly supported in modern Power BI
   - Most Power BI visuals don't recognize or use KPI metadata
   - Better alternatives exist for displaying targets, status, and trends

2. **Inflexible Visualization**
   - KPI status graphics are limited to predefined icon sets
   - Cannot customize appearance or behavior beyond basic settings
   - Restrictive compared to modern Power BI visuals

3. **Maintenance Overhead**
   - Adds complexity to the model without significant benefit
   - Requires maintaining separate KPI metadata alongside measures
   - Harder to version control and document

4. **Better Alternatives Available**
   - **Separate measures**: Create individual measures for Value, Target, Status, Trend
   - **Calculation groups**: More flexible for time intelligence patterns
   - **DAX measures with conditional formatting**: Better control over visuals
   - **Power BI KPI visual**: Use the KPI visual with regular measures instead

## When KPIs Might Be Acceptable

- Legacy models connecting to Excel (Excel PivotTables recognize KPIs)
- Specific Analysis Services multidimensional requirements
- Client tools that specifically consume KPI metadata

## Recommended Approach Instead

```dax
// Create separate measures instead of KPIs
Sales Actual = SUM(Sales[Amount])

Sales Target = [Sales Actual] * 1.1

Sales Status =
VAR Variance = DIVIDE([Sales Actual], [Sales Target], 0) - 1
RETURN
    SWITCH(
        TRUE(),
        Variance >= 0.05, 2,    // Excellent
        Variance >= 0, 1,       // Good
        Variance >= -0.05, 0,   // Neutral
        Variance >= -0.1, -1,   // Poor
        -2                      // Critical
    )

Sales Trend =
VAR CurrentPeriod = [Sales Actual]
VAR PriorPeriod = CALCULATE([Sales Actual], DATEADD('Date'[Date], -1, YEAR))
RETURN
    DIVIDE(CurrentPeriod - PriorPeriod, PriorPeriod, 0)
```

Then use these separate measures with Power BI's KPI visual or conditional formatting.

---

**The scripts in this directory are provided for completeness and educational purposes, but using KPIs is not recommended for modern Power BI development.**
