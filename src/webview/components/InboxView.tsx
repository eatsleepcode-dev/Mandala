import React, { useState } from 'react';
import type { TaskCard } from '../../shared/types';

interface InboxViewProps {
  cards: TaskCard[];
  onOpenFile: (path: string) => void;
}

type Filter = 'all' | 'active' | 'planned' | 'complete';

export function InboxView({ cards, onOpenFile }: InboxViewProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const filteredCards = cards.filter((card) => {
    if (filter === 'all') return true;
    if (filter === 'active') return card.status === 'in-progress';
    return card.status === filter;
  });

  return (
    <div className="view active" id="view-inbox">
      <div className="view-header">
        <div>
          <h2>Inbox</h2>
          <div className="subtitle">{cards.length} total tasks</div>
        </div>
        <div className="filter-row" style={{ margin: '0 0 0 auto' }}>
          <span
            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </span>
          <span
            className={`filter-chip ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            🔴 Active
          </span>
          <span
            className={`filter-chip ${filter === 'planned' ? 'active' : ''}`}
            onClick={() => setFilter('planned')}
          >
            📋 Planned
          </span>
          <span
            className={`filter-chip ${filter === 'complete' ? 'active' : ''}`}
            onClick={() => setFilter('complete')}
          >
            ✅ Complete
          </span>
        </div>
      </div>

      <div className="view-body" style={{ overflow: 'auto' }}>
        <div className="td-grid">
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className={`td-card sev-low ${card.status === 'complete' ? 'resolved' : ''}`}
              onClick={() => onOpenFile(card.path)}
            >
              <div className="td-header">
                <span className="td-id">{card.id}</span>
                <span className={`td-sev sev-low`}>
                  Sprint {card.sprint}
                </span>
              </div>
              <div className="td-title">{card.title}</div>
              <div className="td-desc">
                {card.body.length > 120 ? card.body.substring(0, 120) + '...' : card.body}
              </div>
              <div className="td-footer">
                <span className="td-chip">{card.type}</span>
                {card.tags.map((tag) => (
                  <span key={tag} className="td-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
