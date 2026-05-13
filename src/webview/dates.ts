const FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso : FMT.format(d);
}

export function fmtDateRange(start?: string, end?: string): string | null {
  if (!start && !end) return null;
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  if (start) return `from ${fmtDate(start)}`;
  return `until ${fmtDate(end!)}`;
}
