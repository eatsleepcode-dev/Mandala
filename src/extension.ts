import * as vscode from "vscode";
import { MetricsPanel } from "./panels/MetricsPanel";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.showPanel", () => {
      MetricsPanel.createOrShow(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.analyzeFile", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active Python file to analyze.");
        return;
      }
      MetricsPanel.createOrShow(context);
      MetricsPanel.analyzeDocument(editor.document);
    })
  );

  const config = vscode.workspace.getConfiguration("meridian");
  if (config.get<boolean>("showOnSave")) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.languageId === "python" && MetricsPanel.isVisible()) {
          MetricsPanel.analyzeDocument(doc);
        }
      })
    );
  }
}

export function deactivate() {}
