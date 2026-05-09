# Meridian

A VS Code extension that surfaces Python code quality metrics — cyclomatic complexity, maintainability index, and raw LOC — directly inside your editor via a React-powered side panel.

## Features

- **Metrics panel** — live side panel showing complexity, MI score, and LOC for the active Python file
- **Right-click analysis** — analyse any Python file from the editor context menu
- **Auto-refresh on save** — panel updates every time you save a Python file
- **Colour-coded ranks** — A (green) through F (red) badges at a glance
- **JSON-safe** — all radon output is parsed and rendered in React; no raw HTML injection

## Requirements

- VS Code 1.90+
- Python 3.10+ with `radon` installed:

```bash
pip install radon
```

## Getting Started

1. Install the extension
2. Open a Python file
3. Run **Meridian: Show Metrics Panel** from the Command Palette (`Ctrl+Shift+P`)

Or right-click inside any Python file and choose **Meridian: Analyze Current File**.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `meridian.pythonPath` | `"python"` | Path to the Python executable |
| `meridian.complexityThreshold` | `10` | CC value above which a warning is shown |
| `meridian.showOnSave` | `true` | Auto-refresh panel on file save |

## Development

```bash
npm install
npm run dev       # webpack watch mode
# Press F5 in VS Code to launch the Extension Development Host
```

### Project layout

```
src/
├── extension.ts          # Activation, command registration
├── panels/
│   └── MetricsPanel.ts   # WebviewPanel host, radon subprocess
└── webview/
    ├── index.tsx         # React root
    ├── App.tsx           # State machine (idle / loading / data / error)
    └── components/
        ├── MetricsView.tsx
        ├── EmptyView.tsx
        └── ErrorView.tsx
```

## License

MIT
