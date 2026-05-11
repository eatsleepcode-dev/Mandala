import * as path from 'path';
import * as vscode from 'vscode';
import { parseFrontmatter } from './frontmatter';
import type { TaskStatus, EntryType, TaskCard, DiaryEntry, TechDebtSeverity, TechDebtCard, SprintRecord } from '../shared/types';

export type { TaskStatus, EntryType, TaskCard, DiaryEntry, TechDebtSeverity, TechDebtCard, SprintRecord };

export interface FsLike {
  readDirectory(uri: vscode.Uri): Thenable<[string, number][]>;
  readFile(uri: vscode.Uri): Thenable<Uint8Array>;
  writeFile(uri: vscode.Uri, data: Uint8Array): Thenable<void>;
  createDirectory(uri: vscode.Uri): Thenable<void>;
  delete(uri: vscode.Uri, options?: { recursive?: boolean }): Thenable<void>;
}

export type UriLike = vscode.Uri;

export const MANDALA_ROOT = '.mandala';
export const MANDALA_SUBDIRS = ['inbox', 'diary', 'agents', 'tech-debt', 'sprints'] as const;
type Subdir = (typeof MANDALA_SUBDIRS)[number];

// Keep the old export name so extension.ts callers stay consistent
export const DEV_BRAIN_SIGNALS = MANDALA_SUBDIRS;

export interface DetectionResult {
  found: boolean;
  missing: Subdir[];
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function joinPath(base: UriLike, ...segments: string[]): UriLike {
  return vscode.Uri.joinPath(base, ...segments);
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function stem(filename: string): string {
  return path.basename(filename, path.extname(filename));
}

interface ParsedMarkdown {
  name: string;
  uri: UriLike;
  meta: Record<string, unknown>;
  body: string;
}

async function readMarkdownFiles(
  dirUri: UriLike,
  fs: Pick<FsLike, 'readDirectory' | 'readFile'>
): Promise<ParsedMarkdown[]> {
  let entries: [string, number][];
  try {
    entries = await fs.readDirectory(dirUri);
  } catch {
    return [];
  }

  const results: ParsedMarkdown[] = [];
  for (const [name] of entries) {
    if (!name.endsWith('.md')) continue;
    const uri = joinPath(dirUri, name);
    let raw: string;
    try {
      raw = decode(await fs.readFile(uri));
    } catch {
      continue;
    }
    const { meta, body } = parseFrontmatter(raw);
    results.push({ name, uri, meta, body });
  }
  return results;
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
  const files = await readMarkdownFiles(inboxUri, fs);
  
  return files.map(({ name, uri, meta, body }) => {
    const id = typeof meta.id === 'string' ? meta.id : stem(name);
    return {
      id,
      title: typeof meta.title === 'string' ? meta.title : id,
      sprint: typeof meta.sprint === 'number' ? meta.sprint : 0,
      status: (meta.status as TaskStatus) ?? 'planned',
      type: (meta.type as EntryType) ?? 'chore',
      tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
      points: typeof meta.points === 'number' ? meta.points : undefined,
      branch: typeof meta.branch === 'string' ? meta.branch : undefined,
      activity: typeof meta.activity === 'string' ? meta.activity : undefined,
      path: uri.fsPath,
      body,
    };
  });
}

// ─── loadDiaryEntries ────────────────────────────────────────────────────────

export async function loadDiaryEntries(
  diaryUri: UriLike,
  fs: Pick<FsLike, 'readDirectory' | 'readFile'>
): Promise<DiaryEntry[]> {
  const files = await readMarkdownFiles(diaryUri, fs);
  
  const results: DiaryEntry[] = files.map(({ name, uri, meta, body }) => {
    const date = typeof meta.date === 'string' ? meta.date : stem(name);
    return {
      date,
      type: (meta.type as EntryType) ?? 'chore',
      title: typeof meta.title === 'string' ? meta.title : stem(name),
      branch: typeof meta.branch === 'string' ? meta.branch : undefined,
      files: Array.isArray(meta.files) ? (meta.files as string[]) : undefined,
      techDebt: meta.techDebt === true,
      adr: meta.adr === true,
      path: uri.fsPath,
      body,
    };
  });

  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}

// ─── loadTechDebtCards ───────────────────────────────────────────────────────

export async function loadTechDebtCards(
  techDebtUri: UriLike,
  fs: Pick<FsLike, 'readDirectory' | 'readFile'>
): Promise<TechDebtCard[]> {
  const files = await readMarkdownFiles(techDebtUri, fs);
  
  return files.map(({ name, uri, meta, body }) => {
    const id = typeof meta.id === 'string' ? meta.id : stem(name);
    return {
      id,
      title: typeof meta.title === 'string' ? meta.title : id,
      severity: (meta.severity as TechDebtSeverity) ?? 'low',
      tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
      added: typeof meta.added === 'string' ? meta.added : new Date().toISOString().split('T')[0],
      status: (meta.status as 'open' | 'resolved') ?? 'open',
      path: uri.fsPath,
      body,
    };
  });
}

// ─── loadSprintRecords ───────────────────────────────────────────────────────

export async function loadSprintRecords(
  sprintsUri: UriLike,
  fs: Pick<FsLike, 'readDirectory' | 'readFile'>
): Promise<SprintRecord[]> {
  const files = await readMarkdownFiles(sprintsUri, fs);
  
  const records = files.map(({ name, uri, meta, body }) => {
    return {
      sprint: typeof meta.sprint === 'number' ? meta.sprint : parseInt(stem(name).replace(/\D/g, ''), 10) || 0,
      goal: typeof meta.goal === 'string' ? meta.goal : '',
      status: (meta.status as TaskStatus) ?? 'planned',
      startDate: typeof meta.startDate === 'string' ? meta.startDate : undefined,
      endDate: typeof meta.endDate === 'string' ? meta.endDate : undefined,
      path: uri.fsPath,
      body,
    };
  });

  // Sort descending by sprint number
  records.sort((a, b) => b.sprint - a.sprint);
  return records;
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

export async function initDevBrainFolders(
  workspaceRoot: UriLike,
  fs: Pick<FsLike, 'createDirectory' | 'writeFile'>
): Promise<void> {
  const enc = new TextEncoder();
  const inbox = joinPath(workspaceRoot, MANDALA_ROOT, 'inbox');
  const diary = joinPath(workspaceRoot, MANDALA_ROOT, 'diary');
  const agents = joinPath(workspaceRoot, MANDALA_ROOT, 'agents');
  const techDebt = joinPath(workspaceRoot, MANDALA_ROOT, 'tech-debt');
  const sprints = joinPath(workspaceRoot, MANDALA_ROOT, 'sprints');

  await fs.createDirectory(inbox);
  await fs.createDirectory(diary);
  await fs.createDirectory(agents);
  await fs.createDirectory(techDebt);
  await fs.createDirectory(sprints);

  // Generate some seed frontmatter files for Sprints and Tech Debt
  const sprintSeed = `---
sprint: 1
goal: "Initial setup"
status: "planned"
---
Initial project scaffolding.
`;
  await fs.writeFile(joinPath(sprints, 'Sprint-1.md'), enc.encode(sprintSeed));

  const techDebtSeed = `---
id: "TD-001"
title: "Replace placeholder code"
severity: "medium"
tags: ["setup", "refactor"]
status: "open"
---
The initial codebase contains some placeholders that need to be replaced.
`;
  await fs.writeFile(joinPath(techDebt, 'TD-001.md'), enc.encode(techDebtSeed));
}
