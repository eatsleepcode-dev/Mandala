import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TechDebtView } from './TechDebtView';
import type { TechDebtCard } from '../../shared/types';

const mockCards: TechDebtCard[] = [
  {
    id: 'TD-001',
    title: 'Replace placeholder code',
    severity: 'high',
    tags: ['setup', 'refactor'],
    status: 'open',
    added: '2026-05-11',
    path: '/fake/TD-001.md',
    body: 'The initial codebase contains some placeholders that need to be replaced.',
  },
  {
    id: 'TD-002',
    title: 'Resolved issue',
    severity: 'low',
    tags: ['docs'],
    status: 'resolved',
    added: '2026-05-10',
    path: '/fake/TD-002.md',
    body: 'This is resolved.',
  }
];

describe('TechDebtView', () => {
  it('renders a grid of tech debt cards', () => {
    render(<TechDebtView cards={mockCards} onOpenFile={jest.fn()} />);
    
    // Check titles
    expect(screen.getByText('Replace placeholder code')).toBeInTheDocument();
    expect(screen.getByText('Resolved issue')).toBeInTheDocument();
    
    // Check IDs
    expect(screen.getByText('TD-001')).toBeInTheDocument();
    expect(screen.getByText('TD-002')).toBeInTheDocument();
  });

  it('calls onOpenFile when a card is clicked', () => {
    const handleOpenFile = jest.fn();
    render(<TechDebtView cards={mockCards} onOpenFile={handleOpenFile} />);
    
    fireEvent.click(screen.getByText('Replace placeholder code'));
    expect(handleOpenFile).toHaveBeenCalledWith('/fake/TD-001.md');
  });

  it('applies correct severity and status classes', () => {
    const { container } = render(<TechDebtView cards={mockCards} onOpenFile={jest.fn()} />);
    
    const cards = container.querySelectorAll('.td-card');
    expect(cards).toHaveLength(2);
    
    // First card should be high severity and open
    expect(cards[0]).toHaveClass('sev-high');
    expect(cards[0]).not.toHaveClass('resolved');
    
    // Second card should be low severity and resolved
    expect(cards[1]).toHaveClass('sev-low');
    expect(cards[1]).toHaveClass('resolved');
  });
});
