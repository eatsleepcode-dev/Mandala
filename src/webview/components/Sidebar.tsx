import React from 'react';

export type ViewId = 'storymap' | 'diary' | 'settings';

interface Props {
  active: ViewId;
  onSelect: (view: ViewId) => void;
}

const ITEMS: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: 'storymap', label: 'Story Map', icon: '⊞' },
  { id: 'diary', label: 'Diary', icon: '📓' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar({ active, onSelect }: Props) {
  return (
    <nav className="sidebar" aria-label="Mandala navigation">
      {ITEMS.map(({ id, label, icon }) => (
        <button
          key={id}
          className={`sidebar-icon ${active === id ? 'active' : ''}`}
          title={label}
          aria-label={label}
          onClick={() => onSelect(id)}
        >
          <span aria-hidden>{icon}</span>
          <span className="tooltip">{label}</span>
        </button>
      ))}
    </nav>
  );
}
