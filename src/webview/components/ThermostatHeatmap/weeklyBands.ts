/**
 * ---
 * title: Weekly band computation for the Fabric Thermostat heatmap
 * module: ThermostatHeatmap.weeklyBands
 * category: Components
 * task_id: 'F64.2'
 * sprint: '236'
 * tdd_phase: GREEN
 * description: >
 *   Pure function that converts a WeeklySchedule into a flat list of
 *   per-day bands suitable for SVG rendering. Implements the
 *   "single-time-per-slot, cyclic wrap-around" semantic the runbook
 *   uses: each slot is active from its start time until the next
 *   slot's start time (or the next slot in the following week, if
 *   today's slots are exhausted).
 * ---
 */

import type {
  DayKey,
  ScheduleSlot,
  WeeklySchedule,
} from '../thermostatService';

export const DAYS: readonly DayKey[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

/** One contiguous coloured rectangle on the heatmap (clipped to a single day row). */
export interface Band {
  day: DayKey;
  /** Minutes from local midnight on `day`, 0..1440. */
  startMin: number;
  /** Minutes from local midnight on `day`, 1..1440. */
  endMin: number;
  /** The slot active during this band, or null if the whole week is empty. */
  slot: ScheduleSlot | null;
  /** The day on which this band's slot is defined. May differ from `day`
   *  when the slot wraps in from a prior day (e.g. Friday 18:00 Suspend
   *  rendered on Monday morning). null only for the empty-schedule case. */
  ownerDay: DayKey | null;
  /** Index of this band's slot within `schedule[ownerDay]`. Null only for
   *  the empty-schedule case. Drag-to-edit consumers use this to map a
   *  band back to the slot to mutate. */
  ownerIdx: number | null;
}

const WEEK_MIN = 7 * 1440;

const parseMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

interface AbsEvent {
  /** Minutes since Monday 00:00 in the capacity's local TZ, 0..WEEK_MIN. */
  absMin: number;
  slot: ScheduleSlot;
  ownerDay: DayKey;
  ownerIdx: number;
}

/**
 * Convert a weekly schedule into per-day bands.
 *
 * Semantics (mirroring the tick runbook):
 *   * Each slot is active from `start` until the next slot's `start`.
 *   * The week is cyclic: if a day has no slots that have fired yet, the
 *     band inherits the most recent prior slot (which may be on a previous
 *     day, including last week's Friday on a Monday morning).
 *   * If the whole schedule is empty, a single per-day band with slot=null
 *     is returned per day so the heatmap can render placeholder rows.
 */
export const weeklyBands = (schedule: WeeklySchedule): Band[] => {
  // 1. Flatten slots into absolute-minute events on the Monday-00:00 grid.
  // Preserves each slot's owner (day + index) so bands can later be mapped
  // back to a specific schedule entry for drag-to-edit.
  const events: AbsEvent[] = [];
  DAYS.forEach((day, dayIdx) => {
    schedule[day].forEach((slot: ScheduleSlot, idx: number) => {
      events.push({
        absMin: dayIdx * 1440 + parseMin(slot.start),
        slot,
        ownerDay: day,
        ownerIdx: idx,
      });
    });
  });
  events.sort((a, b) => a.absMin - b.absMin);

  // Empty schedule → one empty band per day so the renderer still draws rows.
  if (events.length === 0) {
    return DAYS.map((day) => ({
      day, startMin: 0, endMin: 1440, slot: null, ownerDay: null, ownerIdx: null,
    }));
  }

  // 2. Compute absolute-minute segments. Wrap-in: the last event of the
  // week carries over from minute 0 to the first event of the week.
  type Seg = { from: number; to: number; slot: ScheduleSlot; ownerDay: DayKey; ownerIdx: number };
  const segments: Seg[] = [];
  const first = events[0];
  const last = events[events.length - 1];
  if (first.absMin > 0) {
    segments.push({
      from: 0, to: first.absMin,
      slot: last.slot, ownerDay: last.ownerDay, ownerIdx: last.ownerIdx,
    });
  }
  for (let i = 0; i < events.length; i++) {
    const cur = events[i];
    const to = i < events.length - 1 ? events[i + 1].absMin : WEEK_MIN;
    if (to > cur.absMin) {
      segments.push({
        from: cur.absMin, to,
        slot: cur.slot, ownerDay: cur.ownerDay, ownerIdx: cur.ownerIdx,
      });
    }
  }

  // 3. Split each segment by day boundaries → Band[].
  const bands: Band[] = [];
  for (const seg of segments) {
    let cursor = seg.from;
    while (cursor < seg.to) {
      const dayIdx = Math.floor(cursor / 1440);
      const nextDayBoundary = (dayIdx + 1) * 1440;
      const segmentEnd = Math.min(seg.to, nextDayBoundary);
      bands.push({
        day: DAYS[dayIdx],
        startMin: cursor - dayIdx * 1440,
        endMin: segmentEnd - dayIdx * 1440,
        slot: seg.slot,
        ownerDay: seg.ownerDay,
        ownerIdx: seg.ownerIdx,
      });
      cursor = segmentEnd;
    }
  }

  return bands;
};
