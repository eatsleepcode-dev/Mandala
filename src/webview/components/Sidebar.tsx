import React from 'react';

export type ViewId = 'storymap' | 'diary' | 'calendar' | 'sprints' | 'techdebt' | 'inbox' | 'settings';

interface SidebarProps {
  active: ViewId;
  onSelect: (view: ViewId) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav className="mandala-sidebar">
      <div
        className={`mandala-sidebar-icon ${active === 'storymap' ? 'active' : ''}`}
        onClick={() => onSelect('storymap')}
        title="Story Map"
      >
        <span className="codicon codicon-map"></span>
        <span className="mandala-sidebar-tooltip">Story Map</span>
      </div>
      <div
        className={`mandala-sidebar-icon ${active === 'diary' ? 'active' : ''}`}
        onClick={() => onSelect('diary')}
        title="Code Diary"
      >
        <span className="codicon codicon-book"></span>
        <span className="mandala-sidebar-tooltip">Code Diary</span>
      </div>
      <div
        className={`mandala-sidebar-icon ${active === 'calendar' ? 'active' : ''}`}
        onClick={() => onSelect('calendar')}
        title="Calendar"
      >
        <span className="codicon codicon-calendar"></span>
        <span className="mandala-sidebar-tooltip">Calendar</span>
      </div>
      <div className="mandala-sidebar-divider"></div>
      <div
        className={`mandala-sidebar-icon ${active === 'sprints' ? 'active' : ''}`}
        onClick={() => onSelect('sprints')}
        title="Sprints"
      >
        <span className="codicon codicon-flame"></span>
        <span className="mandala-sidebar-tooltip">Sprints</span>
      </div>
      <div
        className={`mandala-sidebar-icon ${active === 'techdebt' ? 'active' : ''}`}
        onClick={() => onSelect('techdebt')}
        title="Tech Debt"
      >
        <span className="codicon codicon-wrench"></span>
        <span className="mandala-sidebar-tooltip">Tech Debt</span>
      </div>
      <div className="mandala-sidebar-divider"></div>
      <div
        className={`mandala-sidebar-icon ${active === 'inbox' ? 'active' : ''}`}
        onClick={() => onSelect('inbox')}
        title="Inbox"
      >
        <span className="codicon codicon-inbox"></span>
        <span className="mandala-sidebar-tooltip">Inbox</span>
      </div>

      {/* Sticky footer for info/settings */}
      <div className="mandala-sidebar-footer">
        <div
          className="mandala-sidebar-icon"
          onClick={() => {
            import('../vscode').then(m => m.vscode.postMessage({ command: 'openGuide' }));
          }}
          title="About Mandala"
        >
          <span className="codicon codicon-info"></span>
          <span className="mandala-sidebar-tooltip">Mandala v0.1.5</span>
        </div>
        <div
          className="mandala-sidebar-icon"
          onClick={() => {
            // Tell host to open VS Code settings editor filtered to this extension
            import('../vscode').then(m => m.vscode.postMessage({ command: 'openSettings' }));
          }}
          title="Settings"
        >
          <span className="codicon codicon-settings-gear"></span>
          <span className="mandala-sidebar-tooltip">Settings</span>
        </div>
      </div>
    </nav>
  );
}
