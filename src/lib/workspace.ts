import * as path from 'path';
import { parseFrontmatter } from './frontmatter';
import type { TaskStatus, EntryType, TaskCard, DiaryEntry } from '../shared/types';

export type { TaskStatus, EntryType, TaskCard, DiaryEntry };

export interface FsLike {
  readDirectory(uri: UriLike): Thenable<[string, number][]>;
  readFile(uri: UriLike): Thenable<Uint8Array>;
  writeFile(uri: UriLike, data: Uint8Array): Thenable<void>;
  createDirectory(uri: UriLike): Thenable<void>;
  delete(uri: UriLike, options?: { recursive?: boolean }): Thenable<void>;
}

export interface UriLike {
  fsPath: string;
}

export const MANDALA_ROOT = '.mandala';
export const MANDALA_SUBDIRS = ['inbox', 'diary', 'agents'] as const;
type Subdir = (typeof MANDALA_SUBDIRS)[number];

// Keep the old export name so extension.ts callers stay consistent
export const DEV_BRAIN_SIGNALS = MANDALA_SUBDIRS;

export interface DetectionResult {
  found: boolean;
  missing: Subdir[];
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function joinPath(base: UriLike, ...segments: string[]): UriLike {
  return { fsPath: path.join(base.fsPath, ...segments) };
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function stem(filename: string): string {
  return path.basename(filename, path.extname(filename));
}

// ─── detectDevBrainFolders ───────────────────────────────────────────────────

export async function detectDevBrainFolders(
  workspaceRoot: UriLike,
  fs: Pick<FsLike, 'readDirectory'>
): Promise<DetectionResult> {
  const missing: Subdir[] = [];
  for (const sub of MANDALA_SUBDIRS) {
    try {
      await fs.readDirectory(joinPath(workspaceRoot, MANDALA_ROOT, sub));
    } catch {
      missing.push(sub);
    }
  }
  return { found: missing.length === 0, missing };
}

/** Convenience: resolve a subdir path under .mandala/ */
export function mandalaPath(workspaceRoot: UriLike, sub: Subdir): UriLike {
  return joinPath(workspaceRoot, MANDALA_ROOT, sub);
}

// ─── loadTaskCards ───────────────────────────────────────────────────────────

export async function loadTaskCards(
  inboxUri: UriLike,
  fs: Pick<FsLike, 'readDirectory' | 'readFile'>
): Promise<TaskCard[]> {
  let entries: [string, number][];
  try {
    entries = await fs.readDirectory(inboxUri);
  } catch {
    return [];
  }

  const cards: TaskCard[] = [];
  for (const [name] of entries) {
    if (!name.endsWith('.md')) continue;
    const fileUri = joinPath(inboxUri, name);
    let raw: string;
    try {
      raw = decode(await fs.readFile(fileUri));
    } catch {
      continue;
    }

    const { meta, body } = parseFrontmatter(raw);
    const id = typeof meta.id === 'string' ? meta.id : stem(name);
    cards.push({
      id,
      title: typeof meta.title === 'string' ? meta.title : id,
      sprint: typeof meta.sprint === 'number' ? meta.sprint : 0,
      status: (meta.status as TaskStatus) ?? 'planned',
      type: (meta.type as EntryType) ?? 'chore',
      tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
      points: typeof meta.points === 'number' ? meta.points : undefined,
      branch: typeof meta.branch === 'string' ? meta.branch : undefined,
      activity: typeof meta.activity === 'string' ? meta.activity : undefined,
      path: fileUri.fsPath,
      body,
    });
  }
  return cards;
}

// ─── loadDiaryEntries ────────────────────────────────────────────────────────

export async function loadDiaryEntries(
  diaryUri: UriLike,
  fs: Pick<FsLike, 'readDirectory' | 'readFile'>
): Promise<DiaryEntry[]> {
  let entries: [string, number][];
  try {
    entries = await fs.readDirectory(diaryUri);
  } catch {
    return [];
  }

  const results: DiaryEntry[] = [];
  for (const [name] of entries) {
    if (!name.endsWith('.md')) continue;
    const fileUri = joinPath(diaryUri, name);
    let raw: string;
    try {
      raw = decode(await fs.readFile(fileUri));
    } catch {
      continue;
    }

    const { meta, body } = parseFrontmatter(raw);
    const date = typeof meta.date === 'string' ? meta.date : stem(name);
    results.push({
      date,
      type: (meta.type as EntryType) ?? 'chore',
      title: typeof meta.title === 'string' ? meta.title : stem(name),
      branch: typeof meta.branch === 'string' ? meta.branch : undefined,
      files: Array.isArray(meta.files) ? (meta.files as string[]) : undefined,
      techDebt: meta.techDebt === true,
      adr: meta.adr === true,
      path: fileUri.fsPath,
      body,
    });
  }

  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}

// ─── migrateToMandalaFolder ─────────────────────────────────────────────────

export interface MigrationReport {
  moved: string[];
  skipped: string[];
}

/** Legacy folder → new .mandala/ subdir mapping (checked in order; first match wins per dest) */
const LEGACY_MAP: Array<{ src: string[]; dest: Subdir }> = [
  { src: ['.meridian', 'inbox'], dest: 'inbox' },
  { src: ['.meridian', 'diary'], dest: 'diary' },
  { src: ['.meridian', 'agents'], dest: 'agents' },
  { src: ['__inbox', '__todo'], dest: 'inbox' },
  { src: ['diary'], dest: 'diary' },
  { src: ['.agents'], dest: 'agents' },
];

export async function migrateToMandalaFolder(
  workspaceRoot: UriLike,
  fs: Pick<FsLike, 'readDirectory' | 'readFile' | 'writeFile' | 'createDirectory' | 'delete'>
): Promise<MigrationReport> {
  const moved: string[] = [];
  const skipped: string[] = [];

  for (const { src, dest } of LEGACY_MAP) {
    const srcUri = joinPath(workspaceRoot, ...src);
    const destUri = joinPath(workspaceRoot, MANDALA_ROOT, dest);

    let files: [string, number][];
    try {
      files = await fs.readDirectory(srcUri);
    } catch {
      // Source folder doesn't exist — nothing to migrate
      continue;
    }

    await fs.createDirectory(destUri);

    for (const [name] of files) {
      const srcFile = joinPath(srcUri, name);
      const destFile = joinPath(destUri, name);
      try {
        const data = await fs.readFile(srcFile);
        await fs.writeFile(destFile, data);
        await fs.delete(srcFile);
        moved.push(destFile.fsPath);
      } catch {
        skipped.push(srcFile.fsPath);
      }
    }
  }

  return { moved, skipped };
}

// ─── initDevBrainFolders ─────────────────────────────────────────────────────

const TECH_DEBT_SEED = `# Technical Debt Register\n\n| ID | Description | Severity | Added |\n|---|---|---|---|\n`;
const SPRINT_REGISTER_SEED = `# Sprint Register\n\n| Sprint | Goal | Status |\n|---|---|---|\n| 1 | Initial setup | planned |\n`;

export async function initDevBrainFolders(
  workspaceRoot: UriLike,
  fs: Pick<FsLike, 'createDirectory' | 'writeFile'>
): Promise<void> {
  const enc = new TextEncoder();
  const inbox = joinPath(workspaceRoot, MANDALA_ROOT, 'inbox');
  const diary = joinPath(workspaceRoot, MANDALA_ROOT, 'diary');
  const agents = joinPath(workspaceRoot, MANDALA_ROOT, 'agents');

  await fs.createDirectory(inbox);
  await fs.createDirectory(diary);
  await fs.createDirectory(agents);

  await fs.writeFile(joinPath(agents, 'TECH_DEBT.md'), enc.encode(TECH_DEBT_SEED));
  await fs.writeFile(joinPath(agents, 'SPRINT_REGISTER.md'), enc.encode(SPRINT_REGISTER_SEED));
}
