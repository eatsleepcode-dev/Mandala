import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TechDebtView } from './TechDebtView';
import type { TechDebtCard } from '../../shared/types';

const card = (overrides: Partial<TechDebtCard> = {}): TechDebtCard => ({
  id: 'TD-001',
  title: 'Replace placeholder code',
  severity: 'high',
  tags: ['setup'],
  status: 'open',
  added: '2026-05-11',
  path: '/fake/TD-001.md',
  body: 'Needs fixing.',
  ...overrides,
});

const mockCards: TechDebtCard[] = [
  card({ id: 'TD-001', title: 'High item', severity: 'high', added: '2026-05-11' }),
  card({ id: 'TD-002', title: 'Resolved issue', severity: 'low', status: 'resolved', added: '2026-04-01' }),
];

describe('TechDebtView', () => {
  it('renders a grid of tech debt cards', () => {
    render(<TechDebtView cards={mockCards} onOpenFile={jest.fn()} />);
    expect(screen.getByText('High item')).toBeInTheDocument();
    expect(screen.getByText('Resolved issue')).toBeInTheDocument();
    expect(screen.getByText('TD-001')).toBeInTheDocument();
    expect(screen.getByText('TD-002')).toBeInTheDocument();
  });

  it('calls onOpenFile when a card is clicked', () => {
    const handleOpenFile = jest.fn();
    render(<TechDebtView cards={mockCards} onOpenFile={handleOpenFile} />);
    fireEvent.click(screen.getByText('High item'));
    expect(handleOpenFile).toHaveBeenCalledWith('/fake/TD-001.md');
  });

  it('applies correct severity and status classes', () => {
    const { container } = render(<TechDebtView cards={mockCards} onOpenFile={jest.fn()} />);
    const cards = container.querySelectorAll('.td-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveClass('sev-high');
    expect(cards[0]).not.toHaveClass('resolved');
    expect(cards[1]).toHaveClass('sev-low');
    expect(cards[1]).toHaveClass('resolved');
  });

  it('formats the added date as readable text', () => {
    render(<TechDebtView cards={mockCards} onOpenFile={jest.fn()} />);
    expect(screen.getByText('Added 11 May 2026')).toBeInTheDocument();
  });

  it('sorts open cards high → medium → low by default', () => {
    const cards = [
      card({ id: 'TD-L', title: 'Low item', severity: 'low' }),
      card({ id: 'TD-H', title: 'High item', severity: 'high' }),
      card({ id: 'TD-M', title: 'Medium item', severity: 'medium' }),
    ];
    const { container } = render(<TechDebtView cards={cards} onOpenFile={jest.fn()} />);
    const titles = Array.from(container.querySelectorAll('.td-title')).map((el) => el.textContent);
    expect(titles).toEqual(['High item', 'Medium item', 'Low item']);
  });

  it('keeps resolved cards at the bottom regardless of severity', () => {
    const cards = [
      card({ id: 'TD-RH', title: 'Resolved high', severity: 'high', status: 'resolved' }),
      card({ id: 'TD-OL', title: 'Open low', severity: 'low', status: 'open' }),
    ];
    const { container } = render(<TechDebtView cards={cards} onOpenFile={jest.fn()} />);
    const titles = Array.from(container.querySelectorAll('.td-title')).map((el) => el.textContent);
    expect(titles[0]).toBe('Open low');
    expect(titles[1]).toBe('Resolved high');
  });
});
