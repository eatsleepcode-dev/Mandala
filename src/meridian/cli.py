import argparse
import json
import sys
from pathlib import Path

from meridian._version import __version__
from meridian.metrics import complexity, maintainability, raw_metrics


def _analyze_file(path: Path) -> dict:
    source = path.read_text()
    return {
        "file": str(path),
        "raw": raw_metrics(source),
        "maintainability": maintainability(source),
        "complexity": complexity(source),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="meridian",
        description="Code quality metrics powered by radon",
    )
    parser.add_argument("--version", action="version", version=f"meridian {__version__}")
    parser.add_argument("paths", nargs="+", type=Path, help="Python files or directories to analyse")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")

    args = parser.parse_args(argv)

    files: list[Path] = []
    for p in args.paths:
        if p.is_dir():
            files.extend(p.rglob("*.py"))
        else:
            files.append(p)

    results = [_analyze_file(f) for f in sorted(files)]

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for r in results:
            print(f"\n{r['file']}")
            raw = r["raw"]
            print(f"  LOC: {raw['loc']}  SLOC: {raw['sloc']}  Comments: {raw['comments']}  Blank: {raw['blank']}")
            mi = r["maintainability"]
            print(f"  Maintainability: {mi['score']:.1f} ({mi['rank']})")
            for block in r["complexity"]:
                print(f"  {block['type']} {block['name']} (line {block['lineno']}): CC={block['complexity']} {block['rank']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
