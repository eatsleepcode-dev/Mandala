import * as vscode from 'vscode';
import {
  detectDevBrainFolders,
  loadTaskCards,
  loadDiaryEntries,
  migrateToMandalaFolder,
} from '../lib/workspace';
import {
  loadIntegrationConfig,
  saveIntegrationConfig,
  syncIntegrations,
} from '../lib/integrations';
import type { WebviewMessage, KnownIntegrationFlags, IntegrationSettings } from '../shared/types';

export class BrainProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'mandalaDashboard';

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspaceRoot: vscode.Uri
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')]
    };

    webviewView.webview.html = buildWebviewHtml(
      webviewView.webview,
      this._extensionUri,
      getNonce()
    );

    this._setWebviewMessageListener(webviewView.webview);
    
    // Automatically initialize/refresh data when view becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._sendInitialData();
      }
    }, null, this._disposables);

    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('mandala')) {
        await this._pushSettings();
        // Also trigger sync if integration flags changed
        if (e.affectsConfiguration('mandala.integrations')) {
          const wsConfig = vscode.workspace.getConfiguration('mandala.integrations');
          const known: KnownIntegrationFlags = {
            claude: wsConfig.get('claude', true),
            copilot: wsConfig.get('copilot', false),
            cursor: wsConfig.get('cursor', false),
            cline: wsConfig.get('cline', false),
            claudeCommands: wsConfig.get('claudeCommands', true),
          };
          const config = await loadIntegrationConfig(this._workspaceRoot, vscode.workspace.fs);
          await syncIntegrations(
            this._workspaceRoot,
            known,
            config,
            vscode.workspace.fs as any
          );
        }
      }
    }, null, this._disposables);

    webviewView.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public dispose(): void {
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _setWebviewMessageListener(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        if (!this._view) return;

        switch (message.command) {
          case 'ready':
            await this._sendInitialData();
            return;

          case 'refresh':
            await this._pushData();
            return;

          case 'openFile':
            vscode.workspace
              .openTextDocument(message.path)
              .then((doc) => vscode.window.showTextDocument(doc));
            return;

          case 'initWorkspace': {
            const { initDevBrainFolders } = await import('../lib/workspace');
            await initDevBrainFolders(this._workspaceRoot, vscode.workspace.fs);
            
            this._view?.webview.postMessage({
              command: 'initState',
              initialized: true,
              hasMigratableData: false,
            });
            
            await this._pushData();
            return;
          }

          case 'migrateWorkspace': {
            const report = await migrateToMandalaFolder(
              this._workspaceRoot,
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
            
            this._view?.webview.postMessage({
              command: 'initState',
              initialized: true,
              hasMigratableData: false,
            });
            
            await this._pushData();
            return;
          }

          case 'browsePath': {
            const uris = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: true,
              canSelectMany: false,
              openLabel: 'Select',
              defaultUri: this._workspaceRoot,
            });
            if (uris && uris[0]) {
              let selected = vscode.workspace.asRelativePath(uris[0], false);
              if (message.field === 'source' && selected.startsWith('.mandala/agents/')) {
                selected = selected.slice('.mandala/agents/'.length);
              }
              this._view?.webview.postMessage({
                command: 'pathSelected',
                field: message.field,
                path: selected,
              });
            }
            return;
          }

          case 'saveSettings': {
            const { settings } = message;
            // Persist custom integrations to .mandala/config.json
            const config = await loadIntegrationConfig(
              this._workspaceRoot,
              vscode.workspace.fs
            );
            config.custom = settings.custom;
            await saveIntegrationConfig(this._workspaceRoot, config, vscode.workspace.fs);

            // Update VS Code workspace settings for known flags
            const wsConfig = vscode.workspace.getConfiguration('mandala.integrations');
            for (const [key, value] of Object.entries(settings.known)) {
              await wsConfig.update(key, value, vscode.ConfigurationTarget.Workspace);
            }

            // Run sync
            await syncIntegrations(
              this._workspaceRoot,
              settings.known as KnownIntegrationFlags,
              config,
              vscode.workspace.fs as any
            );
            return;
          }

          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:onetoomanybi.mandala');
            return;

          case 'openGuide': {
            const guideUri = vscode.Uri.joinPath(this._extensionUri, 'docs', 'USER_GUIDE.md');
            vscode.commands.executeCommand('markdown.showPreview', guideUri);
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

    // Check if legacy folders exist for migration prompt (.meridian/ rename or old flat layout)
    let hasMigratableData = false;
    if (!detection.found) {
      const legacyCandidates = [
        vscode.Uri.joinPath(this._workspaceRoot, '.meridian'),
        vscode.Uri.joinPath(this._workspaceRoot, '__inbox', '__todo'),
        vscode.Uri.joinPath(this._workspaceRoot, 'diary'),
      ];
      for (const uri of legacyCandidates) {
        try {
          await vscode.workspace.fs.readDirectory(uri);
          hasMigratableData = true;
          break;
        } catch {
          // not present, try next
        }
      }
    }

    this._view?.webview.postMessage({
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
    const legacyConfig = vscode.workspace.getConfiguration('meridian.integrations');

    // For each key, use the mandala.* value if explicitly set by the user; otherwise
    // fall back to the legacy meridian.* value so settings survive the rename.
    function getWithFallback<T>(key: string, defaultVal: T): T {
      const insp = wsConfig.inspect<T>(key);
      const explicitlySet = insp?.workspaceValue !== undefined || insp?.globalValue !== undefined;
      return explicitlySet ? wsConfig.get<T>(key, defaultVal) : legacyConfig.get<T>(key, defaultVal);
    }

    const known: KnownIntegrationFlags = {
      claude: getWithFallback('claude', true),
      copilot: getWithFallback('copilot', false),
      cursor: getWithFallback('cursor', false),
      cline: getWithFallback('cline', false),
      claudeCommands: getWithFallback('claudeCommands', true),
    };
    const config = await loadIntegrationConfig(this._workspaceRoot, vscode.workspace.fs);
    const settings: IntegrationSettings = { known, custom: config.custom };
    this._view?.webview.postMessage({ command: 'loadSettings', settings });
  }

  private async _pushData(): Promise<void> {
    const fs = vscode.workspace.fs;
    const root = this._workspaceRoot;
    const cfg = vscode.workspace.getConfiguration('mandala');

    const inboxPath = cfg.get<string>('inboxPath', '.mandala/inbox').split('/');
    const diaryPath = cfg.get<string>('diaryPath', '.mandala/diary').split('/');
    const techDebtPath = ['.mandala', 'tech-debt'];
    const sprintsPath = ['.mandala', 'sprints'];

    const inboxUri = vscode.Uri.joinPath(root, ...inboxPath);
    const diaryUri = vscode.Uri.joinPath(root, ...diaryPath);
    const techDebtUri = vscode.Uri.joinPath(root, ...techDebtPath);
    const sprintsUri = vscode.Uri.joinPath(root, ...sprintsPath);

    const { loadTechDebtCards, loadSprintRecords } = await import('../lib/workspace');

    const [cards, entries, techDebtCards, sprintRecords] = await Promise.all([
      loadTaskCards(inboxUri, fs),
      loadDiaryEntries(diaryUri, fs),
      loadTechDebtCards(techDebtUri, fs),
      loadSprintRecords(sprintsUri, fs),
    ]);

    this._view?.webview.postMessage({ command: 'loadStoryMap', cards });
    this._view?.webview.postMessage({ command: 'loadDiary', entries });
    this._view?.webview.postMessage({ command: 'loadTechDebt', cards: techDebtCards });
    this._view?.webview.postMessage({ command: 'loadSprints', records: sprintRecords });
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
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri as vscode.Uri, 'dist', 'webview', 'webview.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri as vscode.Uri, 'dist', 'webview', 'webview.css')
  );

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               font-src ${webview.cspSource};
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
