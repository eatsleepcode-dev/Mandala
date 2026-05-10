# Mandala — Code Guide

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
mandala/
├── src/
│   ├── extension.ts            Activation entry point, command registration
│   ├── panels/
│   │   └── BrainPanel.ts       Webview panel lifecycle + message bridge
│   ├── lib/
│   │   ├── workspace.ts        Folder detection, init, migration, file loading
│   │   ├── integrations.ts     AI-tool context file sync
│   │   └── frontmatter.ts      YAML frontmatter parser
│   ├── webview/                React frontend (compiled by Webpack → dist/webview/)
│   │   ├── index.tsx           ReactDOM.createRoot entry
│   │   ├── vscode.ts           acquireVsCodeApi() singleton
│   │   ├── App.tsx             Root component, view state machine
│   │   ├── webview.css         VS Code CSS variable-aware styles
│   │   └── components/
│   │       ├── Sidebar.tsx
│   │       ├── StoryMapView.tsx
│   │       ├── DiaryView.tsx
│   │       └── SettingsView.tsx
│   ├── shared/
│   │   └── types.ts            Types shared between host and webview
│   └── __mocks__/              Jest mocks (vscode, styles)
├── dist/                       Webpack output (gitignored, loaded by BrainPanel)
│   └── webview/
│       ├── webview.js
│       └── webview.css
├── docs/
├── package.json                Extension manifest + npm scripts
├── webpack.config.js           Builds both extension host and webview bundle
├── tsconfig.json               Extension host compiler options
└── tsconfig.webview.json       Webview compiler options (jsx: react-jsx)
```

## Key files in detail

### `src/extension.ts`

Registers the `mandala.openDashboard` command. On activation it checks for the three Dev-Brain signals (`__inbox`, `diary`, `.agents/TECH_DEBT.md`). If found, delegates to `BrainPanel.render`. If not found, it offers to initialise the workspace structure.

**To add a new command:**
1. Add the command ID to `contributes.commands` in `package.json`
2. Add an `activationEvent` if needed (or use `onStartupFinished` for eager activation)
3. Register with `vscode.commands.registerCommand` and push to `context.subscriptions`

### `src/panels/BrainPanel.ts`

Manages a singleton `WebviewPanel`. Key points:

- `render()` is idempotent — reveals the existing panel if open
- `buildWebviewHtml()` injects a per-render CSP nonce; `script-src` requires the nonce on the `<script>` tag
- `localResourceRoots` is restricted to `dist/webview/` — the webview cannot load files from anywhere else
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

### `src/webview/vscode.ts`

`acquireVsCodeApi()` must be called exactly once per webview lifetime. This module calls it at import time and re-exports the handle. Every component that needs to message the host imports from here rather than calling the global again.

### `src/webview/App.tsx`

Holds all view-level state via a `useReducer` state machine (`loading → setup → ready`). The active sidebar view (`storymap | diary | settings`) is tracked here. Each view is a component rendered conditionally based on `activeView`. To add a new view:

1. Extend the `ViewId` union in `Sidebar.tsx`
2. Add an entry to the `ITEMS` array in `Sidebar.tsx`
3. Add a conditional render branch in `App.tsx`
4. Create the component under `src/webview/components/`

## Message protocol

All messages are plain JSON objects with a `command` string discriminator. Types are defined in `src/shared/types.ts` and imported by both sides.

| Direction | `command` | Additional fields | Handler |
|---|---|---|---|
| webview → host | `ready` | — | Triggers `_sendInitialData()` |
| webview → host | `refresh` | — | Re-pushes cards and diary entries |
| webview → host | `openFile` | `path: string` | Opens file in editor |
| webview → host | `initWorkspace` | — | Runs `initDevBrainFolders` |
| webview → host | `migrateWorkspace` | — | Runs `migrateToMandalaFolder` |
| webview → host | `saveSettings` | `settings: IntegrationSettings` | Persists + syncs integrations |
| host → webview | `initState` | `initialized`, `hasMigratableData` | Sets setup/ready phase |
| host → webview | `loadStoryMap` | `cards: TaskCard[]` | Populates story map |
| host → webview | `loadDiary` | `entries: DiaryEntry[]` | Populates diary list |
| host → webview | `loadSettings` | `settings: IntegrationSettings` | Populates settings view |

Add new message types by extending the discriminated union in `src/shared/types.ts`, the switch in `BrainPanel._setWebviewMessageListener`, and the corresponding `vscode.postMessage()` call in the webview.

## Build pipeline

```
npm run build      webpack --mode production  → dist/extension.js
                                              → dist/webview/webview.js
                                              → dist/webview/webview.css
npm run dev        webpack --mode development --watch
npm run compile    tsc --noEmit   (type-check only, no output)
npm test           jest           (host + webview test projects)
```

Webpack is configured with two entry points: the extension host (`src/extension.ts` → `dist/extension.js`) and the webview (`src/webview/index.tsx` → `dist/webview/webview.js`). `BrainPanel.buildWebviewHtml` references the webview output via `asWebviewUri`.

## Content Security Policy

`BrainPanel` generates a random 32-character nonce on each panel creation and injects it into:
1. The CSP `meta` header: `script-src 'nonce-<value>'`
2. The `<script>` tag: `nonce="<value>"`

This blocks any injected script that doesn't carry the nonce, protecting against XSS via malicious workspace file content rendered in the webview.

**Never use `'unsafe-inline'` for scripts.** Use the nonce pattern or a hash.

## Extending to a TreeView sidebar

To add a VS Code sidebar panel alongside the webview dashboard:

1. Add `contributes.viewsContainers` and `contributes.views` to `package.json`
2. Create `src/providers/SprintTreeProvider.ts` implementing `vscode.TreeDataProvider`
3. Register with `vscode.window.createTreeView` in `extension.ts`

The sidebar and the webview panel can communicate via the same `BrainPanel.currentPanel._panel.webview.postMessage` channel.

## Quality gates

```bash
npm run compile    # TypeScript type-check, must exit 0
npm test           # Jest (86 tests across host + webview projects), must pass
npm run build      # Webpack production build, must exit 0
```
