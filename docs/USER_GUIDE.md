# Mandala — User Guide

## What it does

Mandala is a VS Code extension that opens a Dev-Brain dashboard panel inside your editor. It reads your `.mandala/inbox/` sprint task cards and `.mandala/diary/` entries and presents them in three views:

| View | Shows |
|---|---|
| **Story Map** | Jeff Patton-style grid — user activities as columns, sprints as rows |
| **Diary** | Chronological log of daily entries with metadata (branch, type, tech-debt flag) |
| **Settings** | AI tool integration toggles and custom context file mappings |

## Prerequisites

- VS Code 1.90 or later
- Node.js 18 or later (for building from source)

## Installation (development build)

The extension is not yet on the VS Code Marketplace. Install it from source:

```bash
# 1. Navigate to the extension folder
cd mandala

# 2. Install all dependencies (extension host + webview)
npm install --legacy-peer-deps

# 3. Build the extension
npm run build
```

Then press **F5** in VS Code (with the `mandala` folder open) to launch an Extension Development Host window with the extension loaded.

## Opening the dashboard

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type **Mandala: Open Dashboard**
3. Press Enter

## First-time setup (new workspace)

If no `.mandala/` folder is detected, you will be prompted:

> **No Mandala workspace found. Initialize .mandala/ now?**

Click **Initialize**. The extension creates:

```
.mandala/
├── inbox/                   Sprint task cards go here
├── diary/                   Daily diary entries go here
└── agents/
    ├── TECH_DEBT.md         Technical debt register
    └── SPRINT_REGISTER.md   Sprint register
```

## Migrating from the legacy layout

If your workspace has the old `__inbox/__todo/`, `diary/`, or `.agents/` folders, Mandala will detect them and offer to migrate:

> **Mandala found existing \_\_inbox/, diary/, or .agents/ folders. Migrate them to .mandala/?**

Choose **Migrate** to move all files into the new `.mandala/` structure, or **Initialize Fresh** to start clean.

## Using the dashboard

### Story Map view

Displays task cards from `.mandala/inbox/` as a Jeff Patton story map. Cards are grouped by activity (column) and sprint (row). Click any card to open the source Markdown file.

Task cards are Markdown files with YAML frontmatter:

```yaml
---
id: auth-refresh
title: Token refresh flow
sprint: 3
status: in-progress   # planned | in-progress | complete | blocked
type: feat
tags: [auth, backend]
points: 3
---
```

### Diary view

Displays entries from `.mandala/diary/` in reverse chronological order. Select an entry in the left-hand list to read it. Click the branch chip to open the file.

Diary entries are Markdown files with YAML frontmatter:

```yaml
---
date: 2026-05-10
title: Wired up token refresh
type: feat
branch: feat/auth-refresh
techDebt: false
adr: false
---
```

### Settings view

Configure which AI tool context files Mandala syncs:

| Toggle | Syncs |
|---|---|
| Claude | `CLAUDE.md` at workspace root |
| Copilot | `.github/copilot-instructions.md` |
| Cursor | `.cursorrules` |
| Cline | `.clinerules` |
| Claude Commands | `.claude/commands/` → `.mandala/agents/skills/` |

You can also add custom integrations — mapping any file under `.mandala/agents/` to any target path in your workspace.

## Keyboard shortcuts

No default keybindings are assigned. To add one:

1. Open `File → Preferences → Keyboard Shortcuts`
2. Search for **Mandala: Open Dashboard**
3. Click the `+` icon and assign your preferred chord (e.g. `Ctrl+Shift+B`)

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard opens blank | The webview bundle is missing. Run `npm run build` then reload VS Code. |
| "Mandala requires an open workspace" | Open a folder (`File → Open Folder`) before running the command. |
| Extension command not found | Ensure you ran `npm run build` and that `dist/extension.js` exists. |

## Feedback and issues

File issues at the [Mandala repository](https://github.com/eatsleepcode-dev/Mandala).
