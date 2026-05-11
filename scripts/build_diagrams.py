"""
Build notebook flow diagrams and write PNGs to src/notebooks/resources/.

Each diagram script in diagrams/nb_<stem>.py must call write_flowchart(g, stem)
at the end instead of g.render().  The runner resolves the output path to
src/notebooks/resources/<stem>/flowchart.png automatically.

Usage:
    python scripts/build_diagrams.py                  # build all diagrams
    python scripts/build_diagrams.py nb_bootstrap     # build one diagram
    python scripts/build_diagrams.py --check          # check graphviz is installed

Requires:
    pip install graphviz
    # graphviz dot binary must also be on PATH:
    winget install graphviz        # Windows
    brew install graphviz          # macOS
    sudo apt-get install graphviz  # Debian/Ubuntu
"""

import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT     = Path(__file__).resolve().parent.parent
DIAGRAMS_DIR  = REPO_ROOT / "diagrams"
RESOURCES_DIR = REPO_ROOT / "src" / "notebooks" / "resources"

FLOWCHART_FILENAME = "flowchart.png"


def output_path(stem: str) -> Path:
    """Return the destination path for a notebook's flowchart PNG."""
    return RESOURCES_DIR / stem / FLOWCHART_FILENAME


def _check_prerequisites() -> bool:
    ok = True
    if shutil.which("dot") is None:
        print(
            "❌  graphviz 'dot' binary not found in PATH.\n"
            "    Windows:  winget install graphviz\n"
            "    macOS:    brew install graphviz\n"
            "    Linux:    sudo apt-get install graphviz\n"
        )
        ok = False
    if importlib.util.find_spec("graphviz") is None:
        print("❌  graphviz Python library not installed.  Run: pip install graphviz")
        ok = False
    return ok


def _discover_scripts(only: str | None = None) -> list[Path]:
    """Return diagram scripts matching diagrams/nb_*.py, optionally filtered by stem."""
    scripts = sorted(DIAGRAMS_DIR.glob("nb_*.py"))
    if only:
        target = only if only.endswith(".py") else f"{only}.py"
        scripts = [s for s in scripts if s.name == target]
        if not scripts:
            print(f"Error: diagram script '{target}' not found in {DIAGRAMS_DIR}", file=sys.stderr)
            sys.exit(1)
    return scripts


def _run_script(script: Path) -> bool:
    """Run a diagram script in a subprocess. Returns True on success."""
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    )
    if result.returncode != 0:
        print(f"    ❌  FAILED\n{result.stderr.strip()}")
        return False
    if result.stdout.strip():
        print(f"    {result.stdout.strip()}")
    return True


def main() -> None:
    args = sys.argv[1:]
    check_only = "--check" in args
    targets    = [a for a in args if not a.startswith("--")]

    if check_only or not _check_prerequisites():
        if check_only and _check_prerequisites():
            print("✓ graphviz is installed and ready.")
        sys.exit(0 if _check_prerequisites() else 1)

    scripts = []
    for t in targets:
        scripts.extend(_discover_scripts(t))
    if not scripts:
        scripts = _discover_scripts()

    if not scripts:
        print(f"No nb_*.py diagram scripts found in {DIAGRAMS_DIR}")
        print("Create diagrams/nb_<notebook_stem>.py for each notebook you want a flowchart for.")
        return

    errors: list[str] = []
    for script in scripts:
        stem = script.stem  # e.g. nb_bootstrap
        dest = output_path(stem)
        print(f"  Building {script.name}  →  {dest.relative_to(REPO_ROOT)}")
        if _run_script(script):
            if dest.exists():
                print(f"    ✓  {dest.relative_to(REPO_ROOT)} ({dest.stat().st_size:,} bytes)")
            else:
                print(f"    ⚠  Script ran but {dest} was not created.")
                print(f"       Make sure your script calls write_flowchart(g, '{stem}') at the end.")
                errors.append(script.name)
        else:
            errors.append(script.name)

    print()
    if errors:
        print(f"❌  {len(errors)} diagram(s) failed: {', '.join(errors)}")
        sys.exit(1)
    else:
        built = [output_path(s.stem) for s in scripts if output_path(s.stem).exists()]
        print(f"✓  {len(built)} flowchart(s) written to src/notebooks/resources/")


if __name__ == "__main__":
    main()
