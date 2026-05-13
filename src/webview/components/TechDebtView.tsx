import React, { useState } from 'react';
import type { TechDebtCard } from '../../shared/types';
import { fmtDate } from '../dates';

interface TechDebtViewProps {
  cards: TechDebtCard[];
  onOpenFile: (path: string) => void;
  onOpenMarkdownPreview?: (path: string) => void;
}

type Filter = 'all' | 'open' | 'resolved';

const FILTER_OPTIONS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: '🔴 Open' },
  { id: 'resolved', label: '✅ Resolved' },
];

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortCards(cards: TechDebtCard[]): TechDebtCard[] {
  return [...cards].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    return (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3);
  });
}

export function TechDebtView({ cards, onOpenFile, onOpenMarkdownPreview }: TechDebtViewProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const filteredCards = sortCards(
    cards.filter((card) => {
      if (filter === 'all') return true;
      return card.status === filter;
    })
  );

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
                <span className="td-date">Added {fmtDate(card.added)}</span>
                {onOpenMarkdownPreview && (
                  <button
                    className="td-preview-btn"
                    title="Preview rendered markdown"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMarkdownPreview(card.path);
                    }}
                    style={{
                      marginLeft: 'auto',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'inherit',
                      opacity: 0.7
                    }}
                  >
                    <span className="codicon codicon-eye" />
                  </button>
                )}
              </div>
              <div className="td-title">{card.title}</div>
              <div className="td-desc">
                {card.body.length > 120 ? card.body.substring(0, 120) + '...' : card.body}
              </div>
              {card.tags.length > 0 && (
                <div className="td-footer">
                  {card.tags.map((tag) => (
                    <span key={tag} className="td-chip">{tag}</span>
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
