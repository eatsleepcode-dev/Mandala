import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiaryView } from './DiaryView';
import type { DiaryEntry } from '../../shared/types';

let _seq = 0;
const entry = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => {
  const date = overrides.date ?? `2026-05-${String(9 - _seq++).padStart(2, '0')}`;
  return {
    date,
    type: 'feat',
    title: 'Implemented auth',
    path: `/workspace/.meridian/diary/${date}.md`,
    body: 'Details here.',
    techDebt: false,
    adr: false,
    ...overrides,
  };
};

beforeEach(() => { _seq = 0; });

describe('DiaryView', () => {
  it('renders empty state when no entries', () => {
    render(<DiaryView entries={[]} onOpenFile={jest.fn()} />);
    expect(screen.getByText(/no diary entries/i)).toBeInTheDocument();
  });

  it('renders all entries in the sidebar', () => {
    const entries = [
      entry({ date: '2026-05-09', title: 'Day one' }),
      entry({ date: '2026-05-08', title: 'Day two' }),
    ];
    render(<DiaryView entries={entries} onOpenFile={jest.fn()} />);
    // Both sidebar rows and the content pane may show the selected title; check sidebar nav specifically
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveTextContent('Day one');
    expect(nav).toHaveTextContent('Day two');
  });

  it('shows the first entry content by default', () => {
    render(<DiaryView entries={[entry()]} onOpenFile={jest.fn()} />);
    expect(screen.getByText('Details here.')).toBeInTheDocument();
  });

  it('switches content pane when a sidebar entry is clicked', async () => {
    const entries = [
      entry({ title: 'Entry A', body: 'Body A' }),
      entry({ date: '2026-05-08', title: 'Entry B', body: 'Body B' }),
    ];
    render(<DiaryView entries={entries} onOpenFile={jest.fn()} />);
    await userEvent.click(screen.getByText('Entry B'));
    expect(screen.getByText('Body B')).toBeInTheDocument();
    expect(screen.queryByText('Body A')).not.toBeInTheDocument();
  });

  it('renders a techDebt badge when techDebt is true', () => {
    render(<DiaryView entries={[entry({ techDebt: true })]} onOpenFile={jest.fn()} />);
    expect(screen.getByText(/tech debt/i)).toBeInTheDocument();
  });

  it('renders an ADR badge when adr is true', () => {
    render(<DiaryView entries={[entry({ adr: true })]} onOpenFile={jest.fn()} />);
    expect(screen.getByText(/adr/i)).toBeInTheDocument();
  });

  it('calls onOpenFile when the open-in-editor button is clicked', async () => {
    const onOpenFile = jest.fn();
    render(<DiaryView entries={[entry()]} onOpenFile={onOpenFile} />);
    await userEvent.click(screen.getByTitle(/open in editor/i));
    expect(onOpenFile).toHaveBeenCalledWith('/workspace/.meridian/diary/2026-05-09.md');
  });

  it('shows branch chip when branch is present', () => {
    render(<DiaryView entries={[entry({ branch: 'feature/auth' })]} onOpenFile={jest.fn()} />);
    expect(screen.getByText('feature/auth')).toBeInTheDocument();
  });
});
