/**
 * ---
 * title: Fabric Thermostat — Weekly Heatmap
 * module: ThermostatHeatmap
 * category: Components
 * task_id: 'F64.2'
 * sprint: '236'
 * tdd_phase: GREEN
 * description: >
 *   SVG-based weekly schedule visualisation. 7 day-rows × 24h timeline,
 *   coloured bands per slot using a stepped heat ramp keyed to Fabric
 *   SKU size (grey Suspend → pale yellow F2 → deep red F2048). Vertical
 *   "now" line in the capacity's local TZ updates every minute. Bank
 *   holidays in the next 7 days are overlaid with diagonal hatching.
 *   Hover a band for a tooltip; click a band to fire onSlotClick(day, slot).
 * ---
 */

import * as React from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';

import type {
  CapacityConfig,
  FabricSku,
  ScheduleSlot,
  ThermostatAction,
} from '../thermostatService';
import { Band, DAYS, weeklyBands } from './weeklyBands';
import {
  clampStartMin,
  minToHHMM,
  oppositeAction,
  parseHHMM,
  rowIdxFromY,
} from './heatmapUtils';

// ── Heat ramp ────────────────────────────────────────────────────────────────
const SUSPEND_COLOR = '#6B7280'; // slate-500
const SUSPEND_TEXT = '#FFFFFF';
const EMPTY_COLOR = '#F3F4F6'; // gray-100

const SKU_COLORS: Record<FabricSku, string> = {
  F2:    '#FEF3C7', // amber-100
  F4:    '#FDE68A', // amber-200
  F8:    '#FCD34D', // amber-300
  F16:   '#FBBF24', // amber-400
  F32:   '#F59E0B', // amber-500
  F64:   '#EA580C', // orange-600
  F128:  '#DC2626', // red-600
  F256:  '#B91C1C', // red-700
  F512:  '#991B1B', // red-800
  F1024: '#7F1D1D', // red-900
  F2048: '#450A0A', // red-950
};

// White text below this band fill, dark text above.
const LIGHT_SKUS: ReadonlySet<FabricSku> = new Set(['F2', 'F4', 'F8']);

const bandFill = (slot: ScheduleSlot | null): string => {
  if (!slot) return EMPTY_COLOR;
  if (slot.action === 'Suspend') return SUSPEND_COLOR;
  if (slot.sku) return SKU_COLORS[slot.sku as FabricSku] ?? SUSPEND_COLOR;
  return SUSPEND_COLOR;
};

const bandTextColor = (slot: ScheduleSlot | null): string => {
  if (!slot) return tokens.colorNeutralForeground3;
  if (slot.action === 'Suspend') return SUSPEND_TEXT;
  if (slot.sku && LIGHT_SKUS.has(slot.sku as FabricSku)) return '#1F2937'; // gray-800
  return '#FFFFFF';
};

const bandLabel = (slot: ScheduleSlot | null): string => {
  if (!slot) return '';
  if (slot.action === 'Suspend') return '⏸';
  if (slot.action === 'Resume') return slot.sku ? `▶ ${slot.sku}` : '▶';
  if (slot.action === 'Scale') return slot.sku ? `⇅ ${slot.sku}` : '⇅';
  return '';
};

const formatTooltip = (band: Band): string => {
  if (!band.slot) return `${band.day} — no schedule`;
  const start = `${String(Math.floor(band.startMin / 60)).padStart(2, '0')}:${String(band.startMin % 60).padStart(2, '0')}`;
  const end = band.endMin === 1440
    ? '24:00'
    : `${String(Math.floor(band.endMin / 60)).padStart(2, '0')}:${String(band.endMin % 60).padStart(2, '0')}`;
  const dur = band.endMin - band.startMin;
  const sku = band.slot.sku ? ` ${band.slot.sku}` : '';
  return `${band.day} ${start}–${end} · ${band.slot.action}${sku} · ${dur} min`;
};

// ── Layout constants ────────────────────────────────────────────────────────
const PAD_LEFT = 90;
const PAD_TOP = 28;
const PAD_BOTTOM = 18;
const ROW_HEIGHT = 36;
const ROW_GAP = 4;
const HOUR_WIDTH = 30;
const WIDTH = PAD_LEFT + 24 * HOUR_WIDTH + 12;
const HEIGHT = PAD_TOP + 7 * (ROW_HEIGHT + ROW_GAP) + PAD_BOTTOM;

const minToX = (m: number): number => PAD_LEFT + (m / 60) * HOUR_WIDTH;

// ── Styles ──────────────────────────────────────────────────────────────────
const useStyles = makeStyles({
  root: {
    width: '100%',
    overflowX: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
  legendRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
    padding: '8px 12px',
    fontSize: tokens.fontSizeBase200,
  },
  legendSwatch: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    borderRadius: '3px',
    marginRight: '4px',
    verticalAlign: 'middle',
  },
});

// ── Component ───────────────────────────────────────────────────────────────
export interface ThermostatHeatmapProps {
  capacity: CapacityConfig;
  bankHolidayDates?: readonly string[]; // 'yyyy-MM-dd'
  onSlotClick?: (day: typeof DAYS[number], slot: ScheduleSlot) => void;
  /** Called when the user drags a band to a new start time within the
   *  same day. The handler should mutate the schedule (typically
   *  `updateSlot(day, idx, { start })`). Drag is disabled when this prop
   *  is omitted. */
  onSlotMove?: (day: typeof DAYS[number], slotIdx: number, newStart: string) => void;
  /** Called when the user drags a band onto a different day's row. The
   *  handler should remove the slot from `srcDay` and add it on `dstDay`
   *  at `newStart`. When omitted, cross-day drags fall back to a same-day
   *  move (i.e. the gesture is silently ignored in the row axis). */
  onSlotMoveDay?: (
    srcDay: typeof DAYS[number],
    slotIdx: number,
    dstDay: typeof DAYS[number],
    newStart: string,
  ) => void;
  /** Called when the user **Alt-drags** a band to a release point. The
   *  handler should insert a NEW slot at `newStart` on `day` with the
   *  given action (selected via {@link oppositeAction} from the source
   *  band so the insert creates a visible transition). Omit to disable
   *  the insert gesture; Alt-drag then falls back to a regular move. */
  onSlotInsert?: (
    day: typeof DAYS[number],
    newStart: string,
    action: ThermostatAction,
  ) => void;
}

type DragMode = 'move' | 'insert';

interface DragState {
  mode: DragMode;
  day: typeof DAYS[number];
  slotIdx: number;
  grabMin: number;       // minute under the pointer at pointerdown
  originStart: number;   // slot's start at pointerdown
  previewStart: number;  // current preview (snapped, clamped)
  originRowIdx: number;  // row the drag started in (0..6, Mon=0)
  previewRowIdx: number; // row the pointer is currently over
  /** Action chosen for an insert gesture (locked in at pointerdown so a
   *  modifier flip mid-drag doesn't yank the visual style). */
  insertAction: ThermostatAction;
}

export const ThermostatHeatmap: React.FC<ThermostatHeatmapProps> = ({
  capacity,
  bankHolidayDates = [],
  onSlotClick,
  onSlotMove,
  onSlotMoveDay,
  onSlotInsert,
}) => {
  const styles = useStyles();
  // Per-instance unique id for the hatch <pattern>, so multiple heatmaps
  // on the same page don't collide on a hard-coded "bankHolidayHatch" id.
  const hatchId = React.useId();
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);

  // Local "now" in the capacity's timezone, ticked every minute.
  const [now, setNow] = React.useState<Date>(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const bands = React.useMemo(() => weeklyBands(capacity.schedule), [capacity.schedule]);

  // ── Drag-to-edit ──────────────────────────────────────────────────────────
  // Convert a client X (page coords) into a heatmap-minute (0..1440), taking
  // the SVG's responsive scale into account. Returns NaN if no svg yet.
  const clientXToMin = React.useCallback((clientX: number): number => {
    const svg = svgRef.current;
    if (!svg) return Number.NaN;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return Number.NaN;
    const xInViewBox = ((clientX - rect.left) / rect.width) * WIDTH;
    return ((xInViewBox - PAD_LEFT) / HOUR_WIDTH) * 60;
  }, []);

  const clientYToRowIdx = React.useCallback((clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return -1;
    const rect = svg.getBoundingClientRect();
    if (rect.height === 0) return -1;
    const yInViewBox = ((clientY - rect.top) / rect.height) * HEIGHT;
    return rowIdxFromY(yInViewBox, PAD_TOP, ROW_HEIGHT, ROW_GAP);
  }, []);

  const handleBandPointerDown = React.useCallback(
    (e: React.PointerEvent<SVGRectElement>, band: Band, rowIdx: number) => {
      // Drag is opt-in via the `onSlotMove` prop, and only enabled for bands
      // whose owner slot lives on the SAME day (wrap-in bands point at a
      // slot defined on a different day and shouldn't move when dragged here).
      const wantsInsert = e.altKey && !!onSlotInsert;
      // Drag is opt-in via either onSlotMove (move/cross-day) or onSlotInsert
      // (Alt-drag). Wrap-in bands (ownerDay !== day) aren't draggable.
      if ((!onSlotMove && !wantsInsert) || !band.slot || band.ownerIdx == null) return;
      if (band.ownerDay !== band.day) return;
      const m = clientXToMin(e.clientX);
      if (Number.isNaN(m)) return;
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDrag({
        mode: wantsInsert ? 'insert' : 'move',
        day: band.day,
        slotIdx: band.ownerIdx,
        grabMin: m,
        originStart: band.startMin,
        previewStart: band.startMin,
        originRowIdx: rowIdx,
        previewRowIdx: rowIdx,
        insertAction: oppositeAction(band.slot.action),
      });
    },
    [onSlotMove, onSlotInsert, clientXToMin],
  );

  const handleSvgPointerMove = React.useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drag) return;
      const m = clientXToMin(e.clientX);
      if (Number.isNaN(m)) return;
      const rowIdx = clientYToRowIdx(e.clientY);
      const targetDay = rowIdx >= 0 ? DAYS[rowIdx] : drag.day;
      // Clamp against the *target day's* neighbours so cross-day previews are
      // sensible even when the destination row has its own slot density.
      const raw = drag.originStart + (m - drag.grabMin);
      const targetSlots = capacity.schedule[targetDay];
      const targetIdx = rowIdx === drag.originRowIdx ? drag.slotIdx : targetSlots.length;
      const prevStart = targetSlots[targetIdx - 1] ? parseHHMM(targetSlots[targetIdx - 1].start) : null;
      const nextStart = targetSlots[targetIdx] && rowIdx !== drag.originRowIdx
        ? parseHHMM(targetSlots[targetIdx].start)
        : targetSlots[targetIdx + 1] ? parseHHMM(targetSlots[targetIdx + 1].start) : null;
      const clamped = clampStartMin(raw, prevStart, nextStart);
      const nextPreviewRow = rowIdx >= 0 ? rowIdx : drag.previewRowIdx;
      if (clamped !== drag.previewStart || nextPreviewRow !== drag.previewRowIdx) {
        setDrag({ ...drag, previewStart: clamped, previewRowIdx: nextPreviewRow });
      }
    },
    [drag, clientXToMin, clientYToRowIdx, capacity.schedule],
  );

  const handleSvgPointerUp = React.useCallback(() => {
    if (!drag) return;
    const sameDay = drag.previewRowIdx === drag.originRowIdx;
    const dstDay = sameDay ? drag.day : DAYS[drag.previewRowIdx];
    const newStart = minToHHMM(drag.previewStart);

    if (drag.mode === 'insert') {
      // Alt-drag → insert a new slot on the destination day at the release
      // point. No-op if the release lands exactly on an existing slot start.
      if (onSlotInsert && drag.previewStart !== drag.originStart) {
        onSlotInsert(dstDay, newStart, drag.insertAction);
      }
    } else if (sameDay) {
      if (onSlotMove && drag.previewStart !== drag.originStart) {
        onSlotMove(drag.day, drag.slotIdx, newStart);
      }
    } else if (onSlotMoveDay) {
      onSlotMoveDay(drag.day, drag.slotIdx, dstDay, newStart);
    } else if (onSlotMove && drag.previewStart !== drag.originStart) {
      // No cross-day handler wired → fall back to a same-day move.
      onSlotMove(drag.day, drag.slotIdx, newStart);
    }
    setDrag(null);
  }, [drag, onSlotMove, onSlotMoveDay, onSlotInsert]);

  // Compute "now" in the capacity's local TZ.
  // Strategy: use Intl.DateTimeFormat with the capacity's IANA TZ to extract
  // weekday + hh:mm. Falls back to local browser TZ if the IANA id is unknown.
  const local = React.useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: capacity.timezone || 'Europe/London',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
      const dayName = (parts.weekday || '').toLowerCase();
      const dayIdx = DAYS.indexOf(dayName as (typeof DAYS)[number]);
      const minNow = Number(parts.hour) * 60 + Number(parts.minute);
      return { dayIdx, minNow };
    } catch {
      return { dayIdx: -1, minNow: 0 };
    }
  }, [now, capacity.timezone]);

  // Map upcoming bank-holiday dates → row indices (0..6 in DAYS order) for
  // hatching. The gov.uk bank-holiday feed publishes dates in UK local time,
  // so resolve "today" in Europe/London (not UTC) to avoid the off-by-one
  // around midnight that `toISOString().slice(0,10)` would introduce.
  const hatchedDayIndices = React.useMemo(() => {
    if (!bankHolidayDates.length || !capacity.respectBankHolidays) return new Set<number>();
    const set = new Set<number>();
    const ukDateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const ukWeekdayFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'long',
    });
    const dayNameToIdx: Record<string, number> = {
      monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
      friday: 4, saturday: 5, sunday: 6,
    };
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const iso = ukDateFmt.format(d); // en-CA → yyyy-mm-dd
      if (bankHolidayDates.includes(iso)) {
        const dayName = ukWeekdayFmt.format(d).toLowerCase();
        const idx = dayNameToIdx[dayName];
        if (idx !== undefined) set.add(idx);
      }
    }
    return set;
  }, [bankHolidayDates, capacity.respectBankHolidays, now]);

  return (
    <div className={styles.root}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={`Weekly schedule heatmap for ${capacity.displayName || capacity.id}`}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onPointerCancel={handleSvgPointerUp}
      >
        <defs>
          <pattern id={hatchId} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#9CA3AF" strokeWidth="2" strokeOpacity="0.4" />
          </pattern>
        </defs>

        {/* Hour gridlines + labels */}
        {Array.from({ length: 25 }, (_, h) => (
          <g key={h}>
            <line
              x1={minToX(h * 60)}
              x2={minToX(h * 60)}
              y1={PAD_TOP}
              y2={PAD_TOP + 7 * (ROW_HEIGHT + ROW_GAP) - ROW_GAP}
              stroke={tokens.colorNeutralStroke3}
              strokeWidth={h % 6 === 0 ? 1.5 : 0.5}
            />
            {h % 2 === 0 && (
              <text
                x={minToX(h * 60)}
                y={PAD_TOP - 8}
                fontSize="10"
                fill={tokens.colorNeutralForeground3}
                textAnchor="middle"
              >
                {String(h).padStart(2, '0')}
              </text>
            )}
          </g>
        ))}

        {/* Day rows */}
        {DAYS.map((day, dayIdx) => {
          const rowY = PAD_TOP + dayIdx * (ROW_HEIGHT + ROW_GAP);
          const rowBands = bands.filter((b) => b.day === day);
          const isHoliday = hatchedDayIndices.has(dayIdx);
          return (
            <g key={day}>
              {/* Day label */}
              <text
                x={PAD_LEFT - 10}
                y={rowY + ROW_HEIGHT / 2 + 4}
                fontSize="12"
                fill={tokens.colorNeutralForeground1}
                textAnchor="end"
                style={{ textTransform: 'capitalize' }}
              >
                {day}
              </text>

              {/* Bands */}
              {rowBands.map((band, i) => {
                const x = minToX(band.startMin);
                const w = ((band.endMin - band.startMin) / 60) * HOUR_WIDTH;
                const label = bandLabel(band.slot);
                const showLabel = w >= 36 && label;
                const clickable = !!band.slot && !!onSlotClick;
                const draggable =
                  !!onSlotMove && !!band.slot && band.ownerDay === band.day && band.ownerIdx != null;
                const cursor = draggable ? 'ew-resize' : clickable ? 'pointer' : 'default';
                return (
                  <g
                    key={`${band.day}-${i}`}
                    style={{ cursor }}
                    onClick={() => {
                      if (clickable && band.slot && !drag) onSlotClick!(band.day, band.slot);
                    }}
                  >
                    <rect
                      x={x}
                      y={rowY}
                      width={w}
                      height={ROW_HEIGHT}
                      fill={bandFill(band.slot)}
                      rx={4}
                      ry={4}
                      onPointerDown={
                        draggable
                          ? (e) => handleBandPointerDown(e, band, dayIdx)
                          : undefined
                      }
                    >
                      <title>{formatTooltip(band)}</title>
                    </rect>
                    {showLabel && (
                      <text
                        x={x + w / 2}
                        y={rowY + ROW_HEIGHT / 2 + 4}
                        fontSize="11"
                        fontWeight="600"
                        fill={bandTextColor(band.slot)}
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Bank-holiday hatch overlay */}
              {isHoliday && (
                <rect
                  x={PAD_LEFT}
                  y={rowY}
                  width={24 * HOUR_WIDTH}
                  height={ROW_HEIGHT}
                  fill={`url(#${hatchId})`}
                  pointerEvents="none"
                >
                  <title>{`${day}: UK bank holiday in the next 7 days`}</title>
                </rect>
              )}
            </g>
          );
        })}

        {/* Drag preview — dashed marker at the snapped target start time,
            plus an HH:MM badge so the operator can see what they're picking. */}
        {drag && (() => {
          const row = drag.previewRowIdx >= 0 ? drag.previewRowIdx : drag.originRowIdx;
          const rowY = PAD_TOP + row * (ROW_HEIGHT + ROW_GAP);
          const crossDay = row !== drag.originRowIdx;
          const isInsert = drag.mode === 'insert';
          // Insert-mode marker is green (creation); move-mode is blue.
          const markerColor = isInsert
            ? tokens.colorPaletteGreenForeground1
            : tokens.colorPaletteBlueForeground2;
          const label = isInsert
            ? `+${drag.insertAction[0]} ${minToHHMM(drag.previewStart)}`
            : minToHHMM(drag.previewStart);
          const badgeWidth = isInsert ? 64 : 44;
          return (
            <g pointerEvents="none">
              {/* When crossing days, also outline the destination row so the
                  drop target is unambiguous. */}
              {crossDay && (
                <rect
                  x={PAD_LEFT}
                  y={rowY}
                  width={24 * HOUR_WIDTH}
                  height={ROW_HEIGHT}
                  fill="none"
                  stroke={markerColor}
                  strokeWidth={1.5}
                  strokeDasharray="6,3"
                  rx={4}
                />
              )}
              <line
                x1={minToX(drag.previewStart)}
                x2={minToX(drag.previewStart)}
                y1={rowY - 2}
                y2={rowY + ROW_HEIGHT + 2}
                stroke={markerColor}
                strokeWidth={2}
                strokeDasharray="4,3"
              />
              <rect
                x={minToX(drag.previewStart) - badgeWidth / 2}
                y={rowY - 18}
                width={badgeWidth}
                height={16}
                rx={3}
                fill={markerColor}
              />
              <text
                x={minToX(drag.previewStart)}
                y={rowY - 6}
                fontSize="11"
                fontWeight="600"
                fill="#FFFFFF"
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })()}

        {/* Now line — vertical across all rows at the current local time. Only
            drawn if we successfully resolved the capacity's TZ. */}
        {local.dayIdx >= 0 && (
          <>
            <line
              x1={minToX(local.minNow)}
              x2={minToX(local.minNow)}
              y1={PAD_TOP}
              y2={PAD_TOP + 7 * (ROW_HEIGHT + ROW_GAP) - ROW_GAP}
              stroke={tokens.colorPaletteRedForeground1}
              strokeWidth={1.5}
              strokeDasharray="3,3"
            />
            {/* Dot on the active day row */}
            <circle
              cx={minToX(local.minNow)}
              cy={PAD_TOP + local.dayIdx * (ROW_HEIGHT + ROW_GAP) + ROW_HEIGHT / 2}
              r={5}
              fill={tokens.colorPaletteRedForeground1}
            />
          </>
        )}
      </svg>

      <div className={styles.legendRow}>
        <Text size={200} weight="semibold">Legend:</Text>
        <span>
          <span className={styles.legendSwatch} style={{ backgroundColor: SUSPEND_COLOR }} />
          ⏸ Suspend
        </span>
        {(['F2', 'F4', 'F8', 'F16', 'F32', 'F64', 'F128', 'F256', 'F512', 'F1024', 'F2048'] as FabricSku[]).map((s) => (
          <span key={s}>
            <span className={styles.legendSwatch} style={{ backgroundColor: SKU_COLORS[s] }} />
            {s}
          </span>
        ))}
        <span>▶ Resume · ⇅ Scale · ⏸ Suspend</span>
        <span>🔴 Now</span>
        <span>┳ Bank holiday in next 7 days (hatched)</span>
      </div>
    </div>
  );
};
