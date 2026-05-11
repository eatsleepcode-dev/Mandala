#!/usr/bin/env python3
# ---
# title: _diary_utils
# project:
# stage: Dev Diary
# description: Shared constants, git helpers, LLM client, file writers, and
#              DuckDB deduplication utilities for the dev diary pipeline.
#              Imported by generate_diary.py and retrospective.py.
#              Not intended to be run directly.
# ---
"""
Shared dev-diary utilities.

All functions are pure or side-effect isolated (filesystem writes scoped to
ENTRIES_DIR / SUMMARIES_DIR). Module-level path globals are intentionally
mutable so that tests can monkeypatch them without patching subprocess calls.
"""

import datetime
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Paths (mutable so tests can monkeypatch)
# ---------------------------------------------------------------------------

REPO_ROOT: Path = Path(__file__).resolve().parents[2]
ENTRIES_DIR: Path = REPO_ROOT / "diary" / "entries"
SUMMARIES_DIR: Path = REPO_ROOT / "diary" / "summaries"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WATERMARK_TAG = "diary-sync-point"
MAX_DIFF_CHARS = 8_000
MAX_FILES_IN_DIFF = 10

# Files excluded from diff to avoid token exhaustion
EXCLUDED_PATTERNS = re.compile(
    r"(package-lock\.json|yarn\.lock|Pipfile\.lock|poetry\.lock"
    r"|\.duckdb|\.pbix|\.png|\.jpg|\.jpeg|\.gif|\.ico"
    r"|diary/entries/|diary/summaries/)",
    re.IGNORECASE,
)

# Commit messages to exclude from diary entries.
# Use [skip diary] to suppress a commit explicitly.
# chore(diary): covers auto-commits from generate_diary.py (which also carry [skip ci] for CI purposes).
# NOTE: [skip ci] alone is intentionally NOT excluded — CI skips and diary skips are independent.
SKIP_COMMIT_RE = re.compile(r"\[skip diary\]|chore\(diary\):", re.IGNORECASE)

# Patterns for ADR / TD references in commit messages
ADR_RE = re.compile(r"\bADR[-_]?(\d{3})\b", re.IGNORECASE)
TD_RE = re.compile(r"\bTD[-_]?(\d{3})\b", re.IGNORECASE)

SYSTEM_PROMPT = """\
You are a literal, methodical code-to-text parser. Your task is to read a git diff \
and produce a concise, first-person developer diary entry.

Rules:
1. Do not assume context beyond what the diff shows.
2. Be literal: describe what files were changed and what the code physically does.
3. Do not invent architectural insights, learnings, or opinions.
4. Keep it brief: 3-5 bullet points maximum.
5. If the commit message references an ADR or TD, list it in References \
— do not explain it.
6. Omit a section entirely if there is nothing to report in it.

Output format (Markdown only, no prose wrapper, no headings beyond the section labels):
\u2692\ufe0f **Implementation**
- <bullet>

\U0001f41b **Debugging** (omit if none)
- <bullet>

\U0001f517 **References** (omit if none)
- ADR-045, TD-056
"""

ROLLUP_PROMPT = """\
You are a methodical text summariser. Summarise the following developer diary entries \
into a cohesive retrospective for the period. Be concise (5-8 bullets). \
Do not infer or invent context beyond what is written. \
List any ADR or TD references found as a References section at the end.
"""


# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------


def _run(cmd: list[str], capture: bool = True) -> str:
    """Run a subprocess command in REPO_ROOT; return stdout stripped."""
    result = subprocess.run(cmd, capture_output=capture, text=True, cwd=REPO_ROOT)
    if result.returncode != 0 and capture:
        return ""
    return result.stdout.strip() if capture else ""


def get_current_branch() -> str:
    """Return the current git branch name."""
    return _run(["git", "rev-parse", "--abbrev-ref", "HEAD"]) or "unknown"


def get_commits_since(
    since_hash: Optional[str], author: Optional[str]
) -> list[dict]:
    """Return commit dicts since since_hash (exclusive) up to HEAD, oldest first."""
    rev_range = f"{since_hash}..HEAD" if since_hash else "HEAD"
    fmt = "%H|||%h|||%ad|||%an|||%s|||%b"
    args = [
        "git", "log", rev_range,
        f"--pretty=format:{fmt}",
        "--date=short",
        "--no-merges",
    ]
    if author:
        args += [f"--author={author}"]

    out = _run(args)
    commits = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("|||", 5)
        if len(parts) < 5:
            continue
        full_hash, short_hash, date, author_name, subject, body = (
            parts + [""] * (6 - len(parts))
        )
        message = f"{subject}\n{body}".strip()
        if SKIP_COMMIT_RE.search(message):
            continue
        commits.append(
            {
                "hash": full_hash,
                "short_hash": short_hash,
                "date": date,
                "author": author_name,
                "commit_message": message,
            }
        )
    return list(reversed(commits))  # oldest first


def get_commits_in_range(
    since: str, until: str, author: Optional[str]
) -> list[dict]:
    """Return commit dicts within a date range (ISO8601 dates), oldest first."""
    fmt = "%H|||%h|||%ad|||%an|||%s|||%b"
    args = [
        "git", "log",
        f"--after={since}",
        f"--before={until} 23:59:59",
        f"--pretty=format:{fmt}",
        "--date=short",
        "--no-merges",
    ]
    if author:
        args += [f"--author={author}"]

    out = _run(args)
    commits = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("|||", 5)
        if len(parts) < 5:
            continue
        full_hash, short_hash, date, author_name, subject, body = (
            parts + [""] * (6 - len(parts))
        )
        message = f"{subject}\n{body}".strip()
        if SKIP_COMMIT_RE.search(message):
            continue
        commits.append(
            {
                "hash": full_hash,
                "short_hash": short_hash,
                "date": date,
                "author": author_name,
                "commit_message": message,
            }
        )
    return list(reversed(commits))  # oldest first


def get_diff(commit_hash: str) -> tuple[str, list[str]]:
    """Return (truncated_diff_text, all_files_changed) for a commit."""
    raw = _run(["git", "diff", f"{commit_hash}^!", "--stat", "--name-only"])
    all_files = [
        f for f in raw.splitlines()
        if f and not EXCLUDED_PATTERNS.search(f)
    ]
    files = all_files[:MAX_FILES_IN_DIFF]

    diff_parts: list[str] = []
    total_chars = 0
    for f in files:
        if total_chars >= MAX_DIFF_CHARS:
            break
        file_diff = _run(["git", "diff", f"{commit_hash}^!", "--", f])
        budget = MAX_DIFF_CHARS - total_chars
        diff_parts.append(file_diff[:budget])
        total_chars += len(file_diff)

    return "\n".join(diff_parts), all_files


# ---------------------------------------------------------------------------
# Secret scanner (last-resort gate — runs before every LLM call)
# ---------------------------------------------------------------------------

SECRET_KEYWORDS = ("api_key", "password", "secret", "token=", "private_key")


def check_secrets(diff: str) -> bool:
    """Return True if the diff contains suspicious secret-like patterns.

    This is a fast heuristic fallback. gitleaks (or equivalent) should run
    earlier in the pipeline as the authoritative scanner.  This is the
    last-resort in-process guard that prevents a leaked credential from
    being forwarded to an external LLM endpoint.
    """
    lower = diff.lower()
    return any(kw in lower for kw in SECRET_KEYWORDS)


# ---------------------------------------------------------------------------
# DuckDB deduplication (in-memory — no persistent .duckdb file committed)
# ---------------------------------------------------------------------------


def get_processed_hashes() -> set[str]:
    """Return set of commit hashes already present in ENTRIES_DIR."""
    try:
        import duckdb  # type: ignore

        json_glob = str(ENTRIES_DIR / "*.json")
        if not list(ENTRIES_DIR.glob("*.json")):
            return set()
        con = duckdb.connect(":memory:")
        rows = con.execute(
            f"SELECT record_id FROM read_json_auto('{json_glob}')"
        ).fetchall()
        return {r[0] for r in rows}
    except Exception:
        # Fallback: manual scan (duckdb not installed or glob empty)
        processed: set[str] = set()
        for f in ENTRIES_DIR.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                processed.add(data["record_id"])
            except Exception:
                pass
        return processed


# ---------------------------------------------------------------------------
# LLM client factory
# ---------------------------------------------------------------------------


def _make_llm_client():
    """Return (client, model_name); (None, None) when no credentials present.

    Auth priority:
      1. AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY  (explicit key)
      2. AZURE_OPENAI_ENDPOINT alone                   (DefaultAzureCredential / az login)
      3. OPENAI_API_KEY                                 (OpenAI direct)
    """
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    openai_key = os.getenv("OPENAI_API_KEY")

    try:
        import openai  # type: ignore
    except ImportError:
        return None, None

    if azure_endpoint and azure_key:
        client = openai.AzureOpenAI(
            azure_endpoint=azure_endpoint,
            api_key=azure_key,
            api_version="2024-02-01",
        )
        return client, azure_deployment

    if azure_endpoint:
        # No API key — try DefaultAzureCredential (works after az login)
        try:
            from azure.identity import DefaultAzureCredential, get_bearer_token_provider  # type: ignore
            credential = DefaultAzureCredential()
            token_provider = get_bearer_token_provider(
                credential, "https://cognitiveservices.azure.com/.default"
            )
            client = openai.AzureOpenAI(
                azure_endpoint=azure_endpoint,
                azure_ad_token_provider=token_provider,
                api_version="2024-02-01",
            )
            return client, azure_deployment
        except Exception:
            return None, None

    if openai_key:
        client = openai.OpenAI(api_key=openai_key)
        return client, "gpt-4o"
    return None, None


def generate_entry_llm(
    client, model: str, commit: dict, diff: str, dry_run: bool
) -> str:
    """Call LLM to generate a diary entry for the commit."""
    user_content = (
        f"Commit: {commit['commit_message']}\n\n"
        f"Diff:\n```\n{diff or '(no diff — initial or binary-only commit)'}\n```"
    )
    if dry_run:
        return f"[dry-run] Would generate entry for: {commit['commit_message']}"
    if check_secrets(diff):
        return generate_entry_raw(commit, []) + "\n- ⚠️ Secret pattern detected — LLM call skipped."
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=400,
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()


def generate_entry_raw(commit: dict, files: list[str]) -> str:
    """Fallback: format commit message + file list as a diary entry (no LLM)."""
    lines = ["\u2692\ufe0f **Implementation**", f"- {commit['commit_message']}"]
    if files:
        shown = files[:5]
        file_list = ", ".join(f"`{f}`" for f in shown)
        if len(files) > 5:
            file_list += f" (+{len(files) - 5} more)"
        lines.append(f"- Files: {file_list}")
    return "\n".join(lines)


def generate_rollup_llm(
    client, model: str, entries: list[dict], period: str
) -> str:
    """Generate a rollup summary from existing diary entries."""
    combined = "\n\n---\n\n".join(
        f"## {e['date']} — {e['commit_message']}\n{e['entry']}"
        for e in entries
    )
    user_content = f"Period: {period}\n\nDiary entries to summarise:\n\n{combined}"
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": ROLLUP_PROMPT},
            {"role": "user", "content": user_content},
        ],
        max_tokens=600,
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# File writers
# ---------------------------------------------------------------------------


def _safe_branch_slug(branch: str) -> str:
    """Convert a branch name to a filesystem-safe slug, max 30 chars."""
    return re.sub(r"[^a-zA-Z0-9\-]", "-", branch)[:30]


def write_entry(
    commit: dict,
    entry_text: str,
    files: list[str],
    model: str,
    raw_mode: bool,
) -> Path:
    """Write ENTRIES_DIR/<date>_<branch>_<shorthash>.json and .md; return JSON path."""
    ENTRIES_DIR.mkdir(parents=True, exist_ok=True)

    branch_full = get_current_branch()
    branch_slug = _safe_branch_slug(branch_full)
    base = f"{commit['date']}_{branch_slug}_{commit['short_hash']}"

    adrs = [f"ADR-{m}" for m in ADR_RE.findall(commit["commit_message"])]
    tds = [f"TD-{m}" for m in TD_RE.findall(commit["commit_message"])]

    record = {
        "record_id": commit["hash"],
        "date": commit["date"],
        "branch": branch_full,
        "short_hash": commit["short_hash"],
        "commit_message": commit["commit_message"],
        "files_changed": files,
        "adrs_referenced": adrs,
        "tds_referenced": tds,
        "entry": entry_text,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "llm_model": "raw" if raw_mode else model,
        "raw_mode": raw_mode,
    }

    json_path = ENTRIES_DIR / f"{base}.json"
    json_path.write_text(json.dumps(record, indent=2, ensure_ascii=False))

    md_lines = [
        "---",
        f"date: {commit['date']}",
        f"branch: {branch_full}",
        f"hash: {commit['short_hash']}",
        f"adrs: {adrs}",
        f"tds: {tds}",
        "---",
        "",
        f"# {commit['date']} \u2014 {commit['commit_message']}",
        "",
        entry_text,
        "",
    ]
    (ENTRIES_DIR / f"{base}.md").write_text("\n".join(md_lines))
    return json_path


def write_summary(
    period: str,
    date_from: str,
    date_to: str,
    entries: list[dict],
    summary_text: str,
) -> None:
    """Write SUMMARIES_DIR/<period>_<identifier>.json and .md."""
    SUMMARIES_DIR.mkdir(parents=True, exist_ok=True)
    identifier = date_from if period in ("daily", "monthly") else f"{date_from}_week"
    base = f"{period}_{identifier}"

    record = {
        "record_id": f"summary-{period}-{identifier}",
        "period": period,
        "date_from": date_from,
        "date_to": date_to,
        "source_hashes": [e["record_id"] for e in entries],
        "summary": summary_text,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    (SUMMARIES_DIR / f"{base}.json").write_text(
        json.dumps(record, indent=2, ensure_ascii=False)
    )
    md_content = (
        f"# {period.title()} Summary: {date_from} \u2192 {date_to}\n\n{summary_text}\n"
    )
    (SUMMARIES_DIR / f"{base}.md").write_text(md_content)


# ---------------------------------------------------------------------------
# Rollup helpers
# ---------------------------------------------------------------------------


def load_entries_for_range(date_from: str, date_to: str) -> list[dict]:
    """Load diary entry records within a date range from committed JSON files."""
    entries = []
    for f in ENTRIES_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text())
            if date_from <= data.get("date", "") <= date_to:
                entries.append(data)
        except Exception:
            pass
    return sorted(entries, key=lambda e: e.get("date", ""))


def summary_exists(period: str, identifier: str) -> bool:
    """Return True if a summary file already exists for this period + identifier."""
    return (SUMMARIES_DIR / f"{period}_{identifier}.json").exists()
