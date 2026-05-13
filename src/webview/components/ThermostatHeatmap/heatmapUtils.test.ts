/**
 * ---
 * title: heatmapUtils tests
 * module: ThermostatHeatmap.heatmapUtils.test
 * category: Tests
 * task_id: 'F64.2'
 * sprint: '236'
 * tdd_phase: GREEN
 * description: >
 *   Unit tests for the pure helpers that power the heatmap's drag, jump,
 *   and insert gestures. RED-then-GREEN cycle: helpers were added in
 *   response to these tests, not the other way round.
 * ---
 */

import { describe, expect, it } from 'vitest';

import {
  DRAG_SNAP_MIN,
  clampStartMin,
  minToHHMM,
  oppositeAction,
  parseHHMM,
  rowIdxFromY,
  slotAnchorId,
} from './heatmapUtils';

describe('parseHHMM / minToHHMM', () => {
  it('round-trips canonical times', () => {
    for (const s of ['00:00', '00:15', '08:30', '12:00', '23:45']) {
      expect(minToHHMM(parseHHMM(s))).toBe(s);
    }
  });
});

describe('clampStartMin', () => {
  it('snaps to DRAG_SNAP_MIN', () => {
    expect(clampStartMin(517, null, null)).toBe(525); // round to nearest 15
    expect(clampStartMin(514, null, null)).toBe(510);
  });

  it('clamps above prev.start + snap', () => {
    // Prev slot starts at 08:00 (480). Cursor wants 08:05.
    // Floor must be 08:00 + 15 = 08:15 (495).
    expect(clampStartMin(485, 480, 1080)).toBe(495);
  });

  it('clamps below next.start - snap', () => {
    // Next slot starts at 18:00 (1080). Cursor wants 17:58.
    // Ceiling must be 18:00 - 15 = 17:45 (1065).
    expect(clampStartMin(1078, 480, 1080)).toBe(1065);
  });

  it('uses 0 as the lower bound when no prev slot', () => {
    expect(clampStartMin(-30, null, 480)).toBe(0);
  });

  it('uses 1440 as the upper bound when no next slot', () => {
    expect(clampStartMin(1500, 1080, null)).toBe(1440);
  });

  it('treats DRAG_SNAP_MIN as 15', () => {
    // Sanity-check the snap constant didn't drift.
    expect(DRAG_SNAP_MIN).toBe(15);
  });
});

describe('rowIdxFromY', () => {
  // Mirror the heatmap layout: PAD_TOP=28, ROW_HEIGHT=36, ROW_GAP=4.
  const PAD = 28;
  const RH = 36;
  const GAP = 4;

  it('returns the correct row inside the row band', () => {
    expect(rowIdxFromY(PAD + 1, PAD, RH, GAP)).toBe(0);                       // Mon
    expect(rowIdxFromY(PAD + RH + GAP + 1, PAD, RH, GAP)).toBe(1);            // Tue
    expect(rowIdxFromY(PAD + 6 * (RH + GAP) + RH - 1, PAD, RH, GAP)).toBe(6); // Sun
  });

  it('returns -1 above the first row', () => {
    expect(rowIdxFromY(PAD - 5, PAD, RH, GAP)).toBe(-1);
  });

  it('returns -1 below the last row', () => {
    expect(rowIdxFromY(PAD + 7 * (RH + GAP), PAD, RH, GAP)).toBe(-1);
  });

  it('returns -1 inside the gap between rows', () => {
    expect(rowIdxFromY(PAD + RH + GAP / 2, PAD, RH, GAP)).toBe(-1);
  });
});

describe('slotAnchorId', () => {
  it('returns a stable, DOM-safe id', () => {
    expect(slotAnchorId('monday', 0)).toBe('thermostat-slot-monday-0');
    expect(slotAnchorId('sunday', 12)).toBe('thermostat-slot-sunday-12');
  });
});

describe('oppositeAction', () => {
  it('toggles Suspend <-> Resume', () => {
    expect(oppositeAction('Suspend')).toBe('Resume');
    expect(oppositeAction('Resume')).toBe('Suspend');
  });

  it('defaults Scale to its safer counterpart (Suspend)', () => {
    // Inserting next to a Scale slot — the new slot becomes Suspend, so
    // the gesture creates a visible transition rather than a duplicate.
    expect(oppositeAction('Scale')).toBe('Suspend');
  });
});
