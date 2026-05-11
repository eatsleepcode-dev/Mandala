import React, { useEffect, useMemo, useState } from 'react';
import type { DiaryEntry } from '../../shared/types';

interface Props {
  entries: DiaryEntry[];
  onOpenFile: (path: string) => void;
}

function parseDate(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function buildCalendarCells(viewMonth: Date): Array<string | undefined> {
  const firstDay = startOfMonth(viewMonth);
  const firstWeekday = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(viewMonth.getUTCFullYear(), viewMonth.getUTCMonth() + 1, 0)).getUTCDate();

  const cells: Array<string | undefined> = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(undefined);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(viewMonth.getUTCFullYear(), viewMonth.getUTCMonth(), day));
    cells.push(formatIsoDate(date));
  }

  while (cells.length % 7 !== 0) {
    cells.push(undefined);
  }

  return cells;
}

export function DiaryView({ entries, onOpenFile }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const selected = entries[selectedIdx];
  const selectedDate = selected ? parseDate(selected.date) : undefined;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate ?? new Date()));

  useEffect(() => {
    if (selectedDate) {
      setViewMonth(startOfMonth(selectedDate));
    }
  }, [selected?.date, selectedDate]);

  useEffect(() => {
    if (entries.length > 0 && selectedIdx >= entries.length) {
      setSelectedIdx(0);
    }
  }, [entries.length, selectedIdx]);

  if (entries.length === 0) {
    return (
      <div data-testid="diary-view" className="empty-state">
        <p>No diary entries found in .mandala/diary/</p>
      </div>
    );
  }

  const entriesByDate = useMemo(
    () => new Map(entries.map((entry) => [entry.date, entry] as const)),
    [entries]
  );
  const calendarCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth]);
  const monthEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const parsed = parseDate(entry.date);
        return parsed !== undefined && toMonthKey(parsed) === toMonthKey(viewMonth);
      }),
    [entries, viewMonth]
  );

  const selectEntryByDate = (date: string) => {
    const idx = entries.findIndex((entry) => entry.date === date);
    if (idx >= 0) {
      setSelectedIdx(idx);
    }

    const parsed = parseDate(date);
    if (parsed) {
      setViewMonth(startOfMonth(parsed));
    }
  };

  return (
    <div data-testid="diary-view" className="diary-layout">
      <nav className="diary-sidebar">
        <section className="diary-calendar">
          <div className="diary-calendar-header">
            <div>
              <div className="diary-calendar-title">{monthLabel(viewMonth)}</div>
              <div className="diary-calendar-subtitle">Navigate the dev diary by day</div>
            </div>
            <div className="diary-calendar-actions">
              <button
                type="button"
                className="diary-calendar-nav"
                onClick={() => setViewMonth((month) => shiftMonth(month, -1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="diary-calendar-nav"
                onClick={() => setViewMonth((month) => shiftMonth(month, 1))}
              >
                Next
              </button>
            </div>
          </div>

          <div className="diary-calendar-grid" role="grid" aria-label={monthLabel(viewMonth)}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
              <span key={day} className="diary-calendar-weekday">
                {day}
              </span>
            ))}
            {calendarCells.map((date, index) => {
              if (!date) {
                return <span key={`empty-${index}`} className="diary-calendar-cell diary-calendar-cell-empty" />;
              }

              const entry = entriesByDate.get(date);
              const isSelected = selected.date === date;
              return (
                <button
                  key={date}
                  type="button"
                  className={`diary-calendar-cell ${entry ? 'has-entry' : ''} ${isSelected ? 'active' : ''}`}
                  onClick={() => selectEntryByDate(date)}
                  aria-label={entry ? `${date} ${entry.title}` : date}
                  title={entry ? `${date} - ${entry.title}` : date}
                >
                  <span className="diary-calendar-day">{String(Number(date.slice(-2)))}</span>
                  {entry && <span className={`diary-calendar-badge type-${entry.type}`}>{entry.type}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="diary-entry-list" aria-label="Diary entries">
          <div className="diary-entry-list-header">
            <span>Entries</span>
            <span>{monthEntries.length}</span>
          </div>
          {entries.map((e, i) => (
            <div
              key={e.path}
              className={`diary-entry-row ${i === selectedIdx ? 'active' : ''}`}
              onClick={() => selectEntryByDate(e.date)}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => ev.key === 'Enter' && selectEntryByDate(e.date)}
            >
              <span className="diary-hash">{e.date}</span>
              <div>
                <div className="diary-entry-title">{e.title}</div>
                <div className={`diary-entry-type type-${e.type}`}>{e.type}</div>
              </div>
            </div>
          ))}
        </section>
      </nav>

      <div className="diary-content">
        <div className="diary-content-header">
          <div className="diary-content-hash">{selected.date}</div>
          <div className="diary-content-title">{selected.title}</div>
          <div className="diary-content-meta">
            <span className={`diary-chip type-${selected.type}`}>{selected.type}</span>
            {selected.branch && (
              <span className="diary-chip branch">{selected.branch}</span>
            )}
            {selected.techDebt && <span className="diary-chip td">Tech Debt</span>}
            {selected.adr && <span className="diary-chip adr">ADR</span>}
            <button
              className="diary-chip"
              title="Open in editor"
              onClick={() => onOpenFile(selected.path)}
            >
              ↗ Open in editor
            </button>
          </div>
        </div>

        <div className="diary-body">
          {selected.files && selected.files.length > 0 && (
            <>
              <h3>Files changed</h3>
              <div className="file-list">
                {selected.files.map((f) => (
                  <span key={f} className="file-tag">{f}</span>
                ))}
              </div>
            </>
          )}
          <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{selected.body}</p>
        </div>
      </div>
    </div>
  );
}
