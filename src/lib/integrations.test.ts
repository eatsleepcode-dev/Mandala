import * as path from 'path';
import {
  KNOWN_INTEGRATIONS,
  syncIntegrations,
  loadIntegrationConfig,
  saveIntegrationConfig,
  type IntegrationConfig,
  type CustomIntegration,
} from './integrations';

const root = { fsPath: '/workspace' };
const enc = new TextEncoder();

// ─── KNOWN_INTEGRATIONS shape ────────────────────────────────────────────────

describe('KNOWN_INTEGRATIONS', () => {
  it('includes claude, copilot, cursor, cline, claudeCommands', () => {
    const ids = KNOWN_INTEGRATIONS.map((i) => i.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('copilot');
    expect(ids).toContain('cursor');
    expect(ids).toContain('cline');
    expect(ids).toContain('claudeCommands');
  });

  it('each integration has id, label, source and target', () => {
    for (const integ of KNOWN_INTEGRATIONS) {
      expect(typeof integ.id).toBe('string');
      expect(typeof integ.label).toBe('string');
      expect(typeof integ.source).toBe('string');
      expect(typeof integ.target).toBe('string');
    }
  });

  it('claude target is CLAUDE.md at root', () => {
    const claude = KNOWN_INTEGRATIONS.find((i) => i.id === 'claude')!;
    expect(claude.target).toBe('CLAUDE.md');
  });

  it('copilot target is .github/copilot-instructions.md', () => {
    const copilot = KNOWN_INTEGRATIONS.find((i) => i.id === 'copilot')!;
    expect(copilot.target).toBe('.github/copilot-instructions.md');
  });
});

// ─── loadIntegrationConfig ───────────────────────────────────────────────────

describe('loadIntegrationConfig', () => {
  it('returns defaults when config file does not exist', async () => {
    const mockFs = {
      readFile: jest.fn().mockRejectedValue(new Error('ENOENT')),
    };
    const config = await loadIntegrationConfig(root as any, mockFs as any);
    expect(config.custom).toEqual([]);
  });

  it('parses a valid config file', async () => {
    const stored: IntegrationConfig = {
      custom: [{ id: 'abc', label: 'My Tool', source: 'context/CUSTOM.md', target: '.mytool/rules.md' }],
    };
    const mockFs = {
      readFile: jest.fn().mockResolvedValue(enc.encode(JSON.stringify(stored))),
    };
    const config = await loadIntegrationConfig(root as any, mockFs as any);
    expect(config.custom).toHaveLength(1);
    expect(config.custom[0].label).toBe('My Tool');
  });

  it('returns defaults when config file contains invalid JSON', async () => {
    const mockFs = {
      readFile: jest.fn().mockResolvedValue(enc.encode('not json {')),
    };
    const config = await loadIntegrationConfig(root as any, mockFs as any);
    expect(config.custom).toEqual([]);
  });
});

// ─── saveIntegrationConfig ───────────────────────────────────────────────────

describe('saveIntegrationConfig', () => {
  it('writes JSON to .mandala/config.json', async () => {
    const mockFs = {
      writeFile: jest.fn().mockResolvedValue(undefined),
    };
    const config: IntegrationConfig = { custom: [] };
    await saveIntegrationConfig(root as any, config, mockFs as any);
    const [uri, data] = mockFs.writeFile.mock.calls[0];
    expect(uri.fsPath).toContain(path.join('.mandala', 'config.json'));
    const written = JSON.parse(new TextDecoder().decode(data));
    expect(written.custom).toEqual([]);
  });
});

// ─── syncIntegrations ────────────────────────────────────────────────────────

describe('syncIntegrations', () => {
  const baseFs = () => ({
    readFile: jest.fn().mockRejectedValue(new Error('ENOENT')),
    writeFile: jest.fn().mockResolvedValue(undefined),
    createDirectory: jest.fn().mockResolvedValue(undefined),
    symlink: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
    delete: jest.fn().mockResolvedValue(undefined),
  });

  it('creates source seed file when it does not exist', async () => {
    const mockFs = baseFs();
    await syncIntegrations(
      root as any,
      { claude: true, copilot: false, cursor: false, cline: false, claudeCommands: false },
      { custom: [] },
      mockFs as any
    );
    const writtenPaths: string[] = mockFs.writeFile.mock.calls.map(
      (c: [{ fsPath: string }]) => c[0].fsPath
    );
    expect(writtenPaths.some((p) => p.includes('CLAUDE.md'))).toBe(true);
  });

  it('attempts symlink from target to source for enabled integration', async () => {
    const mockFs = baseFs();
    // Pretend source file exists
    mockFs.readFile.mockResolvedValue(enc.encode('# Claude context'));
    await syncIntegrations(
      root as any,
      { claude: true, copilot: false, cursor: false, cline: false, claudeCommands: false },
      { custom: [] },
      mockFs as any
    );
    expect(mockFs.symlink).toHaveBeenCalled();
    const [src, tgt] = mockFs.symlink.mock.calls[0];
    expect(tgt.fsPath).toContain('CLAUDE.md');
    expect(src.fsPath).toContain(path.join('.mandala', 'agents', 'context', 'CLAUDE.md'));
  });

  it('falls back to generating the file when symlink throws', async () => {
    const mockFs = baseFs();
    mockFs.readFile.mockResolvedValue(enc.encode('# Claude context'));
    mockFs.symlink.mockRejectedValue(new Error('EPERM'));
    await syncIntegrations(
      root as any,
      { claude: true, copilot: false, cursor: false, cline: false, claudeCommands: false },
      { custom: [] },
      mockFs as any
    );
    const writtenPaths: string[] = mockFs.writeFile.mock.calls.map(
      (c: [{ fsPath: string }]) => c[0].fsPath
    );
    // Should have written the generated CLAUDE.md at workspace root
    expect(writtenPaths.some((p) => p === path.join('/workspace', 'CLAUDE.md'))).toBe(true);
  });

  it('skips disabled integrations', async () => {
    const mockFs = baseFs();
    await syncIntegrations(
      root as any,
      { claude: false, copilot: false, cursor: false, cline: false, claudeCommands: false },
      { custom: [] },
      mockFs as any
    );
    expect(mockFs.symlink).not.toHaveBeenCalled();
  });

  it('creates parent directory for target before symlinking', async () => {
    const mockFs = baseFs();
    mockFs.readFile.mockResolvedValue(enc.encode('# Copilot'));
    await syncIntegrations(
      root as any,
      { claude: false, copilot: true, cursor: false, cline: false, claudeCommands: false },
      { custom: [] },
      mockFs as any
    );
    const createdDirs: string[] = mockFs.createDirectory.mock.calls.map(
      (c: [{ fsPath: string }]) => c[0].fsPath
    );
    expect(createdDirs.some((p) => p.endsWith('.github'))).toBe(true);
  });

  it('processes custom integrations', async () => {
    const mockFs = baseFs();
    const custom: CustomIntegration[] = [
      { id: 'mytool', label: 'My Tool', source: 'context/CUSTOM.md', target: '.mytool/rules.md' },
    ];
    await syncIntegrations(
      root as any,
      { claude: false, copilot: false, cursor: false, cline: false, claudeCommands: false },
      { custom },
      mockFs as any
    );
    expect(mockFs.symlink).toHaveBeenCalled();
    const [, tgt] = mockFs.symlink.mock.calls[0];
    expect(tgt.fsPath).toContain('.mytool');
  });

  it('returns a report with synced and failed counts', async () => {
    const mockFs = baseFs();
    mockFs.readFile.mockResolvedValue(enc.encode('content'));
    const report = await syncIntegrations(
      root as any,
      { claude: true, copilot: false, cursor: false, cline: false, claudeCommands: false },
      { custom: [] },
      mockFs as any
    );
    expect(typeof report.synced).toBe('number');
    expect(typeof report.failed).toBe('number');
    expect(report.synced + report.failed).toBeGreaterThan(0);
  });
});
