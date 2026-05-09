// Type-safe wrapper for the VS Code webview API injected at runtime.
// acquireVsCodeApi() is a global provided by the extension host — call it once.
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

export const vscode = acquireVsCodeApi();
