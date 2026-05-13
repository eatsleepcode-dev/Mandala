import { vscode } from '../vscode';

// ── Minimal request/response bridge to the extension host ────────────────────
let reqIdCounter = 0;
const pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'thermostatApiResult') {
    const p = pendingRequests.get(msg.reqId);
    if (p) {
      pendingRequests.delete(msg.reqId);
      if (msg.error) p.reject(new Error(msg.error));
      else p.resolve(msg.result);
    }
  }
});

async function callExtension(method: string, args: any = {}, timeoutMs = 15_000): Promise<any> {
  return new Promise((resolve, reject) => {
    const reqId = ++reqIdCounter;

    const timer = setTimeout(() => {
      pendingRequests.delete(reqId);
      reject(new Error(`Thermostat request '${method}' timed out after ${timeoutMs / 1000}s. Is the extension host running?`));
    }, timeoutMs);

    pendingRequests.set(reqId, {
      resolve: (v: any) => { clearTimeout(timer); resolve(v); },
      reject:  (e: any) => { clearTimeout(timer); reject(e); },
    });

    vscode.postMessage({ command: 'thermostatApi', reqId, method, args });
  });
}

// ── Kept for backward compat but no longer needed ────────────────────────────
export function setThermostatEnvironment(_apiUrl: string, _secret: string): void {
  // No-op: Azure CLI / extension host handles auth directly.
}

// ── F-SKU ladder ─────────────────────────────────────────────────────────────
export const FABRIC_SKUS = [
  'F2', 'F4', 'F8', 'F16', 'F32', 'F64',
  'F128', 'F256', 'F512', 'F1024', 'F2048',
] as const;
export type FabricSku = (typeof FABRIC_SKUS)[number];

// ── Day constants ─────────────────────────────────────────────────────────────
export type DayKey =
  | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday'
  | 'Friday' | 'Saturday' | 'Sunday';

export const DAY_KEYS: DayKey[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday', 'Sunday',
];

// ── Domain types ─────────────────────────────────────────────────────────────
export type ThermostatAction = 'Suspend' | 'Resume' | 'Scale';

export interface ScheduleSlot {
  start: string;           // HH:mm
  action: ThermostatAction;
  sku?: string;            // required for Resume / Scale, absent for Suspend
}

export interface CapacityConfig {
  id: string;              // ARM resource ID
  displayName: string;
  subscriptionId: string;
  resourceGroup: string;
  timezone: string;        // e.g. Europe/London
  enabled: boolean;
  respectBankHolidays: boolean;
  bankHolidayMode: 'Suspend' | 'UseSundaySchedule' | 'Ignore';
  defaultSku: string;
  schedule: Record<string, ScheduleSlot[]>;
}

export type WeeklySchedule = CapacityConfig['schedule'];

export interface ThermostatConfig {
  version: number;
  capacities: CapacityConfig[];
}

export interface CapacityState {
  state: 'Active' | 'Paused' | 'Unknown';
  sku: string;
  location: string;
}

/** RBAC status stub — full RBAC management requires elevated CLI perms; surfaced as informational only. */
export interface RbacStatus {
  hasContributor: boolean;
  cliCommand: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function emptySchedule(): Record<DayKey, ScheduleSlot[]> {
  return {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [],
    Friday: [], Saturday: [], Sunday: [],
  };
}

// ── API Methods ──────────────────────────────────────────────────────────────

export async function getThermostatConfig(): Promise<{ config: ThermostatConfig; etag: string }> {
  return callExtension('getConfig');
}

export async function putThermostatConfig(
  config: ThermostatConfig,
  etag: string,
): Promise<{ etag: string }> {
  return callExtension('putConfig', { config, etag });
}

export async function triggerCapacity(
  capacityId: string,
  action: ThermostatAction,
  sku?: FabricSku,
): Promise<{ jobId: string }> {
  return callExtension('triggerCapacity', { capacityId, action, sku });
}

export async function getCapacityState(capacityId: string): Promise<CapacityState> {
  return callExtension('getCapacityState', { capacityId });
}

/**
 * Returns basic RBAC info. In the Mandala context this is informational —
 * the user can run the CLI command manually if needed.
 */
export async function getRbacStatus(capacityId: string): Promise<RbacStatus> {
  // Extract the name from the ARM resource id
  const name = capacityId.split('/').pop() ?? capacityId;
  return {
    hasContributor: true, // Optimistic default; extend later via az rest if needed
    cliCommand: `az role assignment create --role Contributor --assignee <managed-identity-id> --scope ${capacityId}`,
  };
}

/**
 * Stub — grant RBAC via az CLI. Requires the user to have Owner/UAA on the resource.
 */
export async function grantRbac(capacityId: string): Promise<RbacStatus> {
  // This would need the managed identity principal ID; surfaced as guidance for now.
  return getRbacStatus(capacityId);
}

export async function listBankHolidays(division: string): Promise<{ dates: string[] }> {
  const res = await fetch('https://www.gov.uk/bank-holidays.json');
  if (!res.ok) throw new Error('Could not fetch bank holidays');
  const data = await res.json();
  const divData = data[division];
  if (!divData || !Array.isArray(divData.events)) return { dates: [] };
  return { dates: (divData.events as Array<{ date: string }>).map((e) => e.date) };
}
