#!/usr/bin/env python3
# ---
# title: retrospective.py
# project:
# stage: Dev Diary
# description: Retroactive diary generator for historical commit ranges.
#              Reads git log for a date range, skips already-processed commits,
#              generates entries without moving the watermark tag.
#              Non-destructive: never commits back to the repository.
#              Shared logic lives in _diary_utils.py.
# ---
"""
Dev Diary Retrospective Generator

Generates diary entries for historical commits within a date range.

Key differences from generate_diary.py:
  - Does NOT move the watermark tag
  - Does NOT commit back to the repository
  - Uses --since / --until date range instead of watermark hash
  - Safe to re-run (deduplication via get_processed_hashes)

Usage:
    python scripts/diary/retrospective.py --since YYYY-MM-DD [--until YYYY-MM-DD]
                                          [--author "Name"] [--dry-run] [--raw]
"""

import argparse
import datetime
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from _diary_utils import (  # noqa: E402
    ENTRIES_DIR,
    SUMMARIES_DIR,
    _make_llm_client,
    generate_entry_llm,
    generate_entry_raw,
    get_commits_in_range,
    get_diff,
    get_processed_hashes,
    write_entry,
    REPO_ROOT,
)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv=None) -> argparse.Namespace:
    """Parse CLI args; accepts argv list for testability."""
    p = argparse.ArgumentParser(description="Retroactive dev diary generator")
    p.add_argument("--since", required=True, metavar="YYYY-MM-DD",
                   help="Start date (inclusive)")
    p.add_argument("--until", default=str(datetime.date.today()), metavar="YYYY-MM-DD",
                   help="End date (inclusive, default: today)")
    p.add_argument("--author", metavar="NAME",
                   help="Filter commits by author substring")
    p.add_argument("--dry-run", action="store_true",
                   help="Print plan; write no files")
    p.add_argument("--raw", action="store_true",
                   help="Skip LLM; use raw commit text")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)

    ENTRIES_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARIES_DIR.mkdir(parents=True, exist_ok=True)

    author = args.author or os.getenv("DIARY_AUTHOR")
    commits = get_commits_in_range(args.since, args.until, author)

    if not commits:
        print(f"\u2705 No commits found between {args.since} and {args.until}.")
        return 0

    print(f"\U0001f4dd {len(commits)} commit(s) found ({args.since} \u2192 {args.until}).")

    processed = get_processed_hashes()
    raw_mode = args.raw
    client, model = (None, None) if raw_mode else _make_llm_client()
    if client is None and not raw_mode:
        print("\u26a0\ufe0f  No LLM credentials found \u2014 using raw mode.")
        raw_mode = True

    generated = 0
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
        generated += 1

    print(f"\u2705 Generated {generated} retrospective entr{'y' if generated == 1 else 'ies'} "
          f"({args.since} \u2192 {args.until}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
