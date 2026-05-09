import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BrainPanel } from './panels/BrainPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('Meridian is now active.');

    const openDashboardCommand = vscode.commands.registerCommand('meridian.openDashboard', () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Meridian requires an open workspace.');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const hasInbox = fs.existsSync(path.join(rootPath, '__inbox'));
        const hasDiary = fs.existsSync(path.join(rootPath, 'diary'));
        const hasTechDebt = fs.existsSync(path.join(rootPath, '.agents', 'TECH_DEBT.md'));

        if (hasInbox || hasDiary || hasTechDebt) {
            vscode.window.showInformationMessage('Meridian: Dev-Brain detected. Opening dashboard...');
            BrainPanel.render(context.extensionUri, rootPath);
        } else {
            promptForInitialization(rootPath);
        }
    });

    context.subscriptions.push(openDashboardCommand);
}

async function promptForInitialization(rootPath: string) {
    const response = await vscode.window.showWarningMessage(
        'No Dev-Brain folders detected in this workspace. Initialize them now?',
        'Yes, Initialize',
        'Cancel'
    );

    if (response === 'Yes, Initialize') {
        try {
            fs.mkdirSync(path.join(rootPath, '__inbox', '__todo'), { recursive: true });
            fs.mkdirSync(path.join(rootPath, 'diary'), { recursive: true });
            fs.mkdirSync(path.join(rootPath, '.agents'), { recursive: true });
            fs.writeFileSync(path.join(rootPath, '.agents', 'TECH_DEBT.md'), '# Technical Debt Register\n\n');
            fs.writeFileSync(path.join(rootPath, '.agents', 'SPRINT_REGISTER.md'), '# Sprint Register\n\n');

            vscode.window.showInformationMessage('Meridian: workspace initialized.');
            vscode.commands.executeCommand('meridian.openDashboard');
        } catch (error) {
            vscode.window.showErrorMessage(`Meridian: initialization failed — ${error}`);
        }
    }
}

export function deactivate() {}
