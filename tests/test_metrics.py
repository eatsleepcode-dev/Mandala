from meridian.metrics import complexity, maintainability, raw_metrics

SIMPLE = """\
def add(a, b):
    return a + b
"""

BRANCHY = """\
def classify(n):
    if n < 0:
        return "negative"
    elif n == 0:
        return "zero"
    else:
        return "positive"
"""


def test_raw_metrics_loc():
    result = raw_metrics(SIMPLE)
    assert result["sloc"] == 2


def test_maintainability_rank():
    result = maintainability(SIMPLE)
    assert result["rank"] in ("A", "B", "C")


def test_complexity_simple():
    result = complexity(SIMPLE)
    assert len(result) == 1
    assert result[0]["name"] == "add"
    assert result[0]["complexity"] == 1


def test_complexity_branchy():
    result = complexity(BRANCHY)
    assert result[0]["complexity"] > 1
