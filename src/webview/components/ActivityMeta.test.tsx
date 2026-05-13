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
  tags: [],
  path: '/workspace/.mandala/inbox/T-001.md',
  body: '',
  activity: 'Auth',
  ...overrides,
});

const noSprints: SprintRecord[] = [];

describe('StoryMapView activity-meta', () => {
  it('shows tags from cards grouped under the activity header', () => {
    const cards = [
      card({ activity: 'Auth', tags: ['GAP-001', 'security'] }),
      card({ id: 'T-002', title: 'OAuth', activity: 'Auth', tags: ['GAP-001', 'oauth'] }),
    ];
    render(<StoryMapView cards={cards} sprintRecords={noSprints} onOpenFile={jest.fn()} />);
    // GAP-001 should appear as an activity-meta tag under the Auth column header
    expect(screen.getByTestId('activity-meta-Auth')).toBeInTheDocument();
    expect(screen.getByTestId('activity-meta-Auth')).toHaveTextContent('GAP-001');
  });

  it('deduplicates tags across cards in the same activity', () => {
    const cards = [
      card({ activity: 'Auth', tags: ['GAP-001', 'security'] }),
      card({ id: 'T-002', title: 'OAuth', activity: 'Auth', tags: ['GAP-001', 'oauth'] }),
    ];
    const { container } = render(
      <StoryMapView cards={cards} sprintRecords={noSprints} onOpenFile={jest.fn()} />
    );
    // GAP-001 appears twice in source data but must render only once
    const metaEl = container.querySelector('[data-testid="activity-meta-Auth"]')!;
    const gap001Tags = metaEl.querySelectorAll('[data-tag="GAP-001"]');
    expect(gap001Tags).toHaveLength(1);
  });

  it('shows no activity-meta element when no tags exist', () => {
    const cards = [card({ activity: 'NoTags', tags: [] })];
    render(<StoryMapView cards={cards} sprintRecords={noSprints} onOpenFile={jest.fn()} />);
    expect(screen.queryByTestId('activity-meta-NoTags')).not.toBeInTheDocument();
  });
});
