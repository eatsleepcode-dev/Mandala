// Analyze Model Dependencies
// Analyzes measure dependencies and finds unused measures

// ============================================================================
// CONFIGURATION
// ============================================================================

var showUnusedMeasures = true;
var showComplexMeasures = true;
var showOrphanMeasures = true;
var complexityThreshold = 5;  // Number of dependencies to be "complex"

// ============================================================================
// ANALYSIS
// ============================================================================

Info("=== MODEL DEPENDENCY ANALYSIS ===\n");

// Overall stats
Info("MODEL STATISTICS:");
Info("  Total Measures: " + Model.AllMeasures.Count());
Info("  Total Columns: " + Model.AllColumns.Count());
Info("  Total Tables: " + Model.Tables.Count);
Info("  Total Relationships: " + Model.Relationships.Count());
Info("");

// Find unused measures
if (showUnusedMeasures) {
    var unused = Model.AllMeasures
        .Where(m => !m.ReferencedBy.Any())
        .Where(m => !m.IsHidden)
        .ToList();

    Info("UNUSED MEASURES (" + unused.Count + "):");
    foreach(var m in unused.Take(10)) {
        Info("  - [" + m.Name + "] in " + m.Table.Name);
    }
    if (unused.Count > 10) {
        Info("  ... and " + (unused.Count - 10) + " more");
    }
    Info("");
}

// Find complex measures
if (showComplexMeasures) {
    var complex = Model.AllMeasures
        .Where(m => m.DependsOn.Count() >= complexityThreshold)
        .OrderByDescending(m => m.DependsOn.Count())
        .ToList();

    Info("COMPLEX MEASURES (>=" + complexityThreshold + " dependencies, " + complex.Count + " total):");
    foreach(var m in complex.Take(10)) {
        var depCount = m.DependsOn.Count();
        var measureDeps = m.DependsOn.OfType<Measure>().Count();
        var columnDeps = m.DependsOn.OfType<Column>().Count();
        var tableDeps = m.DependsOn.OfType<Table>().Count();

        Info("  [" + m.Name + "]");
        Info("    Total: " + depCount + " (M:" + measureDeps + " C:" + columnDeps + " T:" + tableDeps + ")");
    }
    if (complex.Count > 10) {
        Info("  ... and " + (complex.Count - 10) + " more");
    }
    Info("");
}

// Find orphan measures (nothing depends on them, not in perspectives)
if (showOrphanMeasures) {
    var orphans = Model.AllMeasures
        .Where(m => !m.ReferencedBy.Any())
        .Where(m => !m.Name.StartsWith("_"))
        .Where(m => !m.Name.StartsWith("Test"))
        .ToList();

    Info("POTENTIAL ORPHAN MEASURES (" + orphans.Count + "):");
    Info("  (Not referenced, not hidden, not prefixed with _ or Test)");
    foreach(var m in orphans.Take(10)) {
        Info("  - [" + m.Name + "]");
    }
    if (orphans.Count > 10) {
        Info("  ... and " + (orphans.Count - 10) + " more");
    }
    Info("");
}

// Dependency depth analysis
var maxDepth = 0;
Measure deepestMeasure = null;

// Recursive function to calculate dependency depth
Func<Measure, HashSet<Measure>, int> GetDependencyDepth = null;
GetDependencyDepth = (m, visited) => {
    if (visited == null) visited = new HashSet<Measure>();
    if (visited.Contains(m)) return 0;  // Circular reference protection

    visited.Add(m);

    var measureDeps = m.DependsOn.OfType<Measure>();
    if (!measureDeps.Any()) return 0;

    return 1 + measureDeps.Max(dep => GetDependencyDepth(dep, visited));
};

foreach(var m in Model.AllMeasures) {
    var depth = GetDependencyDepth(m, null);
    if (depth > maxDepth) {
        maxDepth = depth;
        deepestMeasure = m;
    }
}

Info("DEPENDENCY DEPTH:");
Info("  Max depth: " + maxDepth);
if (deepestMeasure != null) {
    Info("  Deepest measure: [" + deepestMeasure.Name + "]");
}

Info("\n=== ANALYSIS COMPLETE ===");
