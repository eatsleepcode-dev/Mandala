import React, { useState } from 'react';
import type { DiaryEntry } from '../../shared/types';

interface Props {
  entries: DiaryEntry[];
  onOpenFile: (path: string) => void;
}

export function DiaryView({ entries, onOpenFile }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (entries.length === 0) {
    return (
      <div data-testid="diary-view" className="empty-state">
        <p>No diary entries found in .meridian/diary/</p>
      </div>
    );
  }

  const selected = entries[selectedIdx];

  return (
    <div data-testid="diary-view" className="diary-layout">
      {/* Sidebar list */}
      <nav className="diary-sidebar">
        {entries.map((e, i) => (
          <div
            key={e.path}
            className={`diary-entry-row ${i === selectedIdx ? 'active' : ''}`}
            onClick={() => setSelectedIdx(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(ev) => ev.key === 'Enter' && setSelectedIdx(i)}
          >
            <span className="diary-hash">{e.date}</span>
            <div>
              <div className="diary-entry-title">{e.title}</div>
              <div className={`diary-entry-type type-${e.type}`}>{e.type}</div>
            </div>
          </div>
        ))}
      </nav>

      {/* Content pane */}
      <div className="diary-content">
        <div className="diary-content-header">
          <div className="diary-content-hash">{selected.date}</div>
          <div className="diary-content-title">{selected.title}</div>
          <div className="diary-content-meta">
            <span className={`diary-chip type-${selected.type}`}>{selected.type}</span>
            {selected.branch && (
              <span className="diary-chip branch">{selected.branch}</span>
            )}
            {selected.techDebt && <span className="diary-chip td">Tech Debt</span>}
            {selected.adr && <span className="diary-chip adr">ADR</span>}
            <button
              className="diary-chip"
              title="Open in editor"
              onClick={() => onOpenFile(selected.path)}
            >
              ↗ Open in editor
            </button>
          </div>
        </div>

        <div className="diary-body">
          {selected.files && selected.files.length > 0 && (
            <>
              <h3>Files changed</h3>
              <div className="file-list">
                {selected.files.map((f) => (
                  <span key={f} className="file-tag">{f}</span>
                ))}
              </div>
            </>
          )}
          <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{selected.body}</p>
        </div>
      </div>
    </div>
  );
}
