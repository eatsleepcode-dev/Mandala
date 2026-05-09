const window = {
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  createWebviewPanel: jest.fn(),
  activeTextEditor: undefined as unknown,
};

const workspace = {
  workspaceFolders: undefined as unknown,
  fs: {
    readDirectory: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    createDirectory: jest.fn(),
  },
  getConfiguration: jest.fn().mockReturnValue({
    get: jest.fn(),
  }),
  openTextDocument: jest.fn(),
};

const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path, path })),
  joinPath: jest.fn((...args: { fsPath: string }[]) => ({
    fsPath: args.map((a) => a.fsPath ?? a).join('/'),
  })),
};

const ViewColumn = { One: 1, Two: 2, Three: 3 };

const EventEmitter = jest.fn().mockImplementation(() => ({
  event: jest.fn(),
  fire: jest.fn(),
  dispose: jest.fn(),
}));

export {
  window,
  workspace,
  commands,
  Uri,
  ViewColumn,
  EventEmitter,
};
