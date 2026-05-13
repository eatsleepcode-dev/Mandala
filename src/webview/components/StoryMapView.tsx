import React, { useState } from 'react';
import type { TaskCard, TaskStatus, SprintRecord } from '../../shared/types';
import { fmtDateRange } from '../dates';

interface Props {
  cards: TaskCard[];
  sprintRecords: SprintRecord[];
  onOpenFile: (path: string) => void;
  onSelectCard?: (card: TaskCard) => void;
}

type Filter = 'all' | 'complete' | 'planned' | 'blocked';

function buildMatrix(cards: TaskCard[], sprintRecords: SprintRecord[]): {
  activities: string[];
  sprints: number[];
  grid: Map<string, Map<number, TaskCard[]>>;
  activityTags: Map<string, string[]>;
} {
  const activitySet = new Set<string>();
  const sprintSet = new Set<number>();

  for (const c of cards) {
    activitySet.add(c.activity ?? 'Uncategorized');
    sprintSet.add(c.sprint);
  }

  for (const r of sprintRecords) {
    sprintSet.add(r.sprint);
  }

  const activities = [...activitySet];
  const sprints = [...sprintSet].sort((a, b) => b - a);

  const grid = new Map<string, Map<number, TaskCard[]>>();
  const activityTags = new Map<string, string[]>();
  for (const act of activities) {
    const bySprint = new Map<number, TaskCard[]>();
    for (const sp of sprints) bySprint.set(sp, []);
    grid.set(act, bySprint);
    activityTags.set(act, []);
  }
  for (const c of cards) {
    const act = c.activity ?? 'Uncategorized';
    grid.get(act)!.get(c.sprint)!.push(c);
    if (c.tags?.length) {
      const existing = activityTags.get(act)!;
      for (const tag of c.tags) {
        if (!existing.includes(tag)) existing.push(tag);
      }
    }
  }

  return { activities, sprints, grid, activityTags };
}

const STATUS_DOT: Record<TaskStatus, string> = {
  complete: 'dot-green',
  'in-progress': 'dot-amber',
  planned: 'dot-gray',
  blocked: 'dot-red',
};

const FILTER_OPTIONS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'complete', label: '✅ Complete' },
  { id: 'planned', label: '📋 Planned' },
  { id: 'blocked', label: '🔴 Blocked' },
];

export function StoryMapView({ cards, sprintRecords, onOpenFile, onSelectCard }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const filteredCards = cards.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'complete') return c.status === 'complete';
    if (filter === 'planned') return c.status === 'planned';
    if (filter === 'blocked') return c.status === 'blocked';
    return true;
  });

  if (cards.length === 0) {
    return (
      <div data-testid="story-map-view" className="empty-state">
        <p>No tasks found in .mandala/inbox/</p>
      </div>
    );
  }

  const { activities, sprints, grid, activityTags } = buildMatrix(filteredCards, sprintRecords);
  const sprintMap = new Map(sprintRecords.map((r) => [r.sprint, r]));

  const completedTotal = cards.filter((c) => c.status === 'complete').length;
  const subtitle = `${cards.length} tasks · ${completedTotal} complete · ${sprints.length} sprints`;

  return (
    <div data-testid="story-map-view" className="view active" id="view-storymap">
      <div className="view-header">
        <div>
          <h2>Jeff Patton Story Map</h2>
          <div className="subtitle">{subtitle}</div>
        </div>
        <div className="filter-row" style={{ marginLeft: 'auto' }}>
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-chip ${filter === f.id ? 'active' : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredCards.length === 0 && (
        <div className="story-map-empty-filter">
          No tasks match the current filter.
        </div>
      )}

      {/* Activities = columns, Sprints = rows */}
      {filteredCards.length > 0 && <div className="story-map-container">
        <div className="story-map-activities" style={{ display: 'grid', gridTemplateColumns: `120px repeat(${activities.length}, minmax(240px, 1fr))` }}>

          {/* Header Row */}
          <div className="sprint-col-header activity-header" style={{ position: 'sticky', top: 0, zIndex: 6, minHeight: 54 }}>Sprint</div>
          
          {activities.map((act) => {
            const tags = activityTags.get(act) ?? [];
            return (
              <div key={`header-${act}`} className="activity-col activity-header" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                {act}
                {tags.length > 0 && (
                  <div className="activity-meta" data-testid={`activity-meta-${act}`}>
                    {tags.map((tag) => (
                      <span key={tag} className="activity-meta-tag" data-tag={tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Data Rows for Sprints */}
          {sprints.map((sp) => {
            const record = sprintMap.get(sp);
            const badgeClass =
              record?.status === 'complete' ? 'badge-complete'
              : record?.status === 'in-progress' ? 'badge-active'
              : 'badge-planned';
            const badgeLabel =
              record?.status === 'complete' ? 'COMPLETE'
              : record?.status === 'in-progress' ? 'ACTIVE'
              : 'PLANNED';
            const dateRange = record ? fmtDateRange(record.startDate, record.endDate) : null;
            return (
              <React.Fragment key={sp}>
                {/* Leftmost sprint label cell */}
                <div className="sprint-col-header sprint-label-cell" style={{ borderRight: '2px solid var(--border)' }}>
                  <span className="sprint-num">Sprint {sp}</span>
                  {record?.goal && <span className="sprint-title">{record.goal}</span>}
                  {dateRange && <span className="sprint-date-range">{dateRange}</span>}
                  <span className={`sprint-status-badge ${badgeClass}`} style={{ display: 'inline-block' }}>{badgeLabel}</span>
                </div>

                {/* Activity swimlanes for this sprint */}
                {activities.map((act) => {
                  const cellCards = grid.get(act)!.get(sp)!;
                  return (
                    <div key={`${act}-${sp}`} className="activity-col swim-lane" style={{ borderRight: '1px solid var(--border)' }}>
                      <div className="swim-lane-cards">
                        {cellCards.map((c) => (
                        <div
                          key={c.id}
                          className={`story-card ${c.status}`}
                          data-status={c.status}
                          onClick={() => onSelectCard ? onSelectCard(c) : onOpenFile(c.path)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && (onSelectCard ? onSelectCard(c) : onOpenFile(c.path))}
                        >
                          <div className="card-title">
                            <span className={`card-status-dot ${STATUS_DOT[c.status]}`} />
                            {c.title}
                          </div>
                          <div className="card-meta">
                            {c.id && <span className="card-tag">{c.id}</span>}
                            <span className="card-tag">{c.type}</span>
                            {c.points !== undefined && (
                              <span className="card-tag">{c.points}pt</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
                })}
              </React.Fragment>
            );
          })}

        </div>
      </div>}
    </div>
  );
}
