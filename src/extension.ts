import * as vscode from 'vscode';
import { BrainProvider } from './panels/BrainProvider';
import { detectDevBrainFolders, migrateToMandalaFolder } from './lib/workspace';

export function activate(context: vscode.ExtensionContext): void {
  const root = getWorkspaceRoot();
  if (root) {
    const provider = new BrainProvider(context.extensionUri, root);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(BrainProvider.viewType, provider)
    );
  }

  // Deprecated aliases so keybindings created under the old "Meridian" name still work
  context.subscriptions.push(
    vscode.commands.registerCommand('meridian.openDashboard', () =>
      vscode.commands.executeCommand('mandala.openDashboard')
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('meridian.initWorkspace', () =>
      vscode.commands.executeCommand('mandala.initWorkspace')
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mandala.openDashboard', async () => {
      if (!root) {
        vscode.window.showWarningMessage('Mandala requires an open workspace folder.');
        return;
      }

      const detection = await detectDevBrainFolders(root, vscode.workspace.fs);

      if (!detection.found) {
        const hasMigratableData = await checkLegacyFolders(root);

        if (hasMigratableData) {
          const choice = await vscode.window.showInformationMessage(
            'Mandala found existing data folders (.meridian/, __inbox/, diary/, or .agents/). Migrate them to .mandala/?',
            'Migrate',
            'Initialize Fresh',
            'Cancel'
          );
          if (choice === 'Migrate') {
            const report = await migrateToMandalaFolder(root, vscode.workspace.fs);
            vscode.window.showInformationMessage(
              `Migrated ${report.moved.length} files to .mandala/`
            );
          } else if (choice === 'Initialize Fresh') {
            const { initDevBrainFolders } = await import('./lib/workspace');
            await initDevBrainFolders(root, vscode.workspace.fs);
          } else {
            return;
          }
        } else {
          const choice = await vscode.window.showInformationMessage(
            'No Mandala workspace found. Initialize .mandala/ now?',
            'Initialize',
            'Cancel'
          );
          if (choice !== 'Initialize') return;
          const { initDevBrainFolders } = await import('./lib/workspace');
          await initDevBrainFolders(root, vscode.workspace.fs);
        }
      }

      vscode.commands.executeCommand(`${BrainProvider.viewType}.focus`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mandala.initWorkspace', async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage('Mandala requires an open workspace folder.');
        return;
      }
      const { initDevBrainFolders } = await import('./lib/workspace');
      await initDevBrainFolders(root, vscode.workspace.fs);
      vscode.window.showInformationMessage('Mandala: .mandala/ workspace initialized.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mandala.seedGettingStartedExamples', async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage('Mandala requires an open workspace folder.');
        return;
      }

      const { seedGettingStartedExamples } = await import('./lib/workspace');
      const count = await seedGettingStartedExamples(root, vscode.workspace.fs);
      vscode.window.showInformationMessage(`Mandala added ${count} getting started example files.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mandala.removeGettingStartedExamples', async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage('Mandala requires an open workspace folder.');
        return;
      }

      const { removeGettingStartedExamples } = await import('./lib/workspace');
      const removed = await removeGettingStartedExamples(root, vscode.workspace.fs);
      const message = removed > 0
        ? `Mandala removed ${removed} getting started example files.`
        : 'No Mandala-managed getting started examples were found to remove.';
      vscode.window.showInformationMessage(message);
    })
  );
}

export function deactivate(): void {}

function getWorkspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

async function checkLegacyFolders(root: vscode.Uri): Promise<boolean> {
  const legacyPaths = [
    vscode.Uri.joinPath(root, '.meridian'),
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
