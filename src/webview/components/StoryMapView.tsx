import React from 'react';
import type { TaskCard, TaskStatus } from '../../shared/types';

interface Props {
  cards: TaskCard[];
  onOpenFile: (path: string) => void;
}

function groupCards(cards: TaskCard[]): {
  activities: string[];
  sprints: number[];
  grid: Map<string, Map<number, TaskCard[]>>;
} {
  const activitySet = new Set<string>();
  const sprintSet = new Set<number>();

  for (const c of cards) {
    activitySet.add(c.activity ?? 'Uncategorized');
    sprintSet.add(c.sprint);
  }

  const activities = [...activitySet];
  const sprints = [...sprintSet].sort((a, b) => a - b);

  const grid = new Map<string, Map<number, TaskCard[]>>();
  for (const act of activities) {
    const bySprint = new Map<number, TaskCard[]>();
    for (const sp of sprints) {
      bySprint.set(sp, []);
    }
    grid.set(act, bySprint);
  }
  for (const c of cards) {
    const act = c.activity ?? 'Uncategorized';
    grid.get(act)!.get(c.sprint)!.push(c);
  }

  return { activities, sprints, grid };
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  planned: 'gray',
  'in-progress': 'amber',
  complete: 'green',
  blocked: 'red',
};

export function StoryMapView({ cards, onOpenFile }: Props) {
  if (cards.length === 0) {
    return (
      <div data-testid="story-map-view" className="empty-state">
        <p>No tasks found in .mandala/inbox/</p>
      </div>
    );
  }

  const { activities, sprints, grid } = groupCards(cards);

  return (
    <div data-testid="story-map-view" className="story-map-container">
      <div className="story-map-activities">
        {/* Sprint label column */}
        <div className="sprint-col-header">
          <div className="activity-header" style={{ borderBottom: '2px solid transparent' }}>
            &nbsp;
          </div>
          {sprints.map((sp) => (
            <div key={sp} className="sprint-label-cell">
              <span className="sprint-num">Sprint {sp}</span>
            </div>
          ))}
        </div>

        {activities.map((act) => (
          <div key={act} className="activity-col">
            <div className="activity-header">{act}</div>
            {sprints.map((sp) => {
              const cellCards = grid.get(act)!.get(sp)!;
              return (
                <div key={sp} className="swim-lane">
                  <div className="swim-lane-cards">
                    {cellCards.map((c) => (
                      <div
                        key={c.id}
                        className={`story-card ${c.status}`}
                        data-status={c.status}
                        onClick={() => onOpenFile(c.path)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onOpenFile(c.path)}
                      >
                        <div className="card-title">{c.title}</div>
                        <div className="card-meta">
                          <span
                            className="card-status-dot"
                            style={{ background: `var(--${STATUS_LABEL[c.status]})` }}
                          />
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
          </div>
        ))}
      </div>
    </div>
  );
}
