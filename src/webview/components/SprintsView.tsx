import React from 'react';
import type { SprintRecord } from '../../shared/types';
import { fmtDateRange } from '../dates';

interface SprintsViewProps {
  records: SprintRecord[];
  onOpenFile: (path: string) => void;
  onOpenMarkdownPreview?: (path: string) => void;
}

export function SprintsView({ records, onOpenFile, onOpenMarkdownPreview }: SprintsViewProps) {
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
        {items.map((r) => {
          const dateRange = fmtDateRange(r.startDate, r.endDate);
          return (
            <div
              key={r.sprint}
              className={`sprint-card ${statusClass}`}
              onClick={() => onOpenFile(r.path)}
            >
              <div className="sprint-card-num">Sprint {r.sprint}</div>
              <div className="sprint-card-title">{r.goal}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                {dateRange && <div className="sprint-card-meta">{dateRange}</div>}
                {onOpenMarkdownPreview && (
                  <button
                    className="sprint-preview-btn"
                    title="Preview rendered markdown"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMarkdownPreview(r.path);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'inherit',
                      opacity: 0.6
                    }}
                  >
                    <span className="codicon codicon-eye" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
