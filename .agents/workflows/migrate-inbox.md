---
title: Migrate Inbox
type: workflow
description: >
  Scans a legacy inbox directory and classifies each markdown file into one of
  four Mandala doc groups: Task Cards, ADRs, Tech Debt entries, or Scratch notes.
  Injects the correct frontmatter for each doc type and moves files to the right
  Mandala folder. Non-classifiable files are archived to a scratch subfolder.
---

# /migrate-inbox

**Usage:** `/migrate-inbox <path-to-inbox>`

**Example:** `/migrate-inbox __inbox` or `/migrate-inbox .mandala/inbox`

---

## Doc Groups & Destination Folders

| Doc Type    | Destination                  | Frontmatter required                                      |
|-------------|------------------------------|-----------------------------------------------------------|
| Task Card   | `.mandala/inbox/`            | `title`, `type: feat\|fix\|chore\|docs\|test\|tidy`, `status: planned\|in-progress\|complete\|blocked`, `sprint: <number>` |
| ADR         | `.mandala/adr/`              | `title`, `type: adr`, `status: proposed\|accepted\|deprecated\|superseded`, `date: YYYY-MM-DD` |
| Tech Debt   | `.mandala/tech-debt/`        | `id: TD-<NNN>`, `title`, `severity: high\|medium\|low`, `status: open`, `added: YYYY-MM-DD` |
| Scratch     | `<inbox>/scratch/`           | No frontmatter — file is archived as-is                   |

---

## Steps

### 1. Discover files

Scan `<path-to-inbox>` recursively for all `.md` files. Skip files already in a `scratch/` subfolder.

```powershell
Get-ChildItem -Path "<path-to-inbox>" -Filter "*.md" -Recurse |
  Where-Object { $_.FullName -notmatch "\\scratch\\" }
```

### 2. Read & classify each file

For each file, read its full content and apply this decision tree:

**a) Already has Mandala frontmatter?**
- If `type: adr` → already an ADR, move to `.mandala/adr/` if not already there.
- If `status` or `sprint` key present → already a Task Card, move to `.mandala/inbox/` if needed.
- If `severity` and `added` keys present → already a Tech Debt entry, move to `.mandala/tech-debt/` if needed.

**b) No frontmatter / unstructured — classify by content:**

Use the following signals:

| Signals in content | Classify as |
|---|---|
| Words: "decision", "ADR", "context", "consequences", "we decided", "architecture" | **ADR** |
| Words: "tech debt", "technical debt", "TODO", "refactor", "workaround", "TD-" | **Tech Debt** |
| Words: "task", "story", "acceptance criteria", "as a user", "bug", "fix", "implement" | **Task Card** |
| Chat logs, handoff notes, code snippets with no clear owner, dated session notes | **Scratch** |

### 3. Inject frontmatter

For **Task Cards**, prepend:
```yaml
---
title: <derive from H1 heading or filename>
type: chore
status: planned
sprint: 0
tags: []
---
```

For **ADRs**, prepend:
```yaml
---
title: <derive from H1 heading or filename>
type: adr
status: proposed
date: <today YYYY-MM-DD>
---
```

For **Tech Debt**, prepend:
```yaml
---
id: TD-<next available number>
title: <derive from H1 heading or filename>
severity: medium
status: open
added: <today YYYY-MM-DD>
tags: []
---
```

> **How to find the next TD number:** Run:
> ```powershell
> Get-ChildItem .mandala/tech-debt -Filter "*.md" |
>   Select-String "^id: TD-(\d+)" |
>   ForEach-Object { [int]$_.Matches[0].Groups[1].Value } |
>   Sort-Object -Descending | Select-Object -First 1
> ```
> Then increment by 1.

### 4. Move files to destination

- Create the destination folder if it does not exist.
- Move (or copy then delete) the file.
- If a file with the same name already exists in the destination, suffix with `-2`, `-3`, etc.

For **Scratch** files:
```powershell
New-Item -ItemType Directory -Force -Path "<inbox>/scratch"
Move-Item "<file>" "<inbox>/scratch/<filename>"
```

### 5. Report

After processing all files, print a summary table:

```
Migration complete for: <path-to-inbox>
┌─────────────────────────┬───────────┬──────────────────────────────┐
│ File                    │ Classified│ Destination                  │
├─────────────────────────┼───────────┼──────────────────────────────┤
│ auth-notes.md           │ Task Card │ .mandala/inbox/              │
│ adr-0012-caching.md     │ ADR       │ .mandala/adr/                │
│ old-debt.md             │ Tech Debt │ .mandala/tech-debt/          │
│ session-log-2026-01.md  │ Scratch   │ __inbox/scratch/             │
└─────────────────────────┴───────────┴──────────────────────────────┘
```

---

## Notes

- **Never delete** the original file without first writing the destination file.
- **Preserve all existing body content** — only prepend frontmatter, never overwrite body.
- If you cannot confidently classify a file, treat it as **Scratch**.
- If the file already has a correct `title` in an H1 heading (`# Title`), use that. Otherwise derive from the filename (strip dashes, underscores, extensions).
