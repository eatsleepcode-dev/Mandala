import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardDetailPanel } from './CardDetailPanel';
import type { TaskCard } from '../../shared/types';

const card = (overrides: Partial<TaskCard> = {}): TaskCard => ({
  id: 'T-042',
  title: 'Add OAuth flow',
  sprint: 7,
  status: 'in-progress',
  type: 'feat',
  tags: ['GAP-003', 'auth'],
  points: 5,
  branch: 'feat/oauth',
  activity: 'Auth & Identity',
  path: '.mandala/inbox/T-042.md',
  body: 'Implement OAuth 2.0 PKCE flow for third-party login.',
  ...overrides,
});

describe('CardDetailPanel', () => {
  it('renders nothing when card is null', () => {
    const { container } = render(<CardDetailPanel card={null} onClose={jest.fn()} onOpenFile={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the card title', () => {
    render(<CardDetailPanel card={card()} onClose={jest.fn()} onOpenFile={jest.fn()} />);
    expect(screen.getByText('Add OAuth flow')).toBeInTheDocument();
  });

  it('shows all frontmatter fields', () => {
    render(<CardDetailPanel card={card()} onClose={jest.fn()} onOpenFile={jest.fn()} />);
    expect(screen.getByText('T-042')).toBeInTheDocument();
    expect(screen.getByText('Sprint 7')).toBeInTheDocument();
    expect(screen.getByText('in-progress')).toBeInTheDocument();
    expect(screen.getByText('feat')).toBeInTheDocument();
    expect(screen.getByText('5 pts')).toBeInTheDocument();
    expect(screen.getByText('feat/oauth')).toBeInTheDocument();
    expect(screen.getByText('Auth & Identity')).toBeInTheDocument();
  });

  it('shows the card body text', () => {
    render(<CardDetailPanel card={card()} onClose={jest.fn()} onOpenFile={jest.fn()} />);
    expect(screen.getByText(/Implement OAuth/)).toBeInTheDocument();
  });

  it('shows tags', () => {
    render(<CardDetailPanel card={card()} onClose={jest.fn()} onOpenFile={jest.fn()} />);
    expect(screen.getByText('GAP-003')).toBeInTheDocument();
    expect(screen.getByText('auth')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<CardDetailPanel card={card()} onClose={onClose} onOpenFile={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenFile with the card path when open-file button is clicked', () => {
    const onOpenFile = jest.fn();
    render(<CardDetailPanel card={card()} onClose={jest.fn()} onOpenFile={onOpenFile} />);
    fireEvent.click(screen.getByRole('button', { name: /open file/i }));
    expect(onOpenFile).toHaveBeenCalledWith('.mandala/inbox/T-042.md');
  });
});
