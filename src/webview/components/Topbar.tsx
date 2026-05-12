import React from 'react';
import type { SprintRecord, TaskCard } from '../../shared/types';

interface TopbarProps {
  sprintRecords: SprintRecord[];
  cards: TaskCard[];
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function computeScore(cards: TaskCard[]): { done: number; total: number } {
  const total = cards.reduce((s, c) => s + (c.points ?? 1), 0);
  const done = cards.filter((c) => c.status === 'complete').reduce((s, c) => s + (c.points ?? 1), 0);
  return { done, total };
}

export function Topbar({ sprintRecords, cards }: TopbarProps) {
  const activeSprint =
    sprintRecords.find((r) => r.status === 'in-progress') ??
    sprintRecords.slice().sort((a, b) => b.sprint - a.sprint)[0];

  const { done, total } = computeScore(cards);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const badgeClass =
    activeSprint?.status === 'complete'
      ? 'complete'
      : activeSprint?.status === 'in-progress'
      ? 'active'
      : 'planned';

  const badgeLabel = activeSprint
    ? `Sprint ${activeSprint.sprint} ${activeSprint.status === 'complete' ? 'Complete' : activeSprint.status === 'in-progress' ? 'In Progress' : 'Planned'}`
    : null;

  return (
    <div className="mandala-topbar">
      <span className="mandala-topbar-title">Dev Brain</span>
      {badgeLabel && (
        <span className={`mandala-topbar-badge ${badgeClass}`}>{badgeLabel}</span>
      )}
      <span className="mandala-topbar-score">
        {total > 0 && (
          <>
            Score: <strong>{done}/{total}</strong> ({pct}%)
          </>
        )}
      </span>
      <span className="mandala-topbar-date">{formatDate(new Date())}</span>
    </div>
  );
}
