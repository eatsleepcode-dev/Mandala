# Meridian — Code Guide

## Architecture overview

VS Code extensions have a hard process boundary. The extension host runs in Node.js and has full access to the VS Code API and filesystem. The webview is an isolated iframe (Chromium) with no Node.js access.

```
┌─────────────────────────────────────────────────────────┐
│  Extension Host (Node.js)                               │
│                                                         │
│  extension.ts ──► BrainPanel.ts ──► vscode.Webview      │
│       │                │                    │           │
│  workspace detection   │              postMessage()     │
│  command registration  │              onDidReceiveMsg() │
└───────────────────────────────────────────────────────── │
                         │ iframe boundary (serialised JSON)
┌───────────────────────────────────────────────────────── │
│  Webview (Chromium, no Node.js)                         │
│                                                         │
│  main.tsx ──► App.tsx ──► vscode.ts (acquireVsCodeApi)  │
│       │                                                 │
│  React 18 SPA         vscode.postMessage() to host      │
└─────────────────────────────────────────────────────────┘
```

## Directory map

```
meridian/
├── src/                        Extension host (compiled by tsc → out/)
│   ├── extension.ts            Activation entry point
│   └── panels/
│       └── BrainPanel.ts       Webview panel lifecycle + message bridge
├── webview-ui/                 React frontend (compiled by Vite → media/webview/)
│   ├── index.html              Vite dev-server entry (not shipped)
│   ├── vite.config.ts          Build: single-file output, no chunks
│   └── src/
│       ├── main.tsx            ReactDOM.createRoot entry
│       ├── vscode.ts           acquireVsCodeApi() singleton
│       ├── App.tsx             Root component, view state
│       └── App.css             VS Code CSS variable-aware styles
├── media/webview/              Build output (gitignored, loaded by BrainPanel)
│   ├── index.js
│   └── style.css
├── out/                        tsc output (gitignored)
├── .vscode/
│   ├── launch.json             F5 Extension Development Host
│   └── tasks.json              compile + build:webview tasks
├── package.json                Extension manifest + npm scripts
└── tsconfig.json               Extension host compiler options
```

## Key files in detail

### `src/extension.ts`

Registers the `meridian.openDashboard` command. On activation it checks for the three Dev-Brain signals (`__inbox`, `diary`, `.agents/TECH_DEBT.md`). If found, delegates to `BrainPanel.render`. If not found, it offers to initialise the workspace structure.

**To add a new command:**
1. Add the command ID to `contributes.commands` in `package.json`
2. Add an `activationEvent` if needed (or use `onStartupFinished` for eager activation)
3. Register with `vscode.commands.registerCommand` and push to `context.subscriptions`

### `src/panels/BrainPanel.ts`

Manages a singleton `WebviewPanel`. Key points:

- `render()` is idempotent — reveals the existing panel if open
- `_getWebviewContent()` injects a per-render CSP nonce; `script-src` requires the nonce on the `<script>` tag
- `localResourceRoots` is restricted to `media/` — the webview cannot load files from anywhere else
- `_setWebviewMessageListener()` is the command dispatcher for messages arriving from React

**To add a new host→webview message (push data to the UI):**
```typescript
this._panel.webview.postMessage({ command: 'loadData', payload: data });
```

**To handle a new webview→host message (React triggers an action):**
```typescript
case 'openFile':
  vscode.workspace.openTextDocument(message.path).then(doc =>
    vscode.window.showTextDocument(doc));
  return;
```

### `webview-ui/src/vscode.ts`

`acquireVsCodeApi()` must be called exactly once per webview lifetime. This module calls it at import time and re-exports the handle. Every component that needs to message the host imports from here rather than calling the global again.

### `webview-ui/src/App.tsx`

Holds the single piece of view-level state: `activeView`. Each view is a named `<div>` rendered conditionally. To add a third view:

1. Extend the union type: `'tactical' | 'strategic' | 'graph'`
2. Add a toggle button in `dashboard-header`
3. Add a conditional branch in `dashboard-content`
4. Extract into its own component file once it grows beyond ~60 lines

## Message protocol

All messages are plain JSON objects with a `command` string discriminator.

| Direction | `command` | Additional fields | Handler |
|---|---|---|---|
| webview → host | `hello` | `text: string` | `showInformationMessage` |

Add new message types by extending the switch in `BrainPanel._setWebviewMessageListener` and the corresponding `vscode.postMessage()` call in the webview.

Use a shared types file when the protocol grows:

```
src/shared/messages.ts          (imported by both sides via path alias)
```

## Build pipeline

```
npm run compile          tsc -p ./       → out/extension.js (+ map)
npm run build:webview    vite build      → media/webview/index.js
                                         → media/webview/style.css
npm run vscode:prepublish  runs both sequentially
```

Vite is configured with `rollupOptions.output.entryFileNames = 'index.js'` and `assetFileNames = 'style.css'` to produce deterministic filenames that `BrainPanel._getWebviewContent` can reference directly.

## Content Security Policy

`BrainPanel` generates a random 32-character nonce on each panel creation and injects it into:
1. The CSP `meta` header: `script-src 'nonce-<value>'`
2. The `<script>` tag: `nonce="<value>"`

This blocks any injected script that doesn't carry the nonce, protecting against XSS via malicious workspace file content rendered in the webview.

**Never use `'unsafe-inline'` for scripts.** Use the nonce pattern or a hash.

## Adding a data layer (DuckDB-WASM)

The intended next step is indexing `__inbox` JSON into DuckDB-WASM inside the webview:

1. Add `@duckdb/duckdb-wasm` to `webview-ui/package.json`
2. In `BrainPanel._setWebviewMessageListener`, handle `{ command: 'readDir', path }` — use `vscode.workspace.fs.readDirectory` and post back the result (the webview has no filesystem access)
3. In `App.tsx`, on mount send `readDir` for `__inbox/__todo`, receive the file list, post `readFile` for each, feed content into DuckDB-WASM, and query into React state

## Extending to a TreeView sidebar

To add a VS Code sidebar panel alongside the webview dashboard:

1. Add `contributes.viewsContainers` and `contributes.views` to `package.json`
2. Create `src/providers/SprintTreeProvider.ts` implementing `vscode.TreeDataProvider`
3. Register with `vscode.window.createTreeView` in `extension.ts`

The sidebar and the webview panel can communicate via the same `BrainPanel.currentPanel._panel.webview.postMessage` channel.

## Quality gates

```bash
cd __tools/meridian
npm run compile                   # must exit 0
cd webview-ui && npm run build    # must exit 0 and emit media/webview/index.js
```

There are no automated tests yet. Unit-test targets:

- `BrainPanel.getNonce()` — output length 32, alphanumeric only
- `extension.promptForInitialization` — filesystem side-effects, use `memfs` mock
- React components — Vitest + `@testing-library/react`
