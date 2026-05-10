import React from 'react';
import { render, screen } from '@testing-library/react';
import { StoryMapView } from './StoryMapView';
import type { TaskCard } from '../../shared/types';

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

describe('StoryMapView', () => {
  it('renders empty state when no cards', () => {
    render(<StoryMapView cards={[]} onOpenFile={jest.fn()} />);
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
  });

  it('renders an activity column for each unique activity', () => {
    const cards = [
      card({ activity: 'Auth' }),
      card({ id: 'T-002', title: 'View profile', activity: 'User Profile' }),
    ];
    render(<StoryMapView cards={cards} onOpenFile={jest.fn()} />);
    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.getByText('User Profile')).toBeInTheDocument();
  });

  it('renders cards grouped by sprint row', () => {
    const cards = [
      card({ sprint: 1, activity: 'Auth' }),
      card({ id: 'T-002', title: 'Signup', sprint: 2, activity: 'Auth' }),
    ];
    render(<StoryMapView cards={cards} onOpenFile={jest.fn()} />);
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
  });

  it('assigns correct status class to a card', () => {
    render(
      <StoryMapView cards={[card({ status: 'in-progress' })]} onOpenFile={jest.fn()} />
    );
    expect(screen.getByText('Add login').closest('[data-status]')).toHaveAttribute(
      'data-status',
      'in-progress'
    );
  });

  it('calls onOpenFile with card path when card is clicked', async () => {
    const onOpenFile = jest.fn();
    render(<StoryMapView cards={[card()]} onOpenFile={onOpenFile} />);
    screen.getByText('Add login').closest('[data-status]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
    expect(onOpenFile).toHaveBeenCalledWith('/workspace/.mandala/inbox/T-001.md');
  });

  it('groups cards without an activity under Uncategorized', () => {
    render(
      <StoryMapView cards={[card({ activity: undefined })]} onOpenFile={jest.fn()} />
    );
    expect(screen.getByText(/uncategorized/i)).toBeInTheDocument();
  });
});
