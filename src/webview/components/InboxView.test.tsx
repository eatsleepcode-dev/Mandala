import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InboxView } from './InboxView';
import type { TaskCard } from '../../shared/types';

const card = (overrides: Partial<TaskCard> = {}): TaskCard => ({
  id: 'T-048',
  title: 'Extract planner',
  sprint: 20,
  status: 'in-progress',
  type: 'chore',
  tags: ['ci'],
  path: '/fake/T-048.md',
  body: 'Needs own repo.',
  ...overrides,
});

const mockCards: TaskCard[] = [
  card({ id: 'T-048', title: 'Extract phoric-planner', status: 'in-progress' }),
  card({ id: 'T-049', title: 'Clean up root', sprint: 21, status: 'planned', tags: [] }),
];

describe('InboxView', () => {
  it('renders a list of tasks', () => {
    render(<InboxView cards={mockCards} onOpenFile={jest.fn()} />);
    expect(screen.getByText('Extract phoric-planner')).toBeInTheDocument();
    expect(screen.getByText('Clean up root')).toBeInTheDocument();
    expect(screen.getByText('T-048')).toBeInTheDocument();
  });

  it('calls onOpenFile when a task is clicked', () => {
    const handleOpenFile = jest.fn();
    render(<InboxView cards={mockCards} onOpenFile={handleOpenFile} />);
    fireEvent.click(screen.getByText('Extract phoric-planner'));
    expect(handleOpenFile).toHaveBeenCalledWith('/fake/T-048.md');
  });

  it('can toggle between Active and All', () => {
    render(<InboxView cards={mockCards} onOpenFile={jest.fn()} />);
    expect(screen.getByText('Extract phoric-planner')).toBeInTheDocument();
    expect(screen.getByText('Clean up root')).toBeInTheDocument();
    fireEvent.click(screen.getByText('🔴 Active'));
    expect(screen.getByText('Extract phoric-planner')).toBeInTheDocument();
    expect(screen.queryByText('Clean up root')).not.toBeInTheDocument();
  });

  it('shows points score in subtitle when cards have points', () => {
    const cards = [
      card({ status: 'complete', points: 3 }),
      card({ id: 'T-002', status: 'planned', points: 5 }),
    ];
    render(<InboxView cards={cards} onOpenFile={jest.fn()} />);
    // e.g. "3/8 pts (38%)"
    expect(screen.getByText(/3\/8 pts/)).toBeInTheDocument();
  });

  it('omits the score from subtitle when no cards have points', () => {
    render(<InboxView cards={mockCards} onOpenFile={jest.fn()} />);
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });
});
