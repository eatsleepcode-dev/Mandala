import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";

export class MetricsPanel {
  private static _current: MetricsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this._panel = panel;
    this._context = context;

    this._panel.webview.html = this._getHtml();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === "ready") {
          const editor = vscode.window.activeTextEditor;
          if (editor?.document.languageId === "python") {
            MetricsPanel.analyzeDocument(editor.document);
          }
        }
      },
      null,
      this._disposables
    );
  }

  static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.ViewColumn.Beside;

    if (MetricsPanel._current) {
      MetricsPanel._current._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "meridianMetrics",
      "Meridian Metrics",
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, "dist", "webview")),
        ],
      }
    );

    MetricsPanel._current = new MetricsPanel(panel, context);
  }

  static isVisible(): boolean {
    return !!MetricsPanel._current?._panel.visible;
  }

  static analyzeDocument(doc: vscode.TextDocument) {
    if (!MetricsPanel._current) return;

    const config = vscode.workspace.getConfiguration("meridian");
    const python = config.get<string>("pythonPath", "python");

    const script = [
      "import json, sys",
      "from radon.complexity import cc_visit, cc_rank",
      "from radon.metrics import mi_visit, mi_rank",
      "from radon.raw import analyze",
      "src = open(sys.argv[1]).read()",
      "raw = analyze(src)",
      "mi = mi_visit(src, multi=True)",
      "blocks = [{'name': b.name, 'type': b.letter, 'complexity': b.complexity, 'rank': cc_rank(b.complexity), 'lineno': b.lineno} for b in cc_visit(src)]",
      "print(json.dumps({'file': sys.argv[1], 'raw': {'loc': raw.loc, 'sloc': raw.sloc, 'comments': raw.comments, 'blank': raw.blank}, 'maintainability': {'score': round(mi, 1), 'rank': mi_rank(mi)}, 'complexity': blocks}))",
    ].join("; ");

    cp.exec(`${python} -c "${script}" "${doc.fileName}"`, (err, stdout, stderr) => {
      if (err) {
        MetricsPanel._current?._panel.webview.postMessage({
          command: "error",
          text: stderr || err.message,
        });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        MetricsPanel._current?._panel.webview.postMessage({ command: "metrics", data });
      } catch {
        MetricsPanel._current?._panel.webview.postMessage({
          command: "error",
          text: "Failed to parse radon output.",
        });
      }
    });
  }

  private _getHtml(): string {
    const webview = this._panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this._context.extensionPath, "dist", "webview", "webview.js")
      )
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src 'unsafe-inline';" />
  <title>Meridian Metrics</title>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose() {
    MetricsPanel._current = undefined;
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }
}
