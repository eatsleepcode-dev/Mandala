import React from 'react';
import { render, screen } from '@testing-library/react';
import { StoryMapView } from './StoryMapView';
import type { TaskCard, SprintRecord } from '../../shared/types';

const card = (overrides: Partial<TaskCard> = {}): TaskCard => ({
  id: 'T-001', title: 'Login', sprint: 1, status: 'planned', type: 'feat',
  tags: [], path: '/inbox/T-001.md', body: '', activity: 'Auth', ...overrides,
});

const sprint = (overrides: Partial<SprintRecord> = {}): SprintRecord => ({
  sprint: 1, goal: 'Ship auth', status: 'planned',
  path: '.mandala/sprints/s1.md', body: '', ...overrides,
});

describe('StoryMapView sprint date range', () => {
  it('shows formatted date range when both dates present', () => {
    render(
      <StoryMapView
        cards={[card()]}
        sprintRecords={[sprint({ startDate: '2026-05-01', endDate: '2026-05-14' })]}
        onOpenFile={jest.fn()}
      />
    );
    expect(screen.getByText('1 May 2026 – 14 May 2026')).toBeInTheDocument();
  });

  it('shows start-only range', () => {
    render(
      <StoryMapView
        cards={[card()]}
        sprintRecords={[sprint({ startDate: '2026-05-01' })]}
        onOpenFile={jest.fn()}
      />
    );
    expect(screen.getByText('from 1 May 2026')).toBeInTheDocument();
  });

  it('shows nothing when sprint has no dates', () => {
    const { container } = render(
      <StoryMapView
        cards={[card()]}
        sprintRecords={[sprint()]}
        onOpenFile={jest.fn()}
      />
    );
    expect(container.querySelector('.sprint-date-range')).toBeNull();
  });
});
