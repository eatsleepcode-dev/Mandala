# Mandala

A VS Code extension that brings your project's Dev-Brain — story map, diary, sprint cards, and AI-tool integrations — into a single dashboard panel inside the editor.

## Features

- **Story Map** — Jeff Patton-style activity/sprint grid built from `.mandala/inbox/` task cards
- **Diary** — chronological log of daily entries from `.mandala/diary/`
- **AI integrations** — sync context files to Claude, Copilot, Cursor, and Cline from a single settings panel
- **One-click init** — creates the `.mandala/` workspace structure on first run
- **Migration** — detects and moves legacy `__inbox/`, `diary/`, `.agents/` folders to `.mandala/`

## Requirements

- VS Code 1.90+

## Getting Started

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Mandala: Open Dashboard**

On first run in a new workspace, Mandala will offer to initialise the `.mandala/` folder structure.

## Workspace structure

Mandala stores all data under a `.mandala/` folder at your workspace root:

```
.mandala/
├── inbox/           Sprint task cards (Markdown with YAML frontmatter)
├── diary/           Daily diary entries (Markdown with YAML frontmatter)
└── agents/          AI context files and integration config
    ├── TECH_DEBT.md
    └── SPRINT_REGISTER.md
```

### Task card frontmatter

```yaml
---
id: auth-refresh
title: Token refresh flow
sprint: 3
status: in-progress   # planned | in-progress | complete | blocked
type: feat            # feat | fix | chore | docs | test | tidy
tags: [auth, backend]
points: 3
---
Body text here.
```

### Diary entry frontmatter

```yaml
---
date: 2026-05-10
title: Wired up token refresh
type: feat
branch: feat/auth-refresh
techDebt: false
adr: false
---
Body text here.
```

## Commands

| Command | Description |
|---|---|
| `Mandala: Open Dashboard` | Open (or reveal) the Dev-Brain dashboard panel |
| `Mandala: Initialize Dev-Brain Workspace` | Create `.mandala/` structure in the current workspace |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `mandala.integrations.claude` | `true` | Sync `CLAUDE.md` from `.mandala/agents/` |
| `mandala.integrations.copilot` | `false` | Sync `.github/copilot-instructions.md` |
| `mandala.integrations.cursor` | `false` | Sync `.cursorrules` |
| `mandala.integrations.cline` | `false` | Sync `.clinerules` |
| `mandala.integrations.claudeCommands` | `true` | Symlink `.claude/commands/` to `.mandala/agents/skills/` |

## Development

```bash
npm install --legacy-peer-deps
npm run dev       # webpack watch (extension host + webview)
# Press F5 in VS Code to launch the Extension Development Host
```

### Run tests

```bash
npm test
```

## License

MIT
