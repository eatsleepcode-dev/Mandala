import React from 'react';
import type { SprintRecord, TaskCard } from '../../shared/types';
import { computeScore } from '../score';

interface TopbarProps {
  sprintRecords: SprintRecord[];
  cards: TaskCard[];
  onSearch: (query: string) => void;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function Topbar({ sprintRecords, cards, onSearch }: TopbarProps) {
  const activeSprint =
    sprintRecords.find((r) => r.status === 'in-progress') ??
    sprintRecords.slice().sort((a, b) => b.sprint - a.sprint)[0];

  const { done, total, pct } = computeScore(cards);

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
      <span className="mandala-topbar-title">Mandala</span>
      {badgeLabel && (
        <span className={`mandala-topbar-badge ${badgeClass}`}>{badgeLabel}</span>
      )}
      <input
        type="search"
        role="searchbox"
        className="mandala-topbar-search"
        placeholder="⌕ Search tasks…"
        aria-label="Search tasks"
        onChange={(e) => onSearch(e.target.value)}
      />
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
