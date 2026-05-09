import React, { useEffect, useReducer } from 'react';
import { vscode } from './vscode';
import { Sidebar } from './components/Sidebar';
import { StoryMapView } from './components/StoryMapView';
import { DiaryView } from './components/DiaryView';
import type { HostMessage, TaskCard, DiaryEntry } from '../shared/types';
import type { ViewId } from './components/Sidebar';

// ─── State machine ───────────────────────────────────────────────────────────

type Phase =
  | { status: 'loading' }
  | { status: 'setup'; hasMigratableData: boolean }
  | { status: 'ready'; cards: TaskCard[]; entries: DiaryEntry[] };

interface AppState {
  phase: Phase;
  activeView: ViewId;
}

type Action =
  | { type: 'INIT'; initialized: boolean; hasMigratableData: boolean }
  | { type: 'LOAD_STORY_MAP'; cards: TaskCard[] }
  | { type: 'LOAD_DIARY'; entries: DiaryEntry[] }
  | { type: 'SET_VIEW'; view: ViewId };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INIT':
      return action.initialized
        ? { ...state, phase: { status: 'ready', cards: [], entries: [] } }
        : { ...state, phase: { status: 'setup', hasMigratableData: action.hasMigratableData } };

    case 'LOAD_STORY_MAP':
      if (state.phase.status !== 'ready') return state;
      return { ...state, phase: { ...state.phase, cards: action.cards } };

    case 'LOAD_DIARY':
      if (state.phase.status !== 'ready') return state;
      return { ...state, phase: { ...state.phase, entries: action.entries } };

    case 'SET_VIEW':
      return { ...state, activeView: action.view };

    default:
      return state;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, {
    phase: { status: 'loading' },
    activeView: 'storymap',
  });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as HostMessage;
      switch (msg.command) {
        case 'initState':
          dispatch({ type: 'INIT', initialized: msg.initialized, hasMigratableData: msg.hasMigratableData });
          break;
        case 'loadStoryMap':
          dispatch({ type: 'LOAD_STORY_MAP', cards: msg.cards });
          break;
        case 'loadDiary':
          dispatch({ type: 'LOAD_DIARY', entries: msg.entries });
          break;
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const openFile = (path: string) => vscode.postMessage({ command: 'openFile', path });

  const { phase, activeView } = state;

  if (phase.status === 'loading') {
    return <div className="meridian-loading">Loading…</div>;
  }

  if (phase.status === 'setup') {
    return (
      <div className="meridian-setup">
        <h1>Meridian</h1>
        {phase.hasMigratableData ? (
          <>
            <p>Existing __inbox/, diary/, or .agents/ folders detected.</p>
            <button onClick={() => vscode.postMessage({ command: 'migrateWorkspace' })}>
              Migrate to .meridian/
            </button>
          </>
        ) : (
          <>
            <p>No .meridian/ workspace found.</p>
            <button onClick={() => vscode.postMessage({ command: 'initWorkspace' })}>
              Initialize .meridian/
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="meridian-dashboard">
      <Sidebar active={activeView} onSelect={(v) => dispatch({ type: 'SET_VIEW', view: v })} />
      <main className="meridian-main">
        {activeView === 'storymap' && (
          <StoryMapView cards={phase.cards} onOpenFile={openFile} />
        )}
        {activeView === 'diary' && (
          <DiaryView entries={phase.entries} onOpenFile={openFile} />
        )}
      </main>
    </div>
  );
}
