import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SprintsView } from './SprintsView';
import type { SprintRecord } from '../../shared/types';

const mockRecords: SprintRecord[] = [
  {
    sprint: 1,
    goal: 'Initial setup',
    status: 'complete',
    startDate: '2026-05-01',
    endDate: '2026-05-14',
    path: '/fake/Sprint-1.md',
    body: 'Did the setup.',
  },
  {
    sprint: 2,
    goal: 'UI Polish',
    status: 'planned',
    path: '/fake/Sprint-2.md',
    body: 'Going to polish UI.',
  }
];

describe('SprintsView', () => {
  it('renders sprint columns', () => {
    render(<SprintsView records={mockRecords} onOpenFile={jest.fn()} />);
    
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Initial setup')).toBeInTheDocument();
    
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
    expect(screen.getByText('UI Polish')).toBeInTheDocument();
  });

  it('calls onOpenFile when a sprint card is clicked', () => {
    const handleOpenFile = jest.fn();
    render(<SprintsView records={mockRecords} onOpenFile={handleOpenFile} />);
    
    fireEvent.click(screen.getByText('Sprint 1'));
    expect(handleOpenFile).toHaveBeenCalledWith('/fake/Sprint-1.md');
  });

  it('groups sprints by status', () => {
    const { container } = render(<SprintsView records={mockRecords} onOpenFile={jest.fn()} />);
    
    // 3 columns: in-progress, planned, complete
    const cols = container.querySelectorAll('.sprint-col');
    expect(cols).toHaveLength(3);
  });
});
