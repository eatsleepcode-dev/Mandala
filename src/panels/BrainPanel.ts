import * as vscode from 'vscode';
import {
  detectDevBrainFolders,
  loadTaskCards,
  loadDiaryEntries,
  migrateToMandalaFolder,
  mandalaPath,
} from '../lib/workspace';
import {
  loadIntegrationConfig,
  saveIntegrationConfig,
  syncIntegrations,
} from '../lib/integrations';
import type { WebviewMessage, KnownIntegrationFlags, IntegrationSettings } from '../shared/types';

export class BrainPanel {
  public static currentPanel: BrainPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _workspaceRoot: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    workspaceRoot: vscode.Uri
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._workspaceRoot = workspaceRoot;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = buildWebviewHtml(
      this._panel.webview,
      extensionUri,
      getNonce()
    );
    this._setWebviewMessageListener(this._panel.webview);
  }

  public static render(extensionUri: vscode.Uri, workspaceRoot: vscode.Uri): void {
    if (BrainPanel.currentPanel) {
      BrainPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'mandalaDashboard',
      'Mandala',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
        retainContextWhenHidden: true,
      }
    );
    BrainPanel.currentPanel = new BrainPanel(panel, extensionUri, workspaceRoot);
  }

  public dispose(): void {
    BrainPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _setWebviewMessageListener(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        // Capture panel reference at handler start to avoid race on dispose
        const panel = BrainPanel.currentPanel;
        if (!panel) return;

        switch (message.command) {
          case 'ready':
            await panel._sendInitialData();
            return;

          case 'refresh':
            await panel._pushData();
            return;

          case 'openFile':
            vscode.workspace
              .openTextDocument(message.path)
              .then((doc) => vscode.window.showTextDocument(doc));
            return;

          case 'initWorkspace': {
            const { initDevBrainFolders } = await import('../lib/workspace');
            await initDevBrainFolders(panel._workspaceRoot, vscode.workspace.fs);
            await panel._pushData();
            return;
          }

          case 'migrateWorkspace': {
            const report = await migrateToMandalaFolder(
              panel._workspaceRoot,
              vscode.workspace.fs
            );
            if (report.skipped.length > 0) {
              vscode.window.showWarningMessage(
                `Migration complete. ${report.moved.length} files moved, ${report.skipped.length} skipped (check permissions).`
              );
            } else {
              vscode.window.showInformationMessage(
                `Migration complete — ${report.moved.length} files moved to .mandala/`
              );
            }
            await panel._pushData();
            return;
          }

          case 'saveSettings': {
            const { settings } = message;
            // Persist custom integrations to .mandala/config.json
            const config = await loadIntegrationConfig(
              panel._workspaceRoot,
              vscode.workspace.fs
            );
            config.custom = settings.custom;
            await saveIntegrationConfig(panel._workspaceRoot, config, vscode.workspace.fs);

            // Update VS Code workspace settings for known flags
            const wsConfig = vscode.workspace.getConfiguration('mandala.integrations');
            for (const [key, value] of Object.entries(settings.known)) {
              await wsConfig.update(key, value, vscode.ConfigurationTarget.Workspace);
            }

            // Run sync
            await syncIntegrations(
              panel._workspaceRoot,
              settings.known as KnownIntegrationFlags,
              config,
              vscode.workspace.fs as any
            );
            return;
          }
        }
      },
      undefined,
      this._disposables
    );
  }

  private async _sendInitialData(): Promise<void> {
    const detection = await detectDevBrainFolders(
      this._workspaceRoot,
      vscode.workspace.fs
    );

    // Check if legacy folders exist for migration prompt
    let hasMigratableData = false;
    if (!detection.found) {
      try {
        await vscode.workspace.fs.readDirectory(
          vscode.Uri.file(`${this._workspaceRoot.fsPath}/__inbox/__todo`)
        );
        hasMigratableData = true;
      } catch {
        try {
          await vscode.workspace.fs.readDirectory(
            vscode.Uri.file(`${this._workspaceRoot.fsPath}/diary`)
          );
          hasMigratableData = true;
        } catch {
          // no legacy data
        }
      }
    }

    this._panel.webview.postMessage({
      command: 'initState',
      initialized: detection.found,
      hasMigratableData,
    });

    // Send current integration settings
    await this._pushSettings();

    if (detection.found) {
      await this._pushData();
    }
  }

  private async _pushSettings(): Promise<void> {
    const wsConfig = vscode.workspace.getConfiguration('mandala.integrations');
    const known: KnownIntegrationFlags = {
      claude: wsConfig.get<boolean>('claude', true),
      copilot: wsConfig.get<boolean>('copilot', false),
      cursor: wsConfig.get<boolean>('cursor', false),
      cline: wsConfig.get<boolean>('cline', false),
      claudeCommands: wsConfig.get<boolean>('claudeCommands', true),
    };
    const config = await loadIntegrationConfig(this._workspaceRoot, vscode.workspace.fs);
    const settings: IntegrationSettings = { known, custom: config.custom };
    this._panel.webview.postMessage({ command: 'loadSettings', settings });
  }

  private async _pushData(): Promise<void> {
    const fs = vscode.workspace.fs;
    const root = this._workspaceRoot;

    const [cards, entries] = await Promise.all([
      loadTaskCards(mandalaPath(root, 'inbox'), fs),
      loadDiaryEntries(mandalaPath(root, 'diary'), fs),
    ]);

    this._panel.webview.postMessage({ command: 'loadStoryMap', cards });
    this._panel.webview.postMessage({ command: 'loadDiary', entries });
  }
}

// ─── Exported pure helpers (also tested directly) ───────────────────────────

export function getNonce(): string {
  const buf = new Uint8Array(16);
  // crypto is available in both Node 15+ and the VS Code extension host
  (globalThis.crypto ?? require('crypto').webcrypto).getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildWebviewHtml(
  webview: Pick<vscode.Webview, 'cspSource' | 'asWebviewUri'>,
  extensionUri: { fsPath: string },
  nonce: string
): string {
  const scriptUri = webview.asWebviewUri({
    fsPath: `${extensionUri.fsPath}/dist/webview/webview.js`,
  } as vscode.Uri);
  const styleUri = webview.asWebviewUri({
    fsPath: `${extensionUri.fsPath}/dist/webview/webview.css`,
  } as vscode.Uri);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src ${webview.cspSource} 'unsafe-inline';
               script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${styleUri}" />
    <title>Mandala</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}
