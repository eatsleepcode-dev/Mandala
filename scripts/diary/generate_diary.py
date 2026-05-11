#!/usr/bin/env python3
# ---
# title: generate_diary.py
# project:
# stage: Dev Diary
# description: Automated commit-to-diary generator. Reads commits since the
#              'diary-sync-point' git tag watermark, calls an LLM to produce
#              structured diary entries, writes atomic JSON+MD files to
#              diary/entries/, generates cascading daily/weekly/monthly rollup
#              summaries, and moves the watermark tag forward.
#              Shared logic lives in _diary_utils.py.
# ---
"""
Dev Diary Generator — watermark orchestration layer.

Reads commits since 'diary-sync-point', delegates entry generation and file
I/O to _diary_utils, triggers cascading rollups, and optionally commits back
to the repository (CI mode). Shared logic lives in _diary_utils.py.

Usage:
    python scripts/diary/generate_diary.py [options]

Environment variables:
    AZURE_OPENAI_ENDPOINT     Azure OpenAI endpoint (preferred)
    AZURE_OPENAI_API_KEY      Azure OpenAI API key
    AZURE_OPENAI_DEPLOYMENT   Model deployment (default: gpt-4o)
    OPENAI_API_KEY            OpenAI API key (fallback)
    DIARY_AUTHOR              Filter commits by author substring (optional)
    DIARY_COMMIT_BACK         Set 'true' to auto-commit generated files (CI)
"""

import argparse
import datetime
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Ensure scripts/diary is on sys.path so _diary_utils is importable when
# running as `python scripts/diary/generate_diary.py` from the repo root.
sys.path.insert(0, str(Path(__file__).parent))

from _diary_utils import (  # noqa: E402
    ENTRIES_DIR,
    SUMMARIES_DIR,
    WATERMARK_TAG,
    _run,
    _make_llm_client,
    generate_entry_llm,
    generate_entry_raw,
    generate_rollup_llm,
    get_commits_since,
    get_diff,
    get_processed_hashes,
    load_entries_for_range,
    summary_exists,
    write_entry,
    write_summary,
    REPO_ROOT,
)


# ---------------------------------------------------------------------------
# Watermark helpers (generate_diary-specific — not used by retrospective)
# ---------------------------------------------------------------------------


def get_watermark_hash() -> Optional[str]:
    """Return the commit hash for diary-sync-point, or None if tag missing."""
    out = _run(["git", "rev-parse", "--verify", f"refs/tags/{WATERMARK_TAG}"])
    return out or None


def move_watermark(commit_hash: str) -> None:
    """Force-move diary-sync-point tag to commit_hash and push."""
    _run(["git", "tag", "-f", WATERMARK_TAG, commit_hash])
    subprocess.run(
        ["git", "push", "-f", "origin", WATERMARK_TAG],
        capture_output=True,
        cwd=REPO_ROOT,
    )


# ---------------------------------------------------------------------------
# Cascading rollup orchestration
# ---------------------------------------------------------------------------


def trigger_rollups(
    today: datetime.date, client, model: str, dry_run: bool
) -> None:
    """Check date boundaries and generate cascading daily/weekly/monthly summaries."""
    yesterday = today - datetime.timedelta(days=1)
    yesterday_str = yesterday.isoformat()

    if not summary_exists("daily", yesterday_str) and not dry_run:
        entries = load_entries_for_range(yesterday_str, yesterday_str)
        if entries and client:
            text = generate_rollup_llm(client, model, entries, f"daily: {yesterday_str}")
        elif entries:
            text = "\n".join(f"- {e['commit_message']}" for e in entries)
        else:
            text = "No commits recorded."
        write_summary("daily", yesterday_str, yesterday_str, entries, text)
        print(f"  \U0001f4c5 Daily rollup: {yesterday_str}")

    if today.weekday() == 0:  # Monday → previous week
        prev_monday = (today - datetime.timedelta(days=7)).isoformat()
        prev_sunday = (today - datetime.timedelta(days=1)).isoformat()
        week_id = f"{prev_monday}_week"
        if not summary_exists("weekly", week_id) and not dry_run:
            entries = load_entries_for_range(prev_monday, prev_sunday)
            if entries and client:
                text = generate_rollup_llm(
                    client, model, entries, f"weekly: {prev_monday} to {prev_sunday}"
                )
            elif entries:
                text = "\n".join(f"- {e['date']}: {e['commit_message']}" for e in entries)
            else:
                text = "No commits recorded this week."
            write_summary("weekly", prev_monday, prev_sunday, entries, text)
            print(f"  \U0001f4c6 Weekly rollup: {prev_monday} \u2192 {prev_sunday}")

    if today.day == 1:  # 1st of month → previous month
        first_of_prev = (today.replace(day=1) - datetime.timedelta(days=1)).replace(day=1)
        last_of_prev = today - datetime.timedelta(days=1)
        month_id = first_of_prev.strftime("%Y-%m")
        if not summary_exists("monthly", month_id) and not dry_run:
            entries = load_entries_for_range(
                first_of_prev.isoformat(), last_of_prev.isoformat()
            )
            if entries and client:
                text = generate_rollup_llm(
                    client, model, entries,
                    f"monthly: {first_of_prev.isoformat()} to {last_of_prev.isoformat()}",
                )
            elif entries:
                text = "\n".join(f"- {e['date']}: {e['commit_message']}" for e in entries)
            else:
                text = "No commits recorded this month."
            write_summary(
                "monthly", first_of_prev.isoformat(), last_of_prev.isoformat(), entries, text
            )
            print(f"  \U0001f5d3\ufe0f Monthly rollup: {month_id}")


# ---------------------------------------------------------------------------
# CI commit-back
# ---------------------------------------------------------------------------


def commit_and_push(new_head: str) -> None:
    """Stage diary files, commit with [skip ci], move watermark, push."""
    _run(["git", "config", "user.email", "diary-bot@bfl.internal"])
    _run(["git", "config", "user.name", "Diary Bot"])
    _run(["git", "add", "diary/"])

    diff = _run(["git", "diff", "--cached", "--name-only"])
    if not diff:
        print("  \u2139\ufe0f  No diary changes to commit.")
        return

    _run(["git", "commit", "-m", "chore(diary): update dev logs [skip ci]"])
    move_watermark(new_head)
    print(f"  \u2705 Diary committed. Watermark moved to {new_head[:7]}.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv=None) -> argparse.Namespace:
    """Parse CLI args; accepts argv list for testability."""
    p = argparse.ArgumentParser(description="Dev diary generator")
    p.add_argument("--dry-run", action="store_true", help="Print plan; write no files")
    p.add_argument("--raw", action="store_true", help="Skip LLM; use raw commit text")
    p.add_argument("--since", metavar="HASH", help="Override watermark start hash")
    p.add_argument("--author", metavar="NAME", help="Filter by author substring")
    return p.parse_args(argv)


def main() -> int:
    args = parse_args()

    ENTRIES_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARIES_DIR.mkdir(parents=True, exist_ok=True)

    since_hash = args.since or get_watermark_hash()
    if since_hash:
        print(f"\U0001f4cc Watermark: {since_hash[:7] if len(since_hash) > 7 else since_hash}")
    else:
        print("\U0001f4cc No watermark tag found — reading last 30 days of commits.")
        cutoff = (datetime.date.today() - datetime.timedelta(days=30)).isoformat()
        since_hash = _run(["git", "log", f"--since={cutoff}", "--pretty=format:%H", "-1"])

    author = args.author or os.getenv("DIARY_AUTHOR") or os.getenv("GIT_AUTHOR_NAME")

    commits = get_commits_since(since_hash, author)
    if not commits:
        print("\u2705 No new commits since watermark.")
        return 0

    print(f"\U0001f4dd {len(commits)} commit(s) to process.")

    processed = get_processed_hashes()

    raw_mode = args.raw
    client, model = (None, None) if raw_mode else _make_llm_client()
    if client is None and not raw_mode:
        print("\u26a0\ufe0f  No LLM credentials found — using raw mode.")
        raw_mode = True

    today = datetime.date.today()
    head_hash = commits[-1]["hash"]

    for commit in commits:
        if commit["hash"] in processed:
            print(f"  \u23ed  Skip (already processed): {commit['short_hash']} "
                  f"{commit['commit_message'][:50]}")
            continue

        print(f"  \u270d\ufe0f  {commit['short_hash']} {commit['commit_message'][:60]}")

        diff, files = get_diff(commit["hash"])

        entry_text = (
            generate_entry_llm(client, model, commit, diff, args.dry_run)
            if (not raw_mode and client)
            else generate_entry_raw(commit, files)
        )

        if not args.dry_run:
            write_entry(commit, entry_text, files, model or "raw", raw_mode)

    if not args.dry_run:
        trigger_rollups(
            today, client if not raw_mode else None, model or "raw", args.dry_run
        )

    if not args.dry_run and os.getenv("DIARY_COMMIT_BACK", "").lower() == "true":
        commit_and_push(head_hash)

    print("\u2705 Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
