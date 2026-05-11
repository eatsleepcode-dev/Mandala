import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InboxView } from './InboxView';
import type { TaskCard } from '../../shared/types';

const mockCards: TaskCard[] = [
  {
    id: 'T-048',
    title: 'Extract phoric-planner',
    sprint: 20,
    status: 'in-progress',
    type: 'chore',
    tags: ['ci'],
    path: '/fake/T-048.md',
    body: 'Needs own GitHub repo.',
  },
  {
    id: 'T-049',
    title: 'Clean up root',
    sprint: 21,
    status: 'planned',
    type: 'tidy',
    tags: [],
    path: '/fake/T-049.md',
    body: 'Clean up some stuff.',
  }
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
    
    // Initially All filter is active
    expect(screen.getByText('Extract phoric-planner')).toBeInTheDocument();
    expect(screen.getByText('Clean up root')).toBeInTheDocument();

    // Click Active filter
    fireEvent.click(screen.getByText('🔴 Active'));
    
    // Only in-progress should show
    expect(screen.getByText('Extract phoric-planner')).toBeInTheDocument();
    expect(screen.queryByText('Clean up root')).not.toBeInTheDocument();
  });
});
