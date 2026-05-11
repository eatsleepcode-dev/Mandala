import * as path from 'path';
import * as vscode from 'vscode';
import { parseFrontmatter } from './frontmatter';
import type {
  TaskStatus,
  EntryType,
  TaskCard,
  DiaryEntry,
  TechDebtSeverity,
  TechDebtCard,
  SprintRecord,
  GuideInsights,
} from '../shared/types';

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
const GETTING_STARTED_MANIFEST = '.getting-started.json';

interface GettingStartedManifest {
  version: 1;
  files: string[];
}

const GETTING_STARTED_FILES: ReadonlyArray<{ relativePath: string; content: string }> = [
  {
    relativePath: '.mandala/inbox/example-map-auth-refresh.md',
    content: `---
id: EX-001
title: Map the token refresh experience
sprint: 1
status: in-progress
type: feat
tags: [example, auth, onboarding]
points: 3
activity: Keep a session alive
---
Use this sample card to see how story map items group by activity and sprint.
`,
  },
  {
    relativePath: '.mandala/inbox/example-observability-pass.md',
    content: `---
id: EX-002
title: Add a visible validation checkpoint
sprint: 2
status: planned
type: test
tags: [example, dashboard, quality]
points: 2
activity: Validate the change
---
This sample card shows how a later sprint appears in the story map and inbox.
`,
  },
  {
    relativePath: '.mandala/diary/2026-05-11-welcome-to-mandala.md',
    content: `---
date: "2026-05-11"
type: docs
title: Welcome to Mandala
branch: docs/getting-started
files: [src/webview/App.tsx, src/lib/workspace.ts]
techDebt: false
adr: false
---
Mandala organizes sprint cards, diary notes, and tech debt in one place.

Use these starter entries to explore the dashboard before you add your own real data.
`,
  },
  {
    relativePath: '.mandala/diary/2026-05-10-first-sprint-notes.md',
    content: `---
date: "2026-05-10"
type: feat
title: Turn an idea into a sprint slice
branch: feat/first-slice
files: [.mandala/inbox/example-map-auth-refresh.md]
techDebt: false
adr: false
---
Start with one thin vertical slice, then expand from there once the path is working.
`,
  },
  {
    relativePath: '.mandala/sprints/Sprint-0-Getting-Started.md',
    content: `---
sprint: 0
goal: "Explore the dashboard with sample data"
status: "planned"
startDate: "2026-05-11"
endDate: "2026-05-12"
---
This starter sprint exists only to demonstrate how Mandala renders a sprint record.
`,
  },
  {
    relativePath: '.mandala/tech-debt/TD-EXAMPLE-001.md',
    content: `---
id: "TD-EXAMPLE-001"
title: "Replace sample content with project-specific notes"
severity: "low"
tags: [example, onboarding]
status: "open"
added: "2026-05-11"
---
When the dashboard makes sense, remove the starter files from Settings and begin capturing real work.
`,
  },
];

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

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
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

interface AgentFileRef {
  name: string;
  path: string;
  relativePath: string;
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

async function listFilesRecursive(
  dirUri: UriLike,
  fs: Pick<FsLike, 'readDirectory'>,
  shouldInclude: (filename: string) => boolean,
  baseDir: UriLike = dirUri
): Promise<AgentFileRef[]> {
  let entries: [string, number][];
  try {
    entries = await fs.readDirectory(dirUri);
  } catch {
    return [];
  }

  const files: AgentFileRef[] = [];
  for (const [name, fileType] of entries) {
    const child = joinPath(dirUri, name);
    if (fileType === vscode.FileType.Directory) {
      files.push(...await listFilesRecursive(child, fs, shouldInclude, baseDir));
      continue;
    }

    if (!shouldInclude(name)) continue;
    const relativePath = child.fsPath.slice(baseDir.fsPath.length + 1).replace(/\\/g, '/');
    files.push({
      name,
      path: child.fsPath,
      relativePath,
    });
  }

  return files;
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

  const results = files.map(({ name, uri, meta, body }) => ({
    date: typeof meta.date === 'string' ? meta.date : stem(name),
    type: (meta.type as EntryType) ?? 'chore',
    title: typeof meta.title === 'string' ? meta.title : stem(name),
    branch: typeof meta.branch === 'string' ? meta.branch : undefined,
    files: Array.isArray(meta.files) ? (meta.files as string[]) : undefined,
    techDebt: meta.techDebt === true,
    adr: meta.adr === true,
    path: uri.fsPath,
    body,
  }));

  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}

async function listFilesFromRoots(
  roots: UriLike[],
  fs: Pick<FsLike, 'readDirectory'>,
  shouldInclude: (filename: string) => boolean
): Promise<AgentFileRef[]> {
  const results: AgentFileRef[] = [];
  for (const root of roots) {
    const files = await listFilesRecursive(root, fs, shouldInclude);
    if (files.length > 0) {
      results.push(...files);
    }
  }
  return results;
}

async function readTextFileSafe(
  fileUri: UriLike,
  fs: Pick<FsLike, 'readFile'>
): Promise<string | undefined> {
  try {
    return decode(await fs.readFile(fileUri));
  } catch {
    return undefined;
  }
}

function parseGuideInsights(html: string): GuideInsights {
  const capture = (pattern: RegExp): string | undefined => {
    const match = html.match(pattern);
    return match?.[1]?.trim();
  };

  const asNumber = (value: string | undefined): number | undefined => {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  return {
    title: capture(/<h1>\s*Agent Guide\s*[\u2014-]\s*<span>([^<]+)<\/span>/i),
    updated: capture(/<strong>Updated:\s*<\/strong>\s*([^<]+)/i),
    workflowCount: asNumber(capture(/<strong>(\d+)<\/strong>\s*workflows/i)),
    slashCommandCount: asNumber(capture(/<strong>(\d+)<\/strong>\s*slash commands/i)),
    autoTriggerCount: asNumber(capture(/<strong>(\d+)<\/strong>\s*auto-triggers/i)),
    qualityGateCount: asNumber(capture(/<strong>(\d+)<\/strong>\s*quality gates/i)),
  };
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

// ─── loadAgentResources ─────────────────────────────────────────────────────

export async function loadAgentResources(
  workspaceRoot: UriLike,
  fs: Pick<FsLike, 'readDirectory' | 'readFile'>
): Promise<{
  workflows: AgentFileRef[];
  skills: AgentFileRef[];
  tasks: AgentFileRef[];
  guides: AgentFileRef[];
  registry: AgentFileRef[];
  guidePath?: string;
  guideInsights?: GuideInsights;
}> {
  const workflowsUris = [
    joinPath(workspaceRoot, '.mandala', 'agents', 'phases', 'discovery', 'workflows'),
    joinPath(workspaceRoot, '.mandala', 'agents', 'phases', 'delivery', 'workflows'),
    joinPath(workspaceRoot, '.agents', 'workflows'),
    joinPath(workspaceRoot, '.mandala', 'agents', 'workflows'),
  ];
  const skillsUris = [
    joinPath(workspaceRoot, '.mandala', 'skills'),
    joinPath(workspaceRoot, '.agents', 'powerbi-skills'),
    joinPath(workspaceRoot, '.agents', 'skills'),
    joinPath(workspaceRoot, '.mandala', 'agents', 'powerbi-skills'),
  ];
  const tasksUris = [
    joinPath(workspaceRoot, '.mandala', 'agents', 'phases', 'discovery', 'tasks'),
    joinPath(workspaceRoot, '.mandala', 'agents', 'phases', 'delivery', 'tasks'),
    joinPath(workspaceRoot, '.mandala', 'sprints'),
    joinPath(workspaceRoot, '.agents', 'sprints', 'task-cards'),
    joinPath(workspaceRoot, '.mandala', 'agents', 'sprints', 'task-cards'),
  ];
  const guideRoots = [
    joinPath(workspaceRoot, '__guides'),
    joinPath(workspaceRoot, 'docs'),
  ];
  const registryUris = [
    joinPath(workspaceRoot, '.mandala', 'registry'),
  ];
  const guideUri = joinPath(workspaceRoot, '__guides', 'agent-guide.html');

  const [workflows, skills, tasks, guides, registry, guideSource] = await Promise.all([
    listFilesFromRoots(
      workflowsUris,
      fs,
      (name) => name.endsWith('.md') || name.endsWith('.py')
    ),
    listFilesFromRoots(
      skillsUris,
      fs,
      (name) =>
        name.endsWith('.md') ||
        name.endsWith('.yaml') ||
        name.endsWith('.yml') ||
        name.endsWith('.json')
    ),
    listFilesFromRoots(
      tasksUris,
      fs,
      (name) => name.endsWith('.md')
    ),
    listFilesFromRoots(
      guideRoots,
      fs,
      (name) => name.endsWith('.md') || name.endsWith('.html')
    ),
    listFilesFromRoots(
      registryUris,
      fs,
      (name) => name.endsWith('.yaml') || name.endsWith('.yml') || name.endsWith('.json')
    ),
    readTextFileSafe(guideUri, fs),
  ]);

  workflows.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  skills.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  tasks.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  guides.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  registry.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const guidePath = guides.some((g) => g.name === 'agent-guide.html')
    ? guideUri.fsPath
    : undefined;
  const guideInsights = guideSource ? parseGuideInsights(guideSource) : undefined;

  return { workflows, skills, tasks, guides, registry, guidePath, guideInsights };
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
  fs: Pick<FsLike, 'createDirectory' | 'writeFile'>,
  options?: { includeExamples?: boolean }
): Promise<void> {
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

  if (options?.includeExamples) {
    await seedGettingStartedExamples(workspaceRoot, fs);
  }
}

function manifestUri(workspaceRoot: UriLike): UriLike {
  return joinPath(workspaceRoot, MANDALA_ROOT, GETTING_STARTED_MANIFEST);
}

async function readGettingStartedManifest(
  workspaceRoot: UriLike,
  fs: Pick<FsLike, 'readFile'>
): Promise<GettingStartedManifest | undefined> {
  try {
    const raw = decode(await fs.readFile(manifestUri(workspaceRoot)));
    const parsed = JSON.parse(raw) as Partial<GettingStartedManifest>;
    if (!Array.isArray(parsed.files)) {
      return undefined;
    }

    return {
      version: 1,
      files: parsed.files.filter((file): file is string => typeof file === 'string'),
    };
  } catch {
    return undefined;
  }
}

export async function hasGettingStartedExamples(
  workspaceRoot: UriLike,
  fs: Pick<FsLike, 'readFile'>
): Promise<boolean> {
  const manifest = await readGettingStartedManifest(workspaceRoot, fs);
  return (manifest?.files.length ?? 0) > 0;
}

export async function seedGettingStartedExamples(
  workspaceRoot: UriLike,
  fs: Pick<FsLike, 'createDirectory' | 'writeFile'>
): Promise<number> {
  const mandalaRoot = joinPath(workspaceRoot, MANDALA_ROOT);
  await fs.createDirectory(mandalaRoot);

  for (const subdir of MANDALA_SUBDIRS) {
    await fs.createDirectory(joinPath(workspaceRoot, MANDALA_ROOT, subdir));
  }

  for (const file of GETTING_STARTED_FILES) {
    await fs.writeFile(joinPath(workspaceRoot, ...file.relativePath.split('/')), encode(file.content));
  }

  const manifest: GettingStartedManifest = {
    version: 1,
    files: GETTING_STARTED_FILES.map((file) => file.relativePath),
  };
  await fs.writeFile(manifestUri(workspaceRoot), encode(JSON.stringify(manifest, null, 2)));
  return GETTING_STARTED_FILES.length;
}

export async function removeGettingStartedExamples(
  workspaceRoot: UriLike,
  fs: Pick<FsLike, 'readFile' | 'delete'>
): Promise<number> {
  const manifest = await readGettingStartedManifest(workspaceRoot, fs);
  if (!manifest) {
    return 0;
  }

  let removed = 0;
  for (const relativePath of manifest.files) {
    try {
      await fs.delete(joinPath(workspaceRoot, ...relativePath.split('/')));
      removed += 1;
    } catch {
      // Ignore files that no longer exist.
    }
  }

  try {
    await fs.delete(manifestUri(workspaceRoot));
  } catch {
    // Ignore a missing manifest.
  }

  return removed;
}
