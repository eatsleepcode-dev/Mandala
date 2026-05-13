/**
 * file: src/test-utils/types.ts
 * description: Shared typed mocks for VS Code API objects used in unit tests.
 *   Provides MockUri and MockFs types that satisfy the function signatures in
 *   workspace.ts and integrations.ts without requiring the full vscode module.
 * scope: test utilities — not included in the production bundle
 */

/**
 * Minimal URI shape — satisfies all workspace/integrations helpers
 * which only access the `fsPath` property at runtime.
 */
export interface MockUri {
  readonly fsPath: string;
}

/** Convenience factory. */
export const makeUri = (fsPath: string): MockUri => ({ fsPath });

// ─── Mock FileSystem shapes ──────────────────────────────────────────────────

/** Partial mock of `vscode.FileSystem` for read-only operations. */
export interface MockReadFs {
  readDirectory: jest.Mock;
  readFile: jest.Mock;
}

/** Partial mock of `vscode.FileSystem` for write operations. */
export interface MockWriteFs {
  writeFile: jest.Mock;
}

/** Partial mock of `vscode.FileSystem` for deletion. */
export interface MockDeleteFs {
  delete: jest.Mock;
}

/** Full mock of `vscode.FileSystem` (all operations). */
export interface MockFs extends MockReadFs, MockWriteFs, MockDeleteFs {
  createDirectory: jest.Mock;
  symlink: jest.Mock;
  stat: jest.Mock;
}

/** Factory that creates a fully-stubbed `MockFs` with safe defaults. */
export const makeFs = (overrides: Partial<MockFs> = {}): MockFs => ({
  readDirectory: jest.fn().mockRejectedValue(new Error('ENOENT')),
  readFile: jest.fn().mockRejectedValue(new Error('ENOENT')),
  writeFile: jest.fn().mockResolvedValue(undefined),
  createDirectory: jest.fn().mockResolvedValue(undefined),
  symlink: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

// ─── Typed cast helpers ──────────────────────────────────────────────────────
// These perform the structural cast once, keeping test call-sites free of `as any`.

/**
 * Casts a `MockUri` to `vscode.Uri` for passing into production functions.
 * Only the `fsPath` property is accessed at runtime; the cast is safe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asUri = (uri: MockUri): any => uri;

/**
 * Casts a `MockFs` (or partial) to `vscode.FileSystem` for passing into
 * production functions. Only the methods under test are called at runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asFs = (fs: Partial<MockFs>): any => fs;

/**
 * Casts a fake webview to `vscode.Webview` for testing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asWebview = (webview: unknown): any => webview;

