import React, { useState } from 'react';
import type { TechDebtCard } from '../../shared/types';

interface TechDebtViewProps {
  cards: TechDebtCard[];
  onOpenFile: (path: string) => void;
}

type Filter = 'all' | 'open' | 'resolved';

export function TechDebtView({ cards, onOpenFile }: TechDebtViewProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const filteredCards = cards.filter((card) => {
    if (filter === 'all') return true;
    return card.status === filter;
  });

  return (
    <div className="view active" id="view-tech-debt">
      <div className="view-header">
        <div>
          <h2>Tech Debt Register</h2>
          <div className="subtitle">
            {cards.length} items · {cards.filter((c) => c.status === 'resolved').length} resolved
          </div>
        </div>
        <div className="filter-row" style={{ margin: '0 0 0 auto' }}>
          <span
            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </span>
          <span
            className={`filter-chip ${filter === 'open' ? 'active' : ''}`}
            onClick={() => setFilter('open')}
          >
            🔴 Open
          </span>
          <span
            className={`filter-chip ${filter === 'resolved' ? 'active' : ''}`}
            onClick={() => setFilter('resolved')}
          >
            ✅ Resolved
          </span>
        </div>
      </div>

      <div className="view-body" style={{ overflow: 'auto' }}>
        <div className="td-grid">
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className={`td-card sev-${card.severity} ${card.status === 'resolved' ? 'resolved' : ''}`}
              onClick={() => onOpenFile(card.path)}
            >
              <div className="td-header">
                <span className="td-id">{card.id}</span>
                <span className={`td-sev sev-${card.severity}`}>
                  {card.severity.toUpperCase()}
                </span>
                <span className="td-date">Added {card.added}</span>
              </div>
              <div className="td-title">{card.title}</div>
              <div className="td-desc">
                {card.body.length > 120 ? card.body.substring(0, 120) + '...' : card.body}
              </div>
              {card.tags.length > 0 && (
                <div className="td-footer">
                  {card.tags.map((tag) => (
                    <span key={tag} className="td-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
