import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Topbar } from './Topbar';
import type { SprintRecord, TaskCard } from '../../shared/types';

const noSprints: SprintRecord[] = [];
const noCards: TaskCard[] = [];

const card = (overrides: Partial<TaskCard> = {}): TaskCard => ({
  id: 'T-001',
  title: 'Add login',
  sprint: 1,
  status: 'planned',
  type: 'feat',
  tags: [],
  path: '/workspace/.mandala/inbox/T-001.md',
  body: '',
  activity: 'Auth',
  ...overrides,
});

describe('Topbar', () => {
  it('renders the workspace title', () => {
    render(<Topbar sprintRecords={noSprints} cards={noCards} onSearch={jest.fn()} />);
    expect(screen.getByText('Mandala')).toBeInTheDocument();
  });

  it('renders a search input', () => {
    render(<Topbar sprintRecords={noSprints} cards={noCards} onSearch={jest.fn()} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('calls onSearch with typed text', async () => {
    const onSearch = jest.fn();
    render(<Topbar sprintRecords={noSprints} cards={noCards} onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('searchbox'), 'auth');
    expect(onSearch).toHaveBeenLastCalledWith('auth');
  });

  it('shows score when cards exist', () => {
    const cards = [
      card({ status: 'complete', points: 3 }),
      card({ id: 'T-002', status: 'planned', points: 2 }),
    ];
    render(<Topbar sprintRecords={noSprints} cards={cards} onSearch={jest.fn()} />);
    expect(screen.getByText(/3\/5/)).toBeInTheDocument();
  });

  it('shows active sprint badge', () => {
    const sprint: SprintRecord = {
      sprint: 7,
      goal: 'Ship search',
      status: 'in-progress',
      path: '.mandala/sprints/sprint-7.md',
      body: '',
    };
    render(<Topbar sprintRecords={[sprint]} cards={noCards} onSearch={jest.fn()} />);
    expect(screen.getByText(/sprint 7/i)).toBeInTheDocument();
  });
});
