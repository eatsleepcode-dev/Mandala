/**
 * ---
 * title: weeklyBands tests
 * module: ThermostatHeatmap.weeklyBands.test
 * category: Tests
 * task_id: 'F64.2'
 * sprint: '236'
 * tdd_phase: GREEN
 * ---
 */

// import { describe, it, expect } from 'vitest';
// Jest globals used automatically
import { emptySchedule, type WeeklySchedule } from '../thermostatService';
import { DAYS, weeklyBands } from './weeklyBands';

const make = (overrides: Partial<WeeklySchedule>): WeeklySchedule => ({
  ...emptySchedule(),
  ...overrides,
});

describe('weeklyBands', () => {
  it('returns one null-slot band per day for an empty schedule', () => {
    const bands = weeklyBands(emptySchedule());
    expect(bands).toHaveLength(7);
    expect(bands.every((b) => b.slot === null)).toBe(true);
    expect(bands.every((b) => b.startMin === 0 && b.endMin === 1440)).toBe(true);
    expect(bands.every((b) => b.ownerDay === null && b.ownerIdx === null)).toBe(true);
    expect(bands.map((b) => b.day)).toEqual([...DAYS]);
  });

  it('tags each band with its slot owner so drag-to-edit can find it', () => {
    const schedule = make({
      Monday: [
        { start: '08:00', action: 'Resume', sku: 'F64' },  // idx 0
        { start: '18:00', action: 'Suspend' },             // idx 1
      ],
    });
    const bands = weeklyBands(schedule);

    // before 08:00. So `ownerDay !== band.day` in this case is impossible
    // (only one day has slots); ownerDay=Monday but ownerIdx=1.
    const wrapIn = bands.find((b) => b.day === 'Monday' && b.startMin === 0);
    expect(wrapIn).toMatchObject({ ownerDay: 'Monday', ownerIdx: 1 });

    // The 08:00–18:00 band is owned by Monday slot 0.
    const morningBand = bands.find((b) => b.day === 'Monday' && b.startMin === 480);
    expect(morningBand).toMatchObject({ ownerDay: 'Monday', ownerIdx: 0 });

    // The 18:00–24:00 band is owned by Monday slot 1.
    const eveningBand = bands.find((b) => b.day === 'Monday' && b.startMin === 1080);
    expect(eveningBand).toMatchObject({ ownerDay: 'Monday', ownerIdx: 1 });

    // Tue–Sun bands inherit from the cyclic last event (Monday slot 1) and
    // their day !== ownerDay, so drag-to-edit must disable on them.
    for (const day of ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const) {
      const b = bands.find((x) => x.day === day);
      expect(b).toMatchObject({ ownerDay: 'Monday', ownerIdx: 1 });
    }
  });

  it('splits one slot per day into three bands per day with cyclic wrap', () => {
    // Monday 08:00 Resume F64, Monday 18:00 Suspend, only.
    const schedule = make({
      Monday: [
        { start: '08:00', action: 'Resume', sku: 'F64' },
        { start: '18:00', action: 'Suspend' },
      ],
    });
    const bands = weeklyBands(schedule);

    // Monday should have three bands: [0..08:00 from wrap-in (last=Suspend),
    //                                 08:00..18:00 Resume F64,
    //                                 18:00..24:00 Suspend]
    const mon = bands.filter((b) => b.day === 'Monday');
    expect(mon.map((b) => [b.startMin, b.endMin, b.slot?.action, b.slot?.sku])).toEqual([
      [0, 480, 'Suspend', undefined],
      [480, 1080, 'Resume', 'F64'],
      [1080, 1440, 'Suspend', undefined],
    ]);

    // Tue–Sun should each be one full-day band of Suspend (last event of the week).
    for (const day of ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const) {
      const dayBands = bands.filter((b) => b.day === day);
      expect(dayBands).toHaveLength(1);
      expect(dayBands[0]).toMatchObject({ startMin: 0, endMin: 1440, slot: { action: 'Suspend' } });
    }
  });

  it('wraps last-of-week back to Monday morning when Friday ends with Suspend', () => {
    const schedule = make({
      Friday: [{ start: '18:00', action: 'Suspend' }],
      Monday: [{ start: '08:00', action: 'Resume', sku: 'F64' }],
    });
    const bands = weeklyBands(schedule);

    // Monday 00:00–08:00 should reflect Friday's Suspend (carried over via wrap-in).
    const monMorning = bands.find((b) => b.day === 'Monday' && b.startMin === 0);
    expect(monMorning?.slot?.action).toBe('Suspend');

    // Monday 08:00 onwards is Resume; that Resume runs all the way until Friday 18:00.
    const monAfterEight = bands.find(
      (b) => b.day === 'Monday' && b.startMin === 480 && b.endMin === 1440,
    );
    expect(monAfterEight?.slot?.action).toBe('Resume');
    expect(monAfterEight?.slot?.sku).toBe('F64');

    // Friday 00:00–18:00 should still be Resume; 18:00–24:00 Suspend.
    const fri = bands.filter((b) => b.day === 'Friday');
    expect(fri).toEqual([
      expect.objectContaining({ startMin: 0, endMin: 1080, slot: expect.objectContaining({ action: 'Resume' }) }),
      expect.objectContaining({ startMin: 1080, endMin: 1440, slot: expect.objectContaining({ action: 'Suspend' }) }),
    ]);
  });

  it('handles multiple slots on the same day, sorted correctly', () => {
    const schedule = make({
      Monday: [
        { start: '08:00', action: 'Resume', sku: 'F64' },
        { start: '12:30', action: 'Scale', sku: 'F32' },
        { start: '13:30', action: 'Scale', sku: 'F64' },
        { start: '18:00', action: 'Suspend' },
      ],
    });
    const bands = weeklyBands(schedule);
    const mon = bands.filter((b) => b.day === 'Monday');

    // Bands should be (wrap-in Suspend), Resume F64, Scale F32, Scale F64, Suspend.
    expect(mon.map((b) => [b.startMin, b.endMin, b.slot?.action, b.slot?.sku])).toEqual([
      [0, 480, 'Suspend', undefined],
      [480, 750, 'Resume', 'F64'],
      [750, 810, 'Scale', 'F32'],
      [810, 1080, 'Scale', 'F64'],
      [1080, 1440, 'Suspend', undefined],
    ]);
  });

  it('emits no wrap-in band when the first event is at Monday 00:00', () => {
    const schedule = make({
      Monday: [{ start: '00:00', action: 'Suspend' }],
    });
    const bands = weeklyBands(schedule);
    const mon = bands.filter((b) => b.day === 'Monday');
    expect(mon).toHaveLength(1);
    expect(mon[0]).toMatchObject({ startMin: 0, endMin: 1440 });
  });
});
