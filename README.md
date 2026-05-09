# Meridian

Code quality metrics and analysis for Python projects, powered by [radon](https://radon.readthedocs.io/) with [semver](https://python-semver.readthedocs.io/)-compliant versioning.

## Features

- **Cyclomatic complexity** — per-function/class CC scores with A–F ranking
- **Maintainability index** — MI score and letter grade for each file
- **Raw LOC metrics** — lines of code, source lines, comments, and blank lines
- **CLI + JSON output** — human-readable tables or machine-readable JSON
- **Semantic versioning** — version managed as a first-class `semver.Version` object

## Installation

```bash
pip install meridian
```

For development:

```bash
git clone https://github.com/onetoomanybi/meridian.git
cd meridian
pip install -e ".[dev]"
```

## Usage

### CLI

```bash
# Analyse a single file
meridian path/to/file.py

# Analyse an entire directory
meridian src/

# JSON output (pipe-friendly)
meridian src/ --json

# Show version
meridian --version
```

### Python API

```python
from meridian.metrics import complexity, maintainability, raw_metrics

source = open("mymodule.py").read()

print(raw_metrics(source))
# {'loc': 42, 'sloc': 30, 'comments': 5, 'blank': 7}

print(maintainability(source))
# {'score': 72.3, 'rank': 'A'}

for block in complexity(source):
    print(block)
# {'name': 'my_func', 'type': 'F', 'complexity': 3, 'rank': 'A', 'lineno': 10}
```

### Version

```python
from meridian import VERSION  # semver.Version instance

next_version = VERSION.bump_minor()
print(next_version)  # 0.2.0
```

## Complexity Ranks

| Rank | CC Score | Risk |
|------|----------|------|
| A    | 1–5      | Low  |
| B    | 6–10     | Low  |
| C    | 11–15    | Medium |
| D    | 16–20    | Medium |
| E    | 21–25    | High |
| F    | 26+      | Very high |

## Development

```bash
# Run tests
pytest

# Run tests with coverage
pytest --cov=meridian
```

## License

MIT
