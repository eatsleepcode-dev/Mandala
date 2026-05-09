# Meridian — User Guide

## What it does

Meridian is a VS Code extension that opens a Dev-Brain dashboard panel
inside your editor. It reads your `__inbox/__todo/` sprint cards, `diary/`
entries, and `.agents/` registers and presents them in two views:

| View | Shows |
|---|---|
| **Strategic** | Jeff Patton Story Map — gaps, sprints, and user activities as a CSS grid |
| **Tactical** | Daily Execution Ledger — today's `__todo/` tasks and diary entries |

## Prerequisites

- VS Code 1.74 or later
- Node.js 18 or later (for building from source)
- A workspace that contains at least one of: `__inbox/`, `diary/`, `.agents/TECH_DEBT.md`

## Installation (development build)

The extension is not yet on the VS Code Marketplace. Install it from source:

```bash
# 1. Navigate to the extension folder
cd __tools/meridian

# 2. Install extension host dependencies
npm install

# 3. Install and build the React webview
cd webview-ui
npm install
npm run build
cd ..

# 4. Compile the extension host
npm run compile
```

Then press **F5** in VS Code (with the `meridian` folder open) to launch
an Extension Development Host window with the extension loaded.

## Opening the dashboard

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type **Meridian: Open Dashboard**
3. Press Enter

If your workspace already contains `__inbox/`, `diary/`, or
`.agents/TECH_DEBT.md`, the dashboard opens immediately.

## First-time setup (new workspace)

If no Dev-Brain folders are detected, you will see:

> **No Dev-Brain folders detected in this workspace. Initialize them now?**

Click **Yes, Initialize Framework**. The extension creates:

```
__inbox/__todo/          Sprint task cards go here
diary/                   Daily diary entries go here
.agents/TECH_DEBT.md     Technical debt register
.agents/SPRINT_REGISTER.md  Sprint register
```

## Using the dashboard

### Switching views

Use the **Tactical (Calendar)** and **Strategic (Story Map)** buttons in the
dashboard header to switch between views.

### Strategic view — Story Map

Shows Jeff Patton-style story map data sourced from `__inbox/__todo/` task
cards. Gaps flow left-to-right as activity columns; sprint rows flow
top-to-bottom. *(Full indexing via DuckDB-WASM — coming in the next release.)*

### Tactical view — Daily Ledger

Shows today's open tasks from `__inbox/__todo/` and the latest diary entry.
*(File-read bridge via VS Code message API — coming in the next release.)*

### Testing the VS Code bridge

The **Test VS Code Bridge** button in the Strategic view sends a test message
from the React webview to the extension host, which responds with a VS Code
information notification. Use this to confirm the communication channel is
working after a fresh build.

## Keyboard shortcuts

No default keybindings are assigned. To add one:

1. Open `File → Preferences → Keyboard Shortcuts`
2. Search for **Meridian: Open Dashboard**
3. Click the `+` icon and assign your preferred chord (e.g. `Ctrl+Shift+B`)

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard opens blank / white | The webview bundle is missing. Run `cd webview-ui && npm run build` then reload VS Code. |
| "Meridian requires an open workspace" | Open a folder (`File → Open Folder`) before running the command. |
| Extension command not found | Ensure you ran `npm run compile` and that `out/extension.js` exists. |
| CSP error in webview DevTools | A stale `index.js` bundle is cached. Run `npm run build:webview` again. |

## Uninstalling

If installed via F5 development mode, simply close the Extension Development
Host window. No files are written outside your workspace.

## Feedback and issues

File issues at the `meridian` repository once it has been extracted to
its own standalone repo.
