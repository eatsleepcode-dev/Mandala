from radon.complexity import cc_visit, cc_rank
from radon.metrics import mi_visit, mi_rank
from radon.raw import analyze


def complexity(source: str) -> list[dict]:
    """Return cyclomatic complexity results for each block in source."""
    results = []
    for block in cc_visit(source):
        results.append({
            "name": block.name,
            "type": block.letter,
            "complexity": block.complexity,
            "rank": cc_rank(block.complexity),
            "lineno": block.lineno,
        })
    return results


def maintainability(source: str) -> dict:
    """Return maintainability index for source."""
    score = mi_visit(source, multi=True)
    return {"score": score, "rank": mi_rank(score)}


def raw_metrics(source: str) -> dict:
    """Return raw LOC metrics for source."""
    result = analyze(source)
    return {
        "loc": result.loc,
        "sloc": result.sloc,
        "comments": result.comments,
        "blank": result.blank,
    }
