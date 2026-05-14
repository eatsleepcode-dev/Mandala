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

  private hashConfig(config: ThermostatConfig): string {
    return JSON.stringify(config).length.toString();
  }

  async getConfig(
    workspaceRoot: string,
    onBackgroundComplete?: (newConfig: ThermostatConfig) => void
  ): Promise<{ config: ThermostatConfig; etag: string }> {
    // 1. Read local persisted config (fast, always returns even if no az).
    let localConfig: ThermostatConfig = { version: 1, capacities: [] };
    const configUri = this.getConfigUri(workspaceRoot);
    try {
      const data = await vscode.workspace.fs.readFile(configUri);
      localConfig = JSON.parse(Buffer.from(data).toString('utf8'));
    } catch {
      // File doesn't exist yet — that's fine.
    }

    // Helper to merge newly discovered capacities into local config
    const mergeCapacities = (azCapacities: any[]) => {
      const merged: CapacityConfig[] = [];
      for (const azCap of azCapacities) {
        const parts: string[] = (azCap.id ?? '').split('/');
        const subId = parts[2] ?? '';
        const rg = parts[4] ?? '';
        const existing = localConfig.capacities.find(c => c.id.toLowerCase() === azCap.id.toLowerCase());
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
            schedule: emptySchedule()
          });
        }
      }
      for (const existing of localConfig.capacities) {
        if (!merged.some(c => c.id.toLowerCase() === existing.id.toLowerCase())) {
          merged.push(existing);
        }
      }
      merged.sort((a, b) => a.displayName.localeCompare(b.displayName));
      return { ...localConfig, capacities: merged };
    };

    // 2. Try to enrich from Azure CLI (with a short timeout for initial load).
    // We race this so the UI loads fast. If it times out, we let it finish in the background.
    const queryBody = { query: "Resources | where type =~ 'microsoft.fabric/capacities'" };
    const queryPath = path.join(workspaceRoot, '.mandala', 'graph_query.json');
    
    let azCapacities: any[] = [];
    
    try {
      await vscode.workspace.fs.writeFile(vscode.Uri.file(queryPath), Buffer.from(JSON.stringify(queryBody)));
      
      const azPromise = runAz(`az rest --method post --url "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01" --body @"${queryPath}" --headers "Content-Type=application/json"`);
      
      // If az responds within 500ms, great! If not, we return local config and update later.
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 500));
      const azResponse = await Promise.race([azPromise, timeoutPromise]);
      
      if (azResponse !== null) {
        // Fast response!
        if (Array.isArray(azResponse.data)) {
          azCapacities = azResponse.data;
        } else if (Array.isArray(azResponse)) {
          azCapacities = azResponse;
        }
        localConfig = mergeCapacities(azCapacities);
      } else {
        // Slow response, let it finish in the background
        if (onBackgroundComplete) {
          azPromise.then(async (bgResponse: any) => {
            let bgCaps = [];
            if (bgResponse && Array.isArray(bgResponse.data)) {
              bgCaps = bgResponse.data;
            } else if (Array.isArray(bgResponse)) {
              bgCaps = bgResponse;
            }
            if (bgCaps.length > 0) {
              const bgMerged = mergeCapacities(bgCaps);
              await this.putConfig(workspaceRoot, bgMerged); // Save it so the UI etag changes
              onBackgroundComplete(bgMerged);
            }
          }).catch(e => {
            console.warn('[Mandala Thermostat] Azure CLI background enrichment failed:', e.message);
          });
        }
      }
    } catch (e: any) {
      console.warn('[Mandala Thermostat] Azure CLI enrichment failed:', e.message);
    }

    return { config: localConfig, etag: this.hashConfig(localConfig) };
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
