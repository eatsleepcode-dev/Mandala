// Tests for BrainProvider message handling logic extracted into testable helpers.
// BrainProvider itself is hard to unit-test (it wraps vscode.WebviewPanel), so we
// test the pure business-logic functions it delegates to.

import { buildWebviewHtml } from './BrainProvider';
import { type MockUri, asWebview, asUri } from '../test-utils/types';

// ─── buildWebviewHtml ─────────────────────────────────────────────────────────

describe('buildWebviewHtml', () => {
  const fakeWebview = {
    cspSource: 'vscode-resource:',
    asWebviewUri: (uri: MockUri) => `vscode-resource:${uri.fsPath}`,
  };
  const fakeExtUri: MockUri = { fsPath: '/ext' };
  const nonce = 'abc123';

  it('includes the nonce in the CSP meta tag', () => {
    const html = buildWebviewHtml(asWebview(fakeWebview), asUri(fakeExtUri), nonce);
    expect(html).toContain(`'nonce-${nonce}'`);
  });

  it('includes the nonce on the script tag', () => {
    const html = buildWebviewHtml(asWebview(fakeWebview), asUri(fakeExtUri), nonce);
    expect(html).toContain(`nonce="${nonce}"`);
  });

  it('references dist/webview/webview.js', () => {
    const html = buildWebviewHtml(asWebview(fakeWebview), asUri(fakeExtUri), nonce);
    expect(html).toContain('webview.js');
  });

  it('references the stylesheet', () => {
    const html = buildWebviewHtml(asWebview(fakeWebview), asUri(fakeExtUri), nonce);
    expect(html).toContain('webview.css');
  });

  it('contains a #root mount point', () => {
    const html = buildWebviewHtml(asWebview(fakeWebview), asUri(fakeExtUri), nonce);
    expect(html).toContain('id="root"');
  });

  it('does not use unsafe-inline for scripts', () => {
    const html = buildWebviewHtml(asWebview(fakeWebview), asUri(fakeExtUri), nonce);
    // unsafe-inline in script-src would defeat the nonce
    expect(html).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});

// ─── getNonce ────────────────────────────────────────────────────────────────

import { getNonce } from './BrainProvider';

describe('getNonce', () => {
  it('returns a 32-character string', () => {
    expect(getNonce()).toHaveLength(32);
  });

  it('only contains hex characters', () => {
    expect(getNonce()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces different values on successive calls', () => {
    const values = new Set(Array.from({ length: 20 }, getNonce));
    expect(values.size).toBeGreaterThan(1);
  });
});
