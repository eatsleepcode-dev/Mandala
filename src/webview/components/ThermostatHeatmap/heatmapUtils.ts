/**
 * ---
 * title: Pure utilities for the Fabric Thermostat heatmap
 * module: ThermostatHeatmap.heatmapUtils
 * category: Components
 * task_id: 'F64.2'
 * sprint: '236'
 * tdd_phase: GREEN
 * description: >
 *   Side-effect-free helpers used by the SVG heatmap component. Kept in
 *   their own module so each function can be exercised by vitest without
 *   bringing in React or the DOM. New helpers (drag bounds, row hit-test,
 *   anchor ids, opposite-action) land in subsequent TDD commits.
 * ---
 */

import type { ThermostatAction, DayKey } from '../thermostatService';

/** Snap increment (minutes) for drag-to-edit. */
export const DRAG_SNAP_MIN = 15;

/** Parse 'HH:mm' → minutes since local midnight, 0..1440. */
export const parseHHMM = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

/** Format minutes-since-local-midnight as 'HH:mm'. */
export const minToHHMM = (m: number): string => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/**
 * Snap and clamp a candidate slot start (minutes-since-midnight) so it
 * sits strictly between its neighbouring slots — preserving day-order
 * during a drag gesture without ever swapping indices.
 *
 * `prevStartMin` / `nextStartMin` are the neighbouring slots' starts in
 * the same day, or `null` if there is no neighbour on that side.
 */
export const clampStartMin = (
  raw: number,
  prevStartMin: number | null,
  nextStartMin: number | null,
  snap: number = DRAG_SNAP_MIN,
): number => {
  const snapped = Math.round(raw / snap) * snap;
  const lower = prevStartMin == null ? 0 : prevStartMin + snap;
  const upper = nextStartMin == null ? 1440 : nextStartMin - snap;
  return Math.max(lower, Math.min(upper, snapped));
};

/**
 * Hit-test a Y coordinate (in SVG viewBox units) against the seven
 * day-row strips. Returns the row index 0..6 (Mon..Sun) or -1 if the
 * Y lands above the strips, below them, or in the gap between rows.
 *
 * Kept pure so the cross-day drop logic can be unit-tested without
 * mounting the SVG.
 */
export const rowIdxFromY = (
  yInViewBox: number,
  padTop: number,
  rowHeight: number,
  rowGap: number,
): number => {
  const offset = yInViewBox - padTop;
  if (offset < 0) return -1;
  const stride = rowHeight + rowGap;
  const idx = Math.floor(offset / stride);
  if (idx < 0 || idx > 6) return -1;
  const inRow = offset - idx * stride;
  if (inRow > rowHeight) return -1; // landed in the gap
  return idx;
};

/**
 * Deterministic DOM id for a given (day, slotIdx). Used by the editor
 * to mark slot rows so the heatmap's click-to-jump gesture can scroll
 * to the corresponding row via `scrollIntoView`.
 */
export const slotAnchorId = (day: DayKey, idx: number): string =>
  `thermostat-slot-${day}-${idx}`;

/**
 * Choose the action for a slot inserted *next to* an existing one.
 * The goal is to produce a visible transition (Suspend ↔ Resume) so the
 * insert gesture has a meaningful effect on the heatmap. Scale collapses
 * to Suspend — the operator can change it afterwards.
 */
export const oppositeAction = (a: ThermostatAction): ThermostatAction => {
  if (a === 'Resume') return 'Suspend';
  if (a === 'Suspend') return 'Resume';
  return 'Suspend';
};

// Re-exported for the test file's convenience.
export type { ThermostatAction, DayKey };
