/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shell out with a hard timeout so a slow/absent az CLI never hangs the UI. */
function runAzRaw(command: string, timeoutMs = 12_000): Promise<string> {
  return new Promise((resolve, reject) => {
    // On Windows use cmd /c so PATH (where az lives) is inherited properly.
    const shell = process.platform === 'win32' ? 'cmd' : '/bin/sh';
    const shellFlag = process.platform === 'win32' ? '/c' : '-c';

    const child = exec(
      command,
      { 
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh', 
        timeout: timeoutMs,
        env: process.env
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`az error: ${err.message}${stderr ? ' — ' + stderr.trim() : ''}`));
        } else {
          resolve(stdout);
        }
      }
    );
    // Belt-and-braces: kill the child if it somehow exceeds the timeout.
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`az command timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs + 500);
    child.on('exit', () => clearTimeout(timer));
  });
}

async function runAz(command: string, timeoutMs = 12_000): Promise<any> {
  const stdout = await runAzRaw(command, timeoutMs);
  const trimmed = stdout.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`az returned non-JSON output: ${trimmed.slice(0, 200)}`);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CapacityConfig {
  id: string;
  displayName: string;
  subscriptionId: string;
  resourceGroup: string;
  timezone: string;
  enabled: boolean;
  respectBankHolidays: boolean;
  bankHolidayMode: 'Suspend' | 'UseSundaySchedule' | 'Ignore';
  defaultSku: string;
  schedule: Record<string, any[]>;
}

export interface ThermostatConfig {
  version: number;
  capacities: CapacityConfig[];
}

function emptySchedule(): Record<string, any[]> {
  return {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [],
    Friday: [], Saturday: [], Sunday: [],
  };
}

// ── FabricThermostat ──────────────────────────────────────────────────────────

export class FabricThermostat {
  private getConfigUri(workspaceRoot: string) {
    return vscode.Uri.file(path.join(workspaceRoot, '.mandala', 'thermostat.json'));
  }

  async getConfig(workspaceRoot: string): Promise<{ config: ThermostatConfig; etag: string }> {
    // 1. Read local persisted config (fast, always returns even if no az).
    let localConfig: ThermostatConfig = { version: 1, capacities: [] };
    const configUri = this.getConfigUri(workspaceRoot);
    try {
      const data = await vscode.workspace.fs.readFile(configUri);
      localConfig = JSON.parse(Buffer.from(data).toString('utf8'));
    } catch {
      // File doesn't exist yet — that's fine.
    }

    // 2. Try to enrich from Azure CLI (with a very short timeout for initial load).
    // We race this so if `az` hangs or is slow, we return what we have immediately.
    let azCapacities: any[] = [];
    try {
      // Use Resource Graph to query across ALL resource groups and subscriptions.
      const azPromise = runAz('az graph query -q "Resources | where type =~ \'microsoft.fabric/capacities\'" --output json', 5000);
      
      const azResponse = await Promise.race([
        azPromise,
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Backgrounding Azure CLI enrichment')), 500))
      ]);
      
      if (azResponse && Array.isArray(azResponse.data)) {
        azCapacities = azResponse.data;
      } else if (Array.isArray(azResponse)) {
        azCapacities = azResponse;
      }
      
      // Prevent unhandled rejections if the background promise fails later
      azPromise.catch((e) => {
        console.info('[Mandala Thermostat] Background az CLI enrichment finished with error:', e.message);
      });
    } catch (e: any) {
      console.warn('[Mandala Thermostat] Azure CLI enrichment backgrounded or failed:', e.message);
    }

    // 3. Merge Azure discoveries into local config.
    const merged: CapacityConfig[] = [];

    for (const azCap of azCapacities) {
      const parts: string[] = (azCap.id ?? '').split('/');
      const subId = parts[2] ?? '';
      const rg = parts[4] ?? '';

      const existing = localConfig.capacities.find(
        c => c.id.toLowerCase() === azCap.id.toLowerCase()
      );

      if (existing) {
        merged.push({ ...existing, displayName: azCap.name, subscriptionId: subId, resourceGroup: rg });
      } else {
        merged.push({
          id: azCap.id,
          displayName: azCap.name,
          subscriptionId: subId,
          resourceGroup: rg,
          timezone: 'Europe/London',
          enabled: true,
          respectBankHolidays: true,
          bankHolidayMode: 'Suspend',
          defaultSku: azCap.sku?.name ?? 'F2',
          schedule: emptySchedule(),
        });
      }
    }

    // Keep locally-known capacities not found in this az query.
    for (const loc of localConfig.capacities) {
      if (!merged.find(c => c.id.toLowerCase() === loc.id.toLowerCase())) {
        merged.push(loc);
      }
    }

    localConfig.capacities = merged;
    return { config: localConfig, etag: Date.now().toString() };
  }

  async putConfig(workspaceRoot: string, config: ThermostatConfig): Promise<{ etag: string }> {
    const mandalaDir = vscode.Uri.file(path.join(workspaceRoot, '.mandala'));
    await vscode.workspace.fs.createDirectory(mandalaDir);
    const configUri = this.getConfigUri(workspaceRoot);
    await vscode.workspace.fs.writeFile(configUri, Buffer.from(JSON.stringify(config, null, 2)));
    return { etag: Date.now().toString() };
  }

  async getCapacityState(capacityId: string): Promise<{ state: string; sku: string; location: string }> {
    const data = await runAz(
      `az rest --method get --url "https://management.azure.com${capacityId}?api-version=2023-11-01"`
    );
    return {
      state: data?.properties?.state ?? 'Unknown',
      sku: data?.sku?.name ?? 'Unknown',
      location: data?.location ?? 'Unknown',
    };
  }

  async triggerCapacity(capacityId: string, action: string, sku?: string): Promise<{ jobId: string }> {
    const base = `https://management.azure.com${capacityId}`;
    const api = 'api-version=2023-11-01';

    if (action === 'Suspend') {
      await runAz(`az rest --method post --url "${base}/suspend?${api}"`);
      return { jobId: 'az-suspend' };
    }

    if (action === 'Resume') {
      await runAz(`az rest --method post --url "${base}/resume?${api}"`);
      return { jobId: 'az-resume' };
    }

    if (action === 'Scale') {
      if (!sku) { throw new Error('SKU required for Scale action.'); }
      // Write the body to a temp file to avoid Windows shell-quoting headaches.
      const body = JSON.stringify({ sku: { name: sku, tier: 'Fabric' } });
      const tmp = path.join(require('os').tmpdir(), 'mandala-scale-body.json');
      require('fs').writeFileSync(tmp, body, 'utf8');
      await runAz(`az rest --method patch --url "${base}?${api}" --body "@${tmp}"`);
      return { jobId: 'az-scale' };
    }

    throw new Error(`Unknown action: ${action}`);
  }
}
