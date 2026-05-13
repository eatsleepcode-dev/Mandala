import React from 'react';
import type { TaskCard } from '../../shared/types';

interface Props {
  card: TaskCard | null;
  onClose: () => void;
  onOpenFile: (path: string) => void;
}

export function CardDetailPanel({ card, onClose, onOpenFile }: Props) {
  if (!card) return null;

  return (
    <div className="card-detail-panel" role="complementary" aria-label="Card detail">
      <div className="card-detail-header">
        <span className="card-detail-title">{card.title}</span>
        <div className="card-detail-actions">
          <button
            className="card-detail-btn"
            onClick={() => onOpenFile(card.path)}
            aria-label="Open file"
          >
            Open file
          </button>
          <button
            className="card-detail-btn card-detail-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="card-detail-meta">
        <Row label="ID">{card.id}</Row>
        <Row label="Sprint">Sprint {card.sprint}</Row>
        <Row label="Status">{card.status}</Row>
        <Row label="Type">{card.type}</Row>
        {card.points !== undefined && <Row label="Points">{card.points} pts</Row>}
        {card.activity && <Row label="Activity">{card.activity}</Row>}
        {card.branch && <Row label="Branch">{card.branch}</Row>}
        {card.tags.length > 0 && (
          <Row label="Tags">
            <span className="card-detail-tags">
              {card.tags.map((t) => (
                <span key={t} className="card-detail-tag">{t}</span>
              ))}
            </span>
          </Row>
        )}
      </div>

      {card.body && (
        <div className="card-detail-body">{card.body}</div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card-detail-row">
      <span className="card-detail-label">{label}</span>
      <span className="card-detail-value">{children}</span>
    </div>
  );
}
