import React from 'react';
import type { SprintRecord, TaskStatus } from '../../shared/types';

interface SprintsViewProps {
  records: SprintRecord[];
  onOpenFile: (path: string) => void;
}

export function SprintsView({ records, onOpenFile }: SprintsViewProps) {
  // Group by status
  const inProgress = records.filter((r) => r.status === 'in-progress');
  const planned = records.filter((r) => r.status === 'planned');
  const complete = records.filter((r) => r.status === 'complete');

  const renderColumn = (title: string, statusClass: string, items: SprintRecord[]) => (
    <div className="sprint-col">
      <div className={`sprint-col-title ${statusClass}`}>
        <span>{title}</span>
        <span className="sprint-count">{items.length}</span>
      </div>
      <div className="sprint-cards">
        {items.map((r) => (
          <div
            key={r.sprint}
            className={`sprint-card ${statusClass}`}
            onClick={() => onOpenFile(r.path)}
          >
            <div className="sprint-card-num">Sprint {r.sprint}</div>
            <div className="sprint-card-title">{r.goal}</div>
            {(r.startDate || r.endDate) && (
              <div className="sprint-card-meta">
                {r.startDate && <span>{r.startDate}</span>}
                {r.startDate && r.endDate && <span> → </span>}
                {r.endDate && <span>{r.endDate}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="view active" id="view-sprints">
      <div className="view-header">
        <div>
          <h2>Sprint Register</h2>
          <div className="subtitle">{records.length} sprints tracked</div>
        </div>
      </div>
      <div className="view-body" style={{ overflow: 'auto' }}>
        <div className="sprint-board">
          {renderColumn('Active', 'active', inProgress)}
          {renderColumn('Planned', 'planned', planned)}
          {renderColumn('Complete', 'complete', complete)}
        </div>
      </div>
    </div>
  );
}
