import { fmtDate, fmtDateRange } from './dates';

describe('fmtDate', () => {
  it('formats an ISO date to readable form', () => {
    expect(fmtDate('2026-05-01')).toBe('1 May 2026');
  });

  it('returns the original string when input is not a valid date', () => {
    expect(fmtDate('not-a-date')).toBe('not-a-date');
  });
});

describe('fmtDateRange', () => {
  it('formats a full start–end range', () => {
    expect(fmtDateRange('2026-05-01', '2026-05-14')).toBe('1 May 2026 – 14 May 2026');
  });

  it('returns null when both dates are absent', () => {
    expect(fmtDateRange(undefined, undefined)).toBeNull();
  });

  it('formats start-only with from prefix', () => {
    expect(fmtDateRange('2026-05-01', undefined)).toBe('from 1 May 2026');
  });

  it('formats end-only with until prefix', () => {
    expect(fmtDateRange(undefined, '2026-05-14')).toBe('until 14 May 2026');
  });
});
