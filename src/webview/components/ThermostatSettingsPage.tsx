/**
 * ---
 * title: Fabric Thermostat — Settings Page
 * module: ThermostatSettingsPage
 * category: Pages
 * task_id: 'F64.2'
 * sprint: '236'
 * tdd_phase: GREEN
 * description: >
 *   Multi-capacity weekly schedule editor for the Fabric Thermostat.
 *   Loads/saves the config blob via /api/v1/thermostat/config, lists UK
 *   bank holidays from gov.uk for awareness, and offers an on-demand
 *   trigger button per capacity.
 * ---
 */

import * as React from 'react';
import {
  makeStyles,
  Text,
  tokens,
  Card,
  Button,
  Switch,
  Dropdown,
  Option,
  Input,
  Badge,
  Divider,
  Tab,
  TabList,
  SelectTabData,
  SelectTabEvent,
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
} from '@fluentui/react-components';
import {
  Save24Regular,
  Add24Regular,
  Delete24Regular,
  PlayCircle24Regular,
  Calendar24Regular,
} from '@fluentui/react-icons';
import {
  CapacityConfig,
  CapacityState,
  DAY_KEYS,
  DayKey,
  FABRIC_SKUS,
  FabricSku,
  RbacStatus,
  ScheduleSlot,
  ThermostatAction,
  ThermostatConfig,
  emptySchedule,
  getCapacityState,
  getRbacStatus,
  getThermostatConfig,
  grantRbac,
  listBankHolidays,
  putThermostatConfig,
  triggerCapacity,
} from './thermostatService';
import { ThermostatHeatmap, slotAnchorId } from './ThermostatHeatmap';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  title: { display: 'flex', alignItems: 'center', gap: '12px' },
  toolbar: { display: 'flex', gap: '8px' },
  card: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
  fieldRow: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
  dayRow: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr auto',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  slotRow: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  // Brief flash applied after click-to-jump from the heatmap so the
  // operator's eye can pick the target row out of the day-by-day editor.
  slotRowFlash: {
    animationDuration: '1.4s',
    animationIterationCount: 1,
    animationName: {
      from:  { backgroundColor: tokens.colorPaletteBlueBackground2 },
      '50%': { backgroundColor: tokens.colorPaletteBlueBackground2 },
      to:    { backgroundColor: 'transparent' },
    },
    borderRadius: tokens.borderRadiusSmall,
  },
  bankList: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  actions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
});

const ACTIONS: ThermostatAction[] = ['Suspend', 'Resume', 'Scale'];
const BH_MODES = ['Suspend', 'UseSundaySchedule', 'Ignore'] as const;
const COMMON_TZ = ['Europe/London', 'Etc/UTC', 'America/New_York', 'Asia/Singapore'];

const sortSlots = (slots: ScheduleSlot[]): ScheduleSlot[] =>
  [...slots].sort((a, b) => a.start.localeCompare(b.start));

const blankCapacity = (id: string): CapacityConfig => ({
  id,
  displayName: id,
  subscriptionId: '',
  resourceGroup: '',
  timezone: 'Europe/London',
  enabled: true,
  respectBankHolidays: true,
  bankHolidayMode: 'Suspend',
  defaultSku: 'F2',
  schedule: emptySchedule(),
});

export const ThermostatSettingsPage: React.FC<{ onExpand?: () => void }> = ({ onExpand }) => {
  const styles = useStyles();

  const [config, setConfig] = React.useState<ThermostatConfig>({ version: 1, capacities: [] });
  const [etag, setEtag] = React.useState<string>('');
  const [activeId, setActiveId] = React.useState<string>('');
  const [bankHolidays, setBankHolidays] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [liveState, setLiveState] = React.useState<CapacityState | null>(null);
  const [liveStateError, setLiveStateError] = React.useState<string | null>(null);
  const [rbac, setRbac] = React.useState<RbacStatus | null>(null);
  const [rbacBusy, setRbacBusy] = React.useState(false);
  // Tracks the anchor that should be visually flashed after a click-to-jump
  // from the heatmap. Cleared by a timer so the highlight fades automatically.
  const [flashedAnchor, setFlashedAnchor] = React.useState<string | null>(null);

  // Load config + bank holidays on mount, and on `thermostat:refresh` events
  // dispatched from the command palette.
  React.useEffect(() => {
    let cancelled = false;
    const load = async (showSpinner: boolean): Promise<void> => {
      if (showSpinner) setLoading(true);
      try {
        const [{ config: c, etag: e }, bh] = await Promise.all([
          getThermostatConfig(),
          listBankHolidays('england-and-wales').catch(() => ({ dates: [] as string[] })),
        ]);
        if (cancelled) return;
        setConfig(c);
        setEtag(e);
        setBankHolidays(bh.dates);
        setActiveId((prev) => prev || c.capacities[0]?.id || '');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    };
    void load(true);
    const onRefresh = (): void => { void load(false); };
    window.addEventListener('thermostat:refresh', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('thermostat:refresh', onRefresh);
    };
  }, []);

  const activeCap = config.capacities.find((c) => c.id === activeId);

  // Live state polling — every 30s while a capacity is active. Resets when
  // the user switches tabs.
  React.useEffect(() => {
    if (!activeId) { setLiveState(null); setLiveStateError(null); setRbac(null); return; }
    let cancelled = false;
    const refresh = (): void => {
      getCapacityState(activeId)
        .then((s) => { if (!cancelled) { setLiveState(s); setLiveStateError(null); } })
        .catch((e) => { if (!cancelled) setLiveStateError(e instanceof Error ? e.message : String(e)); });
    };
    const refreshRbac = (): void => {
      getRbacStatus(activeId)
        .then((r) => { if (!cancelled) setRbac(r); })
        .catch(() => { if (!cancelled) setRbac(null); });
    };
    refresh();
    refreshRbac();
    const handle = window.setInterval(refresh, 30_000);
    return () => { cancelled = true; window.clearInterval(handle); };
  }, [activeId]);

  const tryGrantRbac = async (): Promise<void> => {
    if (!activeCap) return;
    setRbacBusy(true);
    try {
      const r = await grantRbac(activeCap.id);
      setRbac(r);
      setStatus('Contributor role granted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRbacBusy(false);
    }
  };

  // Click on a heatmap band → scroll the matching slot row into view and
  // flash it briefly. The band carries (day, slot.start), so we locate the
  // slot index in the current schedule. If the slot was already removed
  // (rare race) we silently skip.
  const jumpToSlot = React.useCallback(
    (day: DayKey, slot: ScheduleSlot): void => {
      if (!activeCap) return;
      const idx = activeCap.schedule[day].findIndex((s) => s.start === slot.start);
      if (idx < 0) return;
      const anchor = slotAnchorId(day, idx);
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashedAnchor(anchor);
      window.setTimeout(() => {
        setFlashedAnchor((cur) => (cur === anchor ? null : cur));
      }, 1500);
    },
    [activeCap],
  );

  const updateCap = (next: CapacityConfig): void => {
    setConfig((prev) => ({
      ...prev,
      capacities: prev.capacities.map((c) => (c.id === next.id ? next : c)),
    }));
  };

  const addCapacity = (): void => {
    const id = window.prompt('New Fabric capacity name (must match the Azure resource name):')?.trim();
    if (!id) return;
    if (config.capacities.some((c) => c.id === id)) {
      setError(`A capacity with id '${id}' already exists.`);
      return;
    }
    const next = { ...config, capacities: [...config.capacities, blankCapacity(id)] };
    setConfig(next);
    setActiveId(id);
  };

  const removeCapacity = (id: string): void => {
    if (!window.confirm(`Remove capacity '${id}' from the thermostat config?`)) return;
    const next = { ...config, capacities: config.capacities.filter((c) => c.id !== id) };
    setConfig(next);
    if (activeId === id) setActiveId(next.capacities[0]?.id ?? '');
  };

  const addSlot = (day: DayKey): void => {
    if (!activeCap) return;
    const slot: ScheduleSlot = { start: '09:00', action: 'Resume', sku: activeCap.defaultSku };
    updateCap({
      ...activeCap,
      schedule: { ...activeCap.schedule, [day]: sortSlots([...activeCap.schedule[day], slot]) },
    });
  };

  const updateSlot = (day: DayKey, idx: number, patch: Partial<ScheduleSlot>): void => {
    if (!activeCap) return;
    const slots = activeCap.schedule[day].map((s, i) => (i === idx ? { ...s, ...patch } : s));
    updateCap({ ...activeCap, schedule: { ...activeCap.schedule, [day]: sortSlots(slots) } });
  };

  // Alt-drag insert handler: create a new slot on `day` at `newStart` with
  // the given action. The SKU defaults to the capacity's defaultSku for
  // Resume/Scale; Suspend slots carry no SKU.
  const insertSlot = (day: DayKey, newStart: string, action: ThermostatAction): void => {
    if (!activeCap) return;
    const slot: ScheduleSlot = action === 'Suspend'
      ? { start: newStart, action }
      : { start: newStart, action, sku: activeCap.defaultSku };
    const existing = activeCap.schedule[day].filter((s) => s.start !== newStart);
    updateCap({
      ...activeCap,
      schedule: { ...activeCap.schedule, [day]: sortSlots([...existing, slot]) },
    });
  };

  // Cross-day drag handler: remove the slot from its source day and insert it
  // on the destination day at the released start. sortSlots keeps the new
  // day's array ordered by `start`. If a same-time collision occurs on the
  // destination, the inserted slot wins and the colliding slot is dropped
  // (rare in practice given the 15-min drag snap + clamping).
  const moveSlotToDay = (
    srcDay: DayKey,
    slotIdx: number,
    dstDay: DayKey,
    newStart: string,
  ): void => {
    if (!activeCap) return;
    if (srcDay === dstDay) {
      updateSlot(srcDay, slotIdx, { start: newStart });
      return;
    }
    const slot = activeCap.schedule[srcDay][slotIdx];
    if (!slot) return;
    const moved: ScheduleSlot = { ...slot, start: newStart };
    const srcSlots = activeCap.schedule[srcDay].filter((_, i) => i !== slotIdx);
    const dstSlots = sortSlots([
      ...activeCap.schedule[dstDay].filter((s) => s.start !== newStart),
      moved,
    ]);
    updateCap({
      ...activeCap,
      schedule: { ...activeCap.schedule, [srcDay]: srcSlots, [dstDay]: dstSlots },
    });
  };

  const removeSlot = (day: DayKey, idx: number): void => {
    if (!activeCap) return;
    updateCap({
      ...activeCap,
      schedule: {
        ...activeCap.schedule,
        [day]: activeCap.schedule[day].filter((_, i) => i !== idx),
      },
    });
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const { etag: newEtag } = await putThermostatConfig(config, etag);
      setEtag(newEtag);
      setStatus('Saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const fireNow = async (action: ThermostatAction, sku?: FabricSku): Promise<void> => {
    if (!activeCap) return;
    setStatus(null);
    setError(null);
    try {
      const r = await triggerCapacity(activeCap.id, action, sku);
      setStatus(`${action} job started${r.jobId ? ` (jobId=${r.jobId})` : ''}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <div className={styles.root}><Spinner label="Loading thermostat config…" /></div>;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>
          <Calendar24Regular />
          <Text size={600} weight="semibold">Fabric Thermostat</Text>
          <Badge appearance="tint">{config.capacities.length} capacity(ies)</Badge>
        </div>
        <div className={styles.toolbar}>
            {onExpand && (
              <Button
                icon={<span className="codicon codicon-screen-full" />}
                title="Open in main editor tab"
                onClick={onExpand}
              >
                Expand
              </Button>
            )}
            <Button
            appearance="primary"
            icon={<Save24Regular />}
            disabled={saving}
            onClick={() => { void save(); }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody><MessageBarTitle>Error</MessageBarTitle> {error}</MessageBarBody>
        </MessageBar>
      )}
      {status && (
        <MessageBar intent="success"><MessageBarBody>{status}</MessageBarBody></MessageBar>
      )}

      {config.capacities.length === 0 ? (
        <Card className={styles.card}>
          <Text>
            No capacities configured. Click <strong>Add capacity</strong> to start — the id must
            match the Microsoft.Fabric/capacities resource name in Azure.
          </Text>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
            <Dropdown
              value={activeCap?.displayName || activeId || 'Select a capacity'}
              selectedOptions={[activeId]}
              onOptionSelect={(_e, data) => setActiveId(data.optionValue as string)}
              style={{ minWidth: '300px' }}
            >
              {config.capacities.map((c) => (
                <Option key={c.id} value={c.id}>{c.displayName || c.id}</Option>
              ))}
            </Dropdown>
            <Button icon={<Add24Regular />} onClick={addCapacity}>Add capacity</Button>
          </div>

          {activeCap && (
            <>
              <Card className={styles.card}>
                <div className={styles.slotRow}>
                  <Text weight="semibold">Live state:</Text>
                  {liveState?.state ? (
                    <Badge
                      appearance="filled"
                      color={liveState.state === 'Active' ? 'success' : liveState.state === 'Paused' ? 'warning' : 'informative'}
                    >
                      {liveState.state}
                    </Badge>
                  ) : (
                    <Badge appearance="outline">unknown</Badge>
                  )}
                  {liveState?.sku && <Badge appearance="tint">SKU {liveState.sku}</Badge>}
                  {liveState?.location && (
                    <Text size={200} italic>{liveState.location}</Text>
                  )}
                  <Text size={200} italic>auto-refreshes every 30s</Text>
                  {liveStateError && (
                    <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                      ({liveStateError})
                    </Text>
                  )}
                </div>
                {rbac && !rbac.hasContributor && (
                  <MessageBar intent="warning">
                    <MessageBarBody>
                      <MessageBarTitle>RBAC missing.</MessageBarTitle>
                      &nbsp;The thermostat managed identity does not have
                      Contributor on this capacity, so scheduled actions will
                      fail. Either run the CLI command below, or click
                      <strong> Grant Contributor</strong> if the agent service
                      has permission to write role assignments.
                      <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{rbac.cliCommand}</pre>
                      <Button
                        appearance="primary"
                        disabled={rbacBusy}
                        onClick={() => { void tryGrantRbac(); }}
                      >
                        {rbacBusy ? 'Granting…' : 'Grant Contributor'}
                      </Button>
                    </MessageBarBody>
                  </MessageBar>
                )}
                {rbac && rbac.hasContributor && (
                  <MessageBar intent="success">
                    <MessageBarBody>
                      RBAC OK — Automation MI has Contributor on this capacity.
                    </MessageBarBody>
                  </MessageBar>
                )}
              </Card>

              <Card className={styles.card}>
                <Text weight="semibold">Capacity details</Text>
                <div className={styles.fieldRow}>
                  <Field label="Display name">
                    <Input
                      value={activeCap.displayName}
                      onChange={(_: unknown, d: { value: string }) => updateCap({ ...activeCap, displayName: d.value })}
                    />
                  </Field>
                  <Field label="Resource id (Azure name)">
                    <Input value={activeCap.id} disabled />
                  </Field>
                  <Field label="Subscription id">
                    <Input
                      value={activeCap.subscriptionId}
                      onChange={(_: unknown, d: { value: string }) => updateCap({ ...activeCap, subscriptionId: d.value })}
                    />
                  </Field>
                  <Field label="Resource group">
                    <Input
                      value={activeCap.resourceGroup}
                      onChange={(_: unknown, d: { value: string }) => updateCap({ ...activeCap, resourceGroup: d.value })}
                    />
                  </Field>
                  <Field label="Time zone (handles BST/GMT automatically)">
                    <Dropdown
                      value={activeCap.timezone}
                      selectedOptions={[activeCap.timezone]}
                      onOptionSelect={(_: unknown, d: { optionValue?: string }) =>
                        updateCap({ ...activeCap, timezone: String(d.optionValue ?? activeCap.timezone) })
                      }
                    >
                      {COMMON_TZ.map((tz) => <Option key={tz} value={tz}>{tz}</Option>)}
                    </Dropdown>
                  </Field>
                  <Field label="Bank holiday mode">
                    <Dropdown
                      value={activeCap.bankHolidayMode}
                      selectedOptions={[activeCap.bankHolidayMode]}
                      onOptionSelect={(_: unknown, d: { optionValue?: string }) =>
                        updateCap({
                          ...activeCap,
                          bankHolidayMode: (d.optionValue ?? 'Suspend') as CapacityConfig['bankHolidayMode'],
                        })
                      }
                    >
                      {BH_MODES.map((m) => <Option key={m} value={m}>{m}</Option>)}
                    </Dropdown>
                  </Field>
                  <Field label="Default Resume SKU (used by on-demand Resume)">
                    <Dropdown
                      value={activeCap.defaultSku}
                      selectedOptions={[activeCap.defaultSku]}
                      onOptionSelect={(_: unknown, d: { optionValue?: string }) =>
                        updateCap({
                          ...activeCap,
                          defaultSku: (d.optionValue ?? 'F2') as FabricSku,
                        })
                      }
                    >
                      {FABRIC_SKUS.map((s) => <Option key={s} value={s}>{s}</Option>)}
                    </Dropdown>
                  </Field>
                </div>
                <div className={styles.slotRow}>
                  <Switch
                    label="Enabled"
                    checked={activeCap.enabled}
                    onChange={(_: unknown, d: { checked: boolean }) => updateCap({ ...activeCap, enabled: d.checked })}
                  />
                  <Switch
                    label="Respect UK bank holidays"
                    checked={activeCap.respectBankHolidays}
                    onChange={(_: unknown, d: { checked: boolean }) => updateCap({ ...activeCap, respectBankHolidays: d.checked })}
                  />
                  <Button
                    appearance="subtle"
                    icon={<Delete24Regular />}
                    onClick={() => removeCapacity(activeCap.id)}
                  >
                    Remove capacity
                  </Button>
                </div>
                <Divider />
                <div className={styles.slotRow}>
                  <Text weight="semibold">On-demand:</Text>
                  {(() => {
                    const isScaleNeeded = liveState?.state === 'Active' && liveState.sku && liveState.sku !== activeCap.defaultSku;
                    if (isScaleNeeded) {
                      return (
                        <Button icon={<PlayCircle24Regular />} onClick={() => { void fireNow('Scale', activeCap.defaultSku as FabricSku); }}>
                          Scale now ({activeCap.defaultSku})
                        </Button>
                      );
                    }
                    if (liveState?.state === 'Active') {
                      return (
                        <Button icon={<PlayCircle24Regular />} onClick={() => { void fireNow('Suspend'); }}>
                          Suspend now
                        </Button>
                      );
                    }
                    return (
                      <Button icon={<PlayCircle24Regular />} onClick={() => { void fireNow('Resume', activeCap.defaultSku as FabricSku); }}>
                        Resume now ({activeCap.defaultSku})
                      </Button>
                    );
                  })()}
                </div>
              </Card>

              <Card className={styles.card}>
                <Text weight="semibold">Weekly heatmap</Text>
                <Text size={200}>
                  Each band shows the slot active at that time. Colour intensity
                  scales with SKU size (grey = Suspend). The red dotted line
                  is "now" in the capacity's local TZ; diagonal hatching
                  flags days that fall on a UK bank holiday in the next 7 days.
                </Text>
                <ThermostatHeatmap
                  capacity={activeCap}
                  bankHolidayDates={bankHolidays}
                  onSlotClick={jumpToSlot}
                  onSlotMove={(day, slotIdx, newStart) =>
                    updateSlot(day, slotIdx, { start: newStart })
                  }
                  onSlotMoveDay={moveSlotToDay}
                  onSlotInsert={insertSlot}
                />
              </Card>

              <Card className={styles.card}>
                <Text weight="semibold">Weekly schedule</Text>
                <Text size={200}>
                  Each row lists slots for that day. The tick runbook applies the
                  <em> most recent slot whose start ≤ now</em>. Bank holidays override
                  per the mode above.
                </Text>
                {DAY_KEYS.map((day) => (
                  <div key={day} className={styles.dayRow}>
                    <Text weight="semibold" style={{ textTransform: 'capitalize' }}>{day}</Text>
                    <div className={styles.slotRow}>
                      {activeCap.schedule[day].length === 0 && (
                        <Text size={200} italic>No slots — capacity left as-is on {day}s.</Text>
                      )}
                      {activeCap.schedule[day].map((slot, idx) => {
                        const anchor = slotAnchorId(day, idx);
                        const flashClass = flashedAnchor === anchor ? ` ${styles.slotRowFlash}` : '';
                        return (
                        <div
                          key={idx}
                          id={anchor}
                          className={`${styles.slotRow}${flashClass}`}
                        >
                          <Input
                            type="time"
                            value={slot.start}
                            onChange={(_: unknown, d: { value: string }) => updateSlot(day, idx, { start: d.value })}
                            style={{ width: '110px' }}
                          />
                          <Dropdown
                            value={slot.action}
                            selectedOptions={[slot.action]}
                            onOptionSelect={(_: unknown, d: { optionValue?: string }) =>
                              updateSlot(day, idx, { action: (d.optionValue ?? 'Suspend') as ThermostatAction })
                            }
                            style={{ minWidth: '120px' }}
                          >
                            {ACTIONS.map((a) => <Option key={a} value={a}>{a}</Option>)}
                          </Dropdown>
                          {slot.action !== 'Suspend' && (
                            <Dropdown
                              value={slot.sku ?? ''}
                              selectedOptions={slot.sku ? [slot.sku] : []}
                              onOptionSelect={(_: unknown, d: { optionValue?: string }) =>
                                updateSlot(day, idx, { sku: (d.optionValue ?? undefined) as FabricSku | undefined })
                              }
                              style={{ minWidth: '110px' }}
                            >
                              {FABRIC_SKUS.map((s) => <Option key={s} value={s}>{s}</Option>)}
                            </Dropdown>
                          )}
                          <Button
                            appearance="subtle"
                            icon={<Delete24Regular />}
                            onClick={() => removeSlot(day, idx)}
                          />
                        </div>
                        );
                      })}
                    </div>
                    <Button icon={<Add24Regular />} size="small" onClick={() => addSlot(day)}>
                      Add slot
                    </Button>
                  </div>
                ))}
              </Card>

              {bankHolidays.length > 0 && (
                <Card className={styles.card}>
                  <Text weight="semibold">UK bank holidays (England &amp; Wales)</Text>
                  <Text size={200}>Source: gov.uk/bank-holidays.json. Updated hourly.</Text>
                  <div className={styles.bankList}>
                    {bankHolidays.slice(0, 16).map((d) => (
                      <Badge key={d} appearance="outline">{d}</Badge>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
