import * as path from 'path';
import {
  detectDevBrainFolders,
  loadTaskCards,
  loadDiaryEntries,
  initDevBrainFolders,
  MANDALA_SUBDIRS,
  MANDALA_ROOT,
} from './workspace';

const makeUri = (fsPath: string) => ({ fsPath });
const enc = new TextEncoder();
const md = (content: string) => enc.encode(content);

// ─── detectDevBrainFolders ───────────────────────────────────────────────────

describe('detectDevBrainFolders', () => {
  const root = makeUri('/workspace');

  it('returns found=false when all .mandala/ subdirs are missing', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockRejectedValue(new Error('ENOENT')),
    };
    const result = await detectDevBrainFolders(root as any, mockFs as any);
    expect(result.found).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining([...MANDALA_SUBDIRS]));
  });

  it('returns found=true when all .mandala/ subdirs exist', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([]),
    };
    const result = await detectDevBrainFolders(root as any, mockFs as any);
    expect(result.found).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('probes paths under .mandala/', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([]),
    };
    await detectDevBrainFolders(root as any, mockFs as any);
    const probedPaths: string[] = mockFs.readDirectory.mock.calls.map(
      (c: [{ fsPath: string }]) => c[0].fsPath
    );
    for (const sub of MANDALA_SUBDIRS) {
      expect(probedPaths.some((p) => p.includes(path.join(MANDALA_ROOT, sub)))).toBe(true);
    }
  });

  it('reports only missing subdirs', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockImplementation((uri: { fsPath: string }) => {
        if (uri.fsPath.endsWith('diary')) return Promise.resolve([]);
        return Promise.reject(new Error('ENOENT'));
      }),
    };
    const result = await detectDevBrainFolders(root as any, mockFs as any);
    expect(result.found).toBe(false);
    expect(result.missing).not.toContain('diary');
    expect(result.missing).toContain('inbox');
  });
});

// ─── loadTaskCards ───────────────────────────────────────────────────────────

describe('loadTaskCards', () => {
  const inboxUri = makeUri('/workspace/.mandala/inbox');

  it('returns empty array when folder is empty', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([]),
      readFile: jest.fn(),
    };
    const cards = await loadTaskCards(inboxUri as any, mockFs as any);
    expect(cards).toEqual([]);
  });

  it('ignores non-markdown files', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([['README.txt', 1], ['image.png', 1]]),
      readFile: jest.fn(),
    };
    const cards = await loadTaskCards(inboxUri as any, mockFs as any);
    expect(cards).toHaveLength(0);
    expect(mockFs.readFile).not.toHaveBeenCalled();
  });

  it('parses a task card with frontmatter', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([['T-001.md', 1]]),
      readFile: jest.fn().mockResolvedValue(
        md(`---
id: T-001
title: Add authentication
sprint: 2
status: in-progress
type: feat
tags: [auth, backend]
points: 3
activity: User Auth
---
Implementation notes.`)
      ),
    };
    const cards = await loadTaskCards(inboxUri as any, mockFs as any);
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card.id).toBe('T-001');
    expect(card.title).toBe('Add authentication');
    expect(card.sprint).toBe(2);
    expect(card.status).toBe('in-progress');
    expect(card.type).toBe('feat');
    expect(card.tags).toEqual(['auth', 'backend']);
    expect(card.points).toBe(3);
    expect(card.activity).toBe('User Auth');
    expect(card.body).toBe('Implementation notes.');
    expect(card.path).toContain('T-001.md');
  });

  it('uses filename stem as id when id field is absent', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([['my-task.md', 1]]),
      readFile: jest.fn().mockResolvedValue(
        md(`---
title: My Task
sprint: 1
status: planned
type: chore
---
`)
      ),
    };
    const cards = await loadTaskCards(inboxUri as any, mockFs as any);
    expect(cards[0].id).toBe('my-task');
  });

  it('skips a file that cannot be read', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([['bad.md', 1], ['good.md', 1]]),
      readFile: jest
        .fn()
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce(
          md(`---
title: Good
sprint: 1
status: planned
type: chore
---
`)
        ),
    };
    const cards = await loadTaskCards(inboxUri as any, mockFs as any);
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe('Good');
  });
});

// ─── loadDiaryEntries ────────────────────────────────────────────────────────

describe('loadDiaryEntries', () => {
  const diaryUri = makeUri('/workspace/.mandala/diary');

  it('returns empty array when folder is empty', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([]),
      readFile: jest.fn(),
    };
    const entries = await loadDiaryEntries(diaryUri as any, mockFs as any);
    expect(entries).toEqual([]);
  });

  it('parses a diary entry with frontmatter', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([['2026-05-09.md', 1]]),
      readFile: jest.fn().mockResolvedValue(
        md(`---
date: "2026-05-09"
type: feat
title: Implemented JWT auth
branch: feature/auth
files: [src/auth.ts, src/middleware.ts]
techDebt: false
adr: false
---
Today I implemented JWT...`)
      ),
    };
    const entries = await loadDiaryEntries(diaryUri as any, mockFs as any);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.date).toBe('2026-05-09');
    expect(e.type).toBe('feat');
    expect(e.title).toBe('Implemented JWT auth');
    expect(e.branch).toBe('feature/auth');
    expect(e.files).toEqual(['src/auth.ts', 'src/middleware.ts']);
    expect(e.techDebt).toBe(false);
    expect(e.body).toBe('Today I implemented JWT...');
  });

  it('sorts entries newest-first', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([
        ['2026-05-07.md', 1],
        ['2026-05-09.md', 1],
        ['2026-05-08.md', 1],
      ]),
      readFile: jest.fn().mockImplementation((uri: { fsPath: string }) => {
        const dateStem = path.basename(uri.fsPath, '.md');
        return Promise.resolve(
          md(`---
date: "${dateStem}"
type: chore
title: Entry ${dateStem}
---
`)
        );
      }),
    };
    const entries = await loadDiaryEntries(diaryUri as any, mockFs as any);
    expect(entries[0].date).toBe('2026-05-09');
    expect(entries[1].date).toBe('2026-05-08');
    expect(entries[2].date).toBe('2026-05-07');
  });

  it('uses filename stem as date when date field is absent', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockResolvedValue([['2026-01-01.md', 1]]),
      readFile: jest.fn().mockResolvedValue(
        md(`---
title: New Year
type: chore
---
`)
      ),
    };
    const entries = await loadDiaryEntries(diaryUri as any, mockFs as any);
    expect(entries[0].date).toBe('2026-01-01');
  });
});

// ─── migrateToMandalaFolder ─────────────────────────────────────────────────

describe('migrateToMandalaFolder', () => {
  const { migrateToMandalaFolder } = require('./workspace');
  const root = makeUri('/workspace');

  it('moves __inbox/__todo/ contents to .mandala/inbox/', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockImplementation((uri: { fsPath: string }) => {
        if (uri.fsPath.endsWith('__todo')) return Promise.resolve([['T-001.md', 1]]);
        return Promise.resolve([]);
      }),
      createDirectory: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue(md('content')),
      writeFile: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const report = await migrateToMandalaFolder(root as any, mockFs as any);
    expect(report.moved.some((p: string) => p.includes('T-001.md'))).toBe(true);
  });

  it('moves diary/ contents to .mandala/diary/', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockImplementation((uri: { fsPath: string }) => {
        if (uri.fsPath.endsWith('diary') && !uri.fsPath.includes('.mandala'))
          return Promise.resolve([['2026-05-09.md', 1]]);
        return Promise.resolve([]);
      }),
      createDirectory: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue(md('entry content')),
      writeFile: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const report = await migrateToMandalaFolder(root as any, mockFs as any);
    expect(report.moved.some((p: string) => p.includes('2026-05-09.md'))).toBe(true);
  });

  it('moves .agents/ contents to .mandala/agents/', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockImplementation((uri: { fsPath: string }) => {
        if (uri.fsPath.endsWith('.agents'))
          return Promise.resolve([['TECH_DEBT.md', 1], ['SPRINT_REGISTER.md', 1]]);
        return Promise.resolve([]);
      }),
      createDirectory: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockResolvedValue(md('# Tech Debt')),
      writeFile: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const report = await migrateToMandalaFolder(root as any, mockFs as any);
    expect(report.moved.length).toBeGreaterThan(0);
  });

  it('skips source folders that do not exist', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockRejectedValue(new Error('ENOENT')),
      createDirectory: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      delete: jest.fn(),
    };
    const report = await migrateToMandalaFolder(root as any, mockFs as any);
    expect(report.moved).toHaveLength(0);
    expect(report.skipped).toHaveLength(0);
  });

  it('records skipped files when readFile fails', async () => {
    const mockFs = {
      readDirectory: jest.fn().mockImplementation((uri: { fsPath: string }) => {
        if (uri.fsPath.endsWith('__todo')) return Promise.resolve([['broken.md', 1]]);
        return Promise.reject(new Error('ENOENT'));
      }),
      createDirectory: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn().mockRejectedValue(new Error('EACCES')),
      writeFile: jest.fn(),
      delete: jest.fn(),
    };
    const report = await migrateToMandalaFolder(root as any, mockFs as any);
    expect(report.skipped.some((p: string) => p.includes('broken.md'))).toBe(true);
  });
});

// ─── initDevBrainFolders ─────────────────────────────────────────────────────

describe('initDevBrainFolders', () => {
  it('creates .mandala/ subdirs and seed files', async () => {
    const root = makeUri('/workspace');
    const mockFs = {
      createDirectory: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    };
    await initDevBrainFolders(root as any, mockFs as any);
    const created: string[] = mockFs.createDirectory.mock.calls.map(
      (c: [{ fsPath: string }]) => c[0].fsPath
    );
    expect(created.some((p) => p.includes(path.join('.mandala', 'inbox')))).toBe(true);
    expect(created.some((p) => p.includes(path.join('.mandala', 'diary')))).toBe(true);
    expect(created.some((p) => p.includes(path.join('.mandala', 'agents')))).toBe(true);
    expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
  });
});
