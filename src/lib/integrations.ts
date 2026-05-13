import * as path from 'path';
import * as vscode from 'vscode';
import {
  KNOWN_INTEGRATIONS,
  type CustomIntegration,
  type KnownIntegration,
  type KnownIntegrationFlags,
} from '../shared/types';

export {
  KNOWN_INTEGRATIONS,
  type CustomIntegration,
  type KnownIntegration,
  type KnownIntegrationFlags,
};

export interface IntegrationConfig {
  custom: CustomIntegration[];
}

export interface SyncReport {
  synced: number;
  failed: number;
}

export type UriLike = vscode.Uri;

interface IntegrationFsLike {
  readFile(uri: UriLike): Thenable<Uint8Array>;
  writeFile(uri: UriLike, data: Uint8Array): Thenable<void>;
  createDirectory(uri: UriLike): Thenable<void>;
  symlink?: (source: UriLike, target: UriLike) => Thenable<void>;
}

const MANDALA_ROOT = '.mandala';
const AGENTS_ROOT = path.join(MANDALA_ROOT, 'agents');
const CONFIG_PATH = path.join(MANDALA_ROOT, 'config.json');

function joinPath(base: UriLike, ...segments: string[]): UriLike {
  return vscode.Uri.joinPath(base, ...segments);
}

export async function loadIntegrationConfig(
  root: UriLike,
  fs: Pick<IntegrationFsLike, 'readFile'>
): Promise<IntegrationConfig> {
  try {
    const data = await fs.readFile(joinPath(root, CONFIG_PATH));
    const parsed = JSON.parse(new TextDecoder().decode(data));
    return { custom: Array.isArray(parsed.custom) ? parsed.custom : [] };
  } catch {
    return { custom: [] };
  }
}

export async function saveIntegrationConfig(
  root: UriLike,
  config: IntegrationConfig,
  fs: Pick<IntegrationFsLike, 'writeFile'>
): Promise<void> {
  const uri = joinPath(root, CONFIG_PATH);
  await fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(config, null, 2)));
}

export async function syncIntegrations(
  root: UriLike,
  knownFlags: KnownIntegrationFlags,
  config: IntegrationConfig,
  fs: IntegrationFsLike
): Promise<SyncReport> {
  const active: Array<{ source: string; target: string; label: string }> = [];

  for (const integ of KNOWN_INTEGRATIONS) {
    if (knownFlags[integ.id as keyof KnownIntegrationFlags]) {
      active.push(integ);
    }
  }
  for (const custom of config.custom) {
    active.push(custom);
  }

  let synced = 0;
  let failed = 0;
  const enc = new TextEncoder();

  for (const { source, target, label } of active) {
    const sourceUri = joinPath(root, AGENTS_ROOT, source);
    const targetUri = joinPath(root, target);

    // Ensure source exists; seed it if missing
    try {
      await fs.readFile(sourceUri);
    } catch {
      try {
        await fs.createDirectory(vscode.Uri.file(path.dirname(sourceUri.fsPath)));
      } catch { /* already exists */ }
      await fs.writeFile(sourceUri, enc.encode(`# ${label}\n\nAdd your agent context here.\n`));
    }

    // Create parent directory for target
    try {
      await fs.createDirectory(vscode.Uri.file(path.dirname(targetUri.fsPath)));
    } catch { /* already exists */ }

    // Try symlink; fall back to copying the file
    try {
      if (fs.symlink) {
        await fs.symlink(sourceUri, targetUri);
      } else {
        throw new Error('symlink not supported');
      }
      synced++;
    } catch {
      try {
        let content: Uint8Array;
        try {
          content = await fs.readFile(sourceUri);
        } catch {
          content = enc.encode(`# ${label}\n\nAdd your agent context here.\n`);
        }
        await fs.writeFile(targetUri, content);
        synced++;
      } catch {
        failed++;
      }
    }
  }

  return { synced, failed };
}
