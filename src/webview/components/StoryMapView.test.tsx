import React from 'react';
import { render, screen } from '@testing-library/react';
import { StoryMapView } from './StoryMapView';
import type { TaskCard, SprintRecord } from '../../shared/types';

const card = (overrides: Partial<TaskCard> = {}): TaskCard => ({
  id: 'T-001',
  title: 'Add login',
  sprint: 1,
  status: 'planned',
  type: 'feat',
  tags: ['auth'],
  path: '/workspace/.mandala/inbox/T-001.md',
  body: '',
  activity: 'User Auth',
  ...overrides,
});

const sprint = (overrides: Partial<SprintRecord> = {}): SprintRecord => ({
  sprint: 1,
  goal: 'Ship auth',
  status: 'planned',
  startDate: '2026-05-01',
  endDate: '2026-05-14',
  path: '.mandala/sprints/sprint-1.md',
  body: '',
  ...overrides,
});

describe('StoryMapView', () => {
  it('renders empty state when no cards', () => {
    render(<StoryMapView cards={[]} sprintRecords={[]} onOpenFile={jest.fn()} />);
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
  });

  it('renders an activity column for each unique activity', () => {
    const cards = [
      card({ activity: 'Auth' }),
      card({ id: 'T-002', title: 'View profile', activity: 'User Profile' }),
    ];
    render(<StoryMapView cards={cards} sprintRecords={[]} onOpenFile={jest.fn()} />);
    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.getByText('User Profile')).toBeInTheDocument();
  });

  it('renders sprint rows with Sprint N label', () => {
    const cards = [
      card({ sprint: 1, activity: 'Auth' }),
      card({ id: 'T-002', title: 'Signup', sprint: 2, activity: 'Auth' }),
    ];
    render(<StoryMapView cards={cards} sprintRecords={[]} onOpenFile={jest.fn()} />);
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
  });

  it('shows sprint goal from sprintRecords in the sprint row', () => {
    render(
      <StoryMapView
        cards={[card({ sprint: 1 })]}
        sprintRecords={[sprint({ sprint: 1, goal: 'Ship auth' })]}
        onOpenFile={jest.fn()}
      />
    );
    expect(screen.getByText('Ship auth')).toBeInTheDocument();
  });

  it('assigns data-status attribute to each card', () => {
    render(
      <StoryMapView
        cards={[card({ status: 'in-progress' })]}
        sprintRecords={[]}
        onOpenFile={jest.fn()}
      />
    );
    expect(screen.getByText('Add login').closest('[data-status]')).toHaveAttribute(
      'data-status',
      'in-progress'
    );
  });

  it('calls onOpenFile with card path when card is clicked', async () => {
    const onOpenFile = jest.fn();
    render(<StoryMapView cards={[card()]} sprintRecords={[]} onOpenFile={onOpenFile} />);
    screen.getByText('Add login').closest('[data-status]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    expect(onOpenFile).toHaveBeenCalledWith('/workspace/.mandala/inbox/T-001.md');
  });

  it('groups cards without an activity under Uncategorized', () => {
    render(
      <StoryMapView cards={[card({ activity: undefined })]} sprintRecords={[]} onOpenFile={jest.fn()} />
    );
    expect(screen.getByText(/uncategorized/i)).toBeInTheDocument();
  });
});
