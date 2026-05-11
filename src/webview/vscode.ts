declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

export const vscode = typeof acquireVsCodeApi !== 'undefined'
  ? acquireVsCodeApi()
  : {
      postMessage: (message: unknown) => { console.log('postMessage mock:', message); },
      getState: () => ({}),
      setState: (state: unknown) => {},
    };
