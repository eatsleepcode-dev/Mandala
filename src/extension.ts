import * as vscode from 'vscode';
import { BrainPanel } from './panels/BrainPanel';
import { detectDevBrainFolders, migrateToMeridianFolder } from './lib/workspace';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('meridian.openDashboard', async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage('Meridian requires an open workspace folder.');
        return;
      }

      const detection = await detectDevBrainFolders(root, vscode.workspace.fs);

      if (!detection.found) {
        const hasMigratableData = await checkLegacyFolders(root);

        if (hasMigratableData) {
          const choice = await vscode.window.showInformationMessage(
            'Meridian found existing __inbox/, diary/, or .agents/ folders. Migrate them to .meridian/?',
            'Migrate',
            'Initialize Fresh',
            'Cancel'
          );
          if (choice === 'Migrate') {
            const report = await migrateToMeridianFolder(root, vscode.workspace.fs);
            vscode.window.showInformationMessage(
              `Migrated ${report.moved.length} files to .meridian/`
            );
          } else if (choice === 'Initialize Fresh') {
            const { initDevBrainFolders } = await import('./lib/workspace');
            await initDevBrainFolders(root, vscode.workspace.fs);
          } else {
            return;
          }
        } else {
          const choice = await vscode.window.showInformationMessage(
            'No Meridian workspace found. Initialize .meridian/ now?',
            'Initialize',
            'Cancel'
          );
          if (choice !== 'Initialize') return;
          const { initDevBrainFolders } = await import('./lib/workspace');
          await initDevBrainFolders(root, vscode.workspace.fs);
        }
      }

      BrainPanel.render(context.extensionUri, root);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('meridian.initWorkspace', async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage('Meridian requires an open workspace folder.');
        return;
      }
      const { initDevBrainFolders } = await import('./lib/workspace');
      await initDevBrainFolders(root, vscode.workspace.fs);
      vscode.window.showInformationMessage('Meridian: .meridian/ workspace initialized.');
    })
  );
}

export function deactivate(): void {}

function getWorkspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

async function checkLegacyFolders(root: vscode.Uri): Promise<boolean> {
  const legacyPaths = [
    vscode.Uri.joinPath(root, '__inbox', '__todo'),
    vscode.Uri.joinPath(root, 'diary'),
    vscode.Uri.joinPath(root, '.agents'),
  ];
  for (const uri of legacyPaths) {
    try {
      await vscode.workspace.fs.readDirectory(uri);
      return true;
    } catch {
      // not present
    }
  }
  return false;
}
