import * as vscode from 'vscode';
import {
  detectDevBrainFolders,
  hasGettingStartedExamples,
  loadTaskCards,
  loadDiaryEntries,
  loadAgentResources,
  migrateToMandalaFolder,
  removeGettingStartedExamples,
  seedGettingStartedExamples,
} from '../lib/workspace';
import {
  loadIntegrationConfig,
  saveIntegrationConfig,
  syncIntegrations,
} from '../lib/integrations';
import { CredentialManager } from '../lib/credentials';
import { FabricThermostat } from '../lib/fabricThermostat';
import type { WebviewMessage, KnownIntegrationFlags, IntegrationSettings, ThemeOverride, FolderCandidates, SaveSecretMessage } from '../shared/types';

export class BrainProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'mandalaDashboard';

  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];
  private _startupStartedAt?: number;

  private _credentialManager: CredentialManager;
  private _thermostat = new FabricThermostat();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _workspaceRoot: vscode.Uri,
    private readonly _secretStorage: vscode.SecretStorage
  ) {
    this._credentialManager = new CredentialManager(this._secretStorage);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
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
        await this._pushTheme();
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
            const adoConfig = vscode.workspace.getConfiguration('mandala');
            this._view?.webview.postMessage({
              command: 'loadSettings',
              settings: {
                known,
                custom: config.custom,
                ado: {
                  orgUrl: adoConfig.get<string>('adoOrgUrl') || '',
                  project: adoConfig.get<string>('adoProject') || '',
                  workItemType: adoConfig.get<string>('adoWorkItemType') || 'Task',
                },
                thermostat: {
                  apiUrl: adoConfig.get<string>('thermostatApiUrl') || '',
                }
              }
            });
            await syncIntegrations(
              this._workspaceRoot,
              known,
              config,
              vscode.workspace.fs
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

          case 'openMarkdownPreview': {
            const previewUri = vscode.Uri.file((message as any).path);
            await vscode.commands.executeCommand('markdown.showPreview', previewUri);
            return;
          }

          case 'openInPanel': {
            const { panelId, title, initialView } = message as any;
            const panel = vscode.window.createWebviewPanel(
              `mandala-${panelId}`,
              title,
              vscode.ViewColumn.One,
              {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')],
              }
            );
            panel.webview.html = buildWebviewHtml(panel.webview, this._extensionUri, getNonce());
            // Once the panel's webview signals ready, tell it which view to show
            if (initialView) {
              panel.webview.onDidReceiveMessage((msg) => {
                if (msg.command === 'ready') {
                  panel.webview.postMessage({ command: 'setView', view: initialView });
                }
              });
            }
            return;
          }

          case 'initWorkspace': {
            const { initDevBrainFolders } = await import('../lib/workspace');
            await initDevBrainFolders(this._workspaceRoot, vscode.workspace.fs, {
              includeExamples: message.withExamples === true,
            });
            
            const initCandidates = await this._detectFolderCandidates();
            this._view?.webview.postMessage({
              command: 'initState',
              initialized: true,
              hasMigratableData: false,
              folderCandidates: initCandidates,
            });

            await this._pushExampleState();
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
            
            const migrateCandidates = await this._detectFolderCandidates();
            this._view?.webview.postMessage({
              command: 'initState',
              initialized: true,
              hasMigratableData: false,
              folderCandidates: migrateCandidates,
            });

            await this._pushExampleState();
            await this._pushData();
            return;
          }

          case 'seedExamples': {
            const count = await seedGettingStartedExamples(this._workspaceRoot, vscode.workspace.fs);
            vscode.window.showInformationMessage(`Mandala added ${count} getting started example files.`);
            await this._pushExampleState();
            await this._pushData();
            return;
          }

          case 'removeExamples': {
            const removed = await removeGettingStartedExamples(this._workspaceRoot, vscode.workspace.fs);
            if (removed > 0) {
              vscode.window.showInformationMessage(`Mandala removed ${removed} getting started example files.`);
            } else {
              vscode.window.showInformationMessage('No Mandala-managed getting started examples were found to remove.');
            }
            await this._pushExampleState();
            await this._pushData();
            return;
          }

          case 'reinitializeWorkspace': {
            const reinitCandidates = await this._detectFolderCandidates();
            this._view?.webview.postMessage({
              command: 'initState',
              initialized: false,
              hasMigratableData: false,
              folderCandidates: reinitCandidates,
            });
            return;
          }

          case 'mapWorkspace': {
            const folderCfg = vscode.workspace.getConfiguration('mandala', this._workspaceRoot);
            const target = vscode.ConfigurationTarget.WorkspaceFolder;
            await Promise.all([
              folderCfg.update('inboxPath', message.inbox, target),
              folderCfg.update('diaryPath', message.diary, target),
              folderCfg.update('sprintsPath', message.sprints, target),
              folderCfg.update('techDebtPath', message.techDebt, target),
              folderCfg.update('agentsPath', message.agents, target),
            ]);
            for (const relPath of [message.inbox, message.diary, message.sprints, message.techDebt, message.agents]) {
              const uri = vscode.Uri.joinPath(this._workspaceRoot, ...relPath.split('/'));
              try {
                await vscode.workspace.fs.stat(uri);
              } catch {
                await vscode.workspace.fs.createDirectory(uri);
              }
            }
            const mapCandidates = await this._detectFolderCandidates();
            this._view?.webview.postMessage({
              command: 'initState',
              initialized: true,
              hasMigratableData: false,
              folderCandidates: mapCandidates,
            });
            await this._pushWorkspacePaths();
            await this._pushExampleState();
            await this._pushData();
            return;
          }

          case 'remapWorkspace': {
            const remapCandidates = await this._detectFolderCandidates();
            this._view?.webview.postMessage({
              command: 'initState',
              initialized: false,
              hasMigratableData: false,
              folderCandidates: remapCandidates,
            });
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

            // Update VS Code workspace settings for ADO
            if (settings.ado) {
              const adoWsConfig = vscode.workspace.getConfiguration('mandala');
              await adoWsConfig.update('adoOrgUrl', settings.ado.orgUrl, vscode.ConfigurationTarget.Workspace);
              await adoWsConfig.update('adoProject', settings.ado.project, vscode.ConfigurationTarget.Workspace);
              await adoWsConfig.update('adoWorkItemType', settings.ado.workItemType, vscode.ConfigurationTarget.Workspace);
            }
            if (settings.thermostat) {
              const wsConfig = vscode.workspace.getConfiguration('mandala');
              await wsConfig.update('thermostatApiUrl', settings.thermostat.apiUrl, vscode.ConfigurationTarget.Workspace);
            }

            // Run sync
            await syncIntegrations(
              this._workspaceRoot,
              settings.known as KnownIntegrationFlags,
              config,
              vscode.workspace.fs
            );
            return;
          }

          case 'saveSecret': {
            const { key, value } = message as SaveSecretMessage;
            await this._credentialManager.storeSecret(key, value);
            vscode.window.showInformationMessage(`Mandala securely stored ${key}.`);
            return;
          }

          case 'updateWorkspacePath': {
            const { path, value } = message;
            const cfg = vscode.workspace.getConfiguration('mandala');
            switch (path) {
              case 'inbox':
                await cfg.update('inboxPath', value, vscode.ConfigurationTarget.Workspace);
                break;
              case 'diary':
                await cfg.update('diaryPath', value, vscode.ConfigurationTarget.Workspace);
                break;
              case 'sprints':
                await cfg.update('sprintsPath', value, vscode.ConfigurationTarget.Workspace);
                break;
              case 'tech-debt':
                await cfg.update('techDebtPath', value, vscode.ConfigurationTarget.Workspace);
                break;
              case 'agents':
                await cfg.update('agentsPath', value, vscode.ConfigurationTarget.Workspace);
                break;
            }
            // Refresh data and confirm stored paths back to webview
            await this._pushWorkspacePaths();
            await this._pushData();
            return;
          }

          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:eatsleepcode-dev.mandala');
            return;

          case 'openGuide': {
            const workspaceGuideUri = vscode.Uri.joinPath(this._workspaceRoot, '__guides', 'agent-guide.html');
            try {
              await vscode.workspace.fs.stat(workspaceGuideUri);
              const doc = await vscode.workspace.openTextDocument(workspaceGuideUri);
              await vscode.window.showTextDocument(doc, { preview: false });
            } catch {
              const guideUri = vscode.Uri.joinPath(this._extensionUri, 'docs', 'USER_GUIDE.md');
              await vscode.commands.executeCommand('markdown.showPreview', guideUri);
            }
            return;
          }

          case 'setThemeOverride': {
            const cfg = vscode.workspace.getConfiguration('mandala');
            await cfg.update('themeOverride', message.override, vscode.ConfigurationTarget.Workspace);
            await this._pushTheme();
            return;
          }

          case 'runSdlcStep': {
            const prompt = message.suggestedSlash.trim();

            const openChatCommands = async (slashPrompt: string): Promise<{ opened: boolean; prefilled: boolean }> => {
              const availableCommands = new Set(await vscode.commands.getCommands(true));
              const attempts: Array<{ id: string; args: unknown[]; prefilled: boolean }> = [
                { id: 'workbench.action.chat.open', args: [{ query: slashPrompt }], prefilled: true },
                { id: 'github.copilot.chat.open', args: [{ query: slashPrompt }], prefilled: true },
                { id: 'workbench.action.quickchat.open', args: [{ query: slashPrompt }], prefilled: true },
                { id: 'github.copilot.chat.open', args: [slashPrompt], prefilled: true },
                { id: 'workbench.action.chat.open', args: [], prefilled: false },
                { id: 'github.copilot.chat.open', args: [], prefilled: false },
              ];

              for (const attempt of attempts) {
                if (!availableCommands.has(attempt.id)) {
                  continue;
                }

                try {
                  await vscode.commands.executeCommand(attempt.id, ...attempt.args);
                  return { opened: true, prefilled: attempt.prefilled };
                } catch {
                  // Try next available chat command signature.
                }
              }

              return { opened: false, prefilled: false };
            };

            const chatResult = await openChatCommands(prompt);
            if (chatResult.opened) {
              if (!chatResult.prefilled) {
                await vscode.env.clipboard.writeText(prompt);
                vscode.window.showInformationMessage(
                  `Opened chat for SDLC ${message.step}. ${prompt} was copied to your clipboard.`
                );
              } else {
                vscode.window.showInformationMessage(`SDLC ${message.step} step opened in chat with ${prompt}`);
              }
              return;
            }

            if (message.fallbackPath) {
              try {
                const doc = await vscode.workspace.openTextDocument(message.fallbackPath);
                await vscode.window.showTextDocument(doc, { preview: false });
                await vscode.env.clipboard.writeText(prompt);
                vscode.window.showInformationMessage(
                  `Opened workflow file for SDLC ${message.step}. ${prompt} was copied to your clipboard.`
                );
                return;
              } catch {
                // Fall through to warning message below.
              }
            }

            await vscode.env.clipboard.writeText(prompt);
            vscode.window.showWarningMessage(
              `Unable to open chat directly. ${prompt} was copied to your clipboard.`
            );
            return;
          }

          case 'thermostatApi': {
            const { reqId, method, args } = message as any;
            try {
              let result;
              const apiUrl = vscode.workspace.getConfiguration('mandala').get<string>('thermostatApiUrl');
              
              if (apiUrl) {
                // Remote Mode
                const session = await vscode.authentication.getSession('microsoft', ['1d73ad44-4a0f-4bf4-9057-b125da568a94/.default'], { createIfNone: true });
                if (!session) throw new Error('Failed to get Entra ID token');

                if (method === 'getConfig') {
                  result = await this._thermostat.getConfigRemote(apiUrl, session.accessToken);
                } else if (method === 'putConfig') {
                  result = await this._thermostat.putConfigRemote(apiUrl, session.accessToken, args.config, args.etag);
                } else if (method === 'getCapacityState') {
                  result = await this._thermostat.getCapacityStateRemote(apiUrl, session.accessToken, args.capacityId);
                } else if (method === 'triggerCapacity') {
                  result = await this._thermostat.triggerCapacityRemote(apiUrl, session.accessToken, args.capacityId, args.action, args.sku);
                } else {
                  throw new Error(`Unknown remote method: ${method}`);
                }
              } else {
                // Local Mode (az CLI)
                if (method === 'getConfig') {
                  result = await this._thermostat.getConfig(this._workspaceRoot.fsPath, (newConfig) => {
                    webview.postMessage({ command: 'thermostatRefresh' });
                  });
                } else if (method === 'putConfig') {
                  result = await this._thermostat.putConfig(this._workspaceRoot.fsPath, args.config);
                } else if (method === 'getCapacityState') {
                  result = await this._thermostat.getCapacityState(this._workspaceRoot.fsPath, args.capacityId);
                } else if (method === 'triggerCapacity') {
                  result = await this._thermostat.triggerCapacity(this._workspaceRoot.fsPath, args.capacityId, args.action, args.sku);
                } else if (method === 'getRbacStatus' || method === 'grantRbac') {
                  // Fallback for stubs
                  result = { hasContributor: true, cliCommand: '' };
                } else {
                  throw new Error(`Unknown local method: ${method}`);
                }
              }
              
              webview.postMessage({ type: 'thermostatApiResult', reqId, result });
            } catch (err: any) {
              webview.postMessage({ type: 'thermostatApiResult', reqId, error: err.message });
            }
            return;
          }
        }
      },
      undefined,
      this._disposables
    );
  }

  private async _sendInitialData(): Promise<void> {
    this._startupStartedAt = Date.now();
    this._emitProgress('Checking workspace state');

    // Run folder detection and legacy checks in parallel
    const [detection, candidates] = await Promise.all([
      detectDevBrainFolders(this._workspaceRoot, vscode.workspace.fs),
      this._detectFolderCandidates(),
    ]);

    let hasMigratableData = false;
    if (!detection.found) {
      const legacyCandidates = [
        vscode.Uri.joinPath(this._workspaceRoot, '.meridian'),
        vscode.Uri.joinPath(this._workspaceRoot, '__inbox', '__todo'),
        vscode.Uri.joinPath(this._workspaceRoot, 'diary'),
      ];
      const legacyResults = await Promise.all(
        legacyCandidates.map(async (uri) => {
          try {
            await vscode.workspace.fs.readDirectory(uri);
            return true;
          } catch {
            return false;
          }
        })
      );
      hasMigratableData = legacyResults.some((res) => res);
    }

    this._view?.webview.postMessage({
      command: 'initState',
      initialized: detection.found,
      hasMigratableData,
      folderCandidates: candidates,
    });

    this._emitProgress('Loading settings and theme');
    
    // Push settings, theme, paths, and examples state in parallel
    await Promise.all([
      this._pushSettings(),
      this._pushTheme(),
      this._pushWorkspacePaths(),
      detection.found ? this._pushExampleState() : Promise.resolve(),
    ]);

    if (detection.found) {
      this._emitProgress('Hydrating dashboard data');
      await this._pushData();
    } else {
      this._emitProgress('Ready for workspace setup');
      this._startupStartedAt = undefined;
    }
  }

  private async _pushWorkspacePaths(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('mandala');
    const inboxPath = cfg.get<string>('inboxPath', '.mandala/inbox');
    const diaryPath = cfg.get<string>('diaryPath', '.mandala/diary');
    const sprintsPath = cfg.get<string>('sprintsPath', '.mandala/sprints');
    const techDebtPath = cfg.get<string>('techDebtPath', '.mandala/tech-debt');
    const agentsPath = cfg.get<string>('agentsPath', '.mandala/agents');

    this._view?.webview.postMessage({
      command: 'workspacePaths',
      inboxPath,
      diaryPath,
      sprintsPath,
      techDebtPath,
      agentsPath,
    });
  }

  private async _detectFolderCandidates(): Promise<FolderCandidates> {
    const cfg = vscode.workspace.getConfiguration('mandala');
    const fs = vscode.workspace.fs;
    const root = this._workspaceRoot;
    const defaults: Record<string, string> = {
      inboxPath: '.mandala/inbox',
      diaryPath: '.mandala/diary',
      sprintsPath: '.mandala/sprints',
      techDebtPath: '.mandala/tech-debt',
      agentsPath: '.mandala/agents',
    };

    const detect = async (configKey: string, legacyCandidates: string[]): Promise<string> => {
      const defaultVal = defaults[configKey];
      const configured = cfg.get<string>(configKey, defaultVal);
      if (configured !== defaultVal) return configured;
      for (const p of legacyCandidates) {
        try {
          await fs.stat(vscode.Uri.joinPath(root, ...p.split('/')));
          return p;
        } catch { /* not found */ }
      }
      return defaultVal;
    };

    const [inbox, diary, sprints, techDebt, agents] = await Promise.all([
      detect('inboxPath', ['__inbox/__todo', '__inbox', 'inbox']),
      detect('diaryPath', ['diary']),
      detect('sprintsPath', ['sprints']),
      detect('techDebtPath', ['tech-debt']),
      detect('agentsPath', ['.agents', 'agents']),
    ]);

    return { inbox, diary, sprints, techDebt, agents };
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
    
    const adoConfig = vscode.workspace.getConfiguration('mandala');
    
    const config = await loadIntegrationConfig(this._workspaceRoot, vscode.workspace.fs);
    const settings: IntegrationSettings = { 
      known, 
      custom: config.custom,
      ado: {
        orgUrl: adoConfig.get<string>('adoOrgUrl') || '',
        project: adoConfig.get<string>('adoProject') || '',
        workItemType: adoConfig.get<string>('adoWorkItemType') || 'Task',
      },
      thermostat: {
        apiUrl: adoConfig.get<string>('thermostatApiUrl') || '',
      }
    };
    this._view?.webview.postMessage({ command: 'loadSettings', settings });
  }

  private async _pushExampleState(): Promise<void> {
    const hasExamples = await hasGettingStartedExamples(this._workspaceRoot, vscode.workspace.fs);
    this._view?.webview.postMessage({
      command: 'loadExampleState',
      hasGettingStartedExamples: hasExamples,
    });
  }

  private async _pushData(): Promise<void> {
    this._emitProgress('Loading cards, diary, and sprints');

    const fs = vscode.workspace.fs;
    const root = this._workspaceRoot;
    const cfg = vscode.workspace.getConfiguration('mandala');

    const inboxPath = cfg.get<string>('inboxPath', '.mandala/inbox').split('/');
    const diaryPath = cfg.get<string>('diaryPath', '.mandala/diary').split('/');
    const techDebtPath = cfg.get<string>('techDebtPath', '.mandala/tech-debt').split('/');
    const sprintsPath = cfg.get<string>('sprintsPath', '.mandala/sprints').split('/');

    const inboxUri = vscode.Uri.joinPath(root, ...inboxPath);
    const diaryUri = vscode.Uri.joinPath(root, ...diaryPath);
    const techDebtUri = vscode.Uri.joinPath(root, ...techDebtPath);
    const sprintsUri = vscode.Uri.joinPath(root, ...sprintsPath);

    const { loadTechDebtCards, loadSprintRecords } = await import('../lib/workspace');

    const [cards, entries, techDebtCards, sprintRecords, workspaceAgentResources] = await Promise.all([
      loadTaskCards(inboxUri, fs),
      loadDiaryEntries(diaryUri, fs),
      loadTechDebtCards(techDebtUri, fs),
      loadSprintRecords(sprintsUri, fs),
      loadAgentResources(this._workspaceRoot, fs),
    ]);

    const extensionAgentResources = await loadAgentResources(this._extensionUri, fs);
    const hasWorkspaceAgentData =
      workspaceAgentResources.workflows.length > 0 ||
      workspaceAgentResources.skills.length > 0 ||
      workspaceAgentResources.tasks.length > 0 ||
      workspaceAgentResources.guides.length > 0 ||
      workspaceAgentResources.registry.length > 0;

    const agentResources = hasWorkspaceAgentData
      ? workspaceAgentResources
      : extensionAgentResources;

    this._emitProgress('Composing views');

    this._view?.webview.postMessage({ command: 'loadStoryMap', cards });
    this._view?.webview.postMessage({ command: 'loadDiary', entries });
    this._view?.webview.postMessage({ command: 'loadTechDebt', cards: techDebtCards });
    this._view?.webview.postMessage({ command: 'loadSprints', records: sprintRecords });
    this._view?.webview.postMessage({ command: 'loadAgentResources', resources: agentResources });
    this._emitProgress('Ready');
    this._startupStartedAt = undefined;
  }

  private _emitProgress(step: string): void {
    const elapsedMs = this._startupStartedAt !== undefined
      ? Date.now() - this._startupStartedAt
      : undefined;

    this._view?.webview.postMessage({ command: 'loadProgress', step, elapsedMs });

    if (elapsedMs !== undefined) {
      console.info(`[Mandala startup] ${step} (${elapsedMs}ms)`);
    }
  }

  private async _pushTheme(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('mandala');
    const override = cfg.get<ThemeOverride>('themeOverride', 'auto');
    this._view?.webview.postMessage({ command: 'loadTheme', override });
  }
}

// ─── Exported pure helpers (also tested directly) ───────────────────────────

export function getNonce(): string {
  const buf = new Uint8Array(16);
  // crypto is available in both Node 15+ and the VS Code extension host
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
               connect-src https:;
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
