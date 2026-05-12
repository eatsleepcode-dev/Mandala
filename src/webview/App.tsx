import React, { useEffect, useReducer, useRef, useState } from 'react';
import { vscode } from './vscode';
import { Sidebar } from './components/Sidebar';
import { StoryMapView } from './components/StoryMapView';
import { DiaryView } from './components/DiaryView';
import { TechDebtView } from './components/TechDebtView';
import { SprintsView } from './components/SprintsView';
import { InboxView } from './components/InboxView';
import { SettingsView } from './components/SettingsView';
import { AgentsView } from './components/AgentsView';
import type {
  AgentResources,
  HostMessage,
  TaskCard,
  DiaryEntry,
  IntegrationSettings,
  ThemeOverride,
  TechDebtCard,
  SprintRecord,
} from '../shared/types';
import type { ViewId } from './components/Sidebar';

// ─── State machine ───────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: IntegrationSettings = {
  known: {
    claude: true,
    copilot: false,
    cursor: false,
    cline: false,
    claudeCommands: true,
  },
  custom: [],
};

const EMPTY_AGENT_RESOURCES: AgentResources = {
  workflows: [],
  skills: [],
  tasks: [],
  guides: [],
  registry: [],
};

type Phase =
  | { status: 'loading' }
  | { status: 'setup'; hasMigratableData: boolean }
  | {
      status: 'ready';
      cards: TaskCard[];
      entries: DiaryEntry[];
      techDebtCards: TechDebtCard[];
      sprintRecords: SprintRecord[];
      agentResources: AgentResources;
    };

interface AppState {
  phase: Phase;
  activeView: ViewId;
  settings: IntegrationSettings;
  themeOverride: ThemeOverride;
  hasGettingStartedExamples: boolean;
  inboxPath: string;
  diaryPath: string;
  sprintsPath: string;
  techDebtPath: string;
  agentsPath: string;
}

type Action =
  | { type: 'INIT'; initialized: boolean; hasMigratableData: boolean }
  | { type: 'LOAD_STORY_MAP'; cards: TaskCard[] }
  | { type: 'LOAD_DIARY'; entries: DiaryEntry[] }
  | { type: 'LOAD_TECH_DEBT'; cards: TechDebtCard[] }
  | { type: 'LOAD_SPRINTS'; records: SprintRecord[] }
  | { type: 'LOAD_AGENT_RESOURCES'; resources: AgentResources }
  | { type: 'LOAD_SETTINGS'; settings: IntegrationSettings }
  | { type: 'LOAD_THEME'; override: ThemeOverride }
  | { type: 'LOAD_WORKSPACE_PATHS'; inboxPath: string; diaryPath: string; sprintsPath: string; techDebtPath: string; agentsPath: string }
  | { type: 'LOAD_EXAMPLE_STATE'; hasGettingStartedExamples: boolean }
  | { type: 'SET_VIEW'; view: ViewId };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INIT':
      return action.initialized
        ? {
            ...state,
            phase: {
              status: 'ready',
              cards: [],
              entries: [],
              techDebtCards: [],
              sprintRecords: [],
              agentResources: EMPTY_AGENT_RESOURCES,
            },
          }
        : { ...state, phase: { status: 'setup', hasMigratableData: action.hasMigratableData } };

    case 'LOAD_STORY_MAP':
      if (state.phase.status !== 'ready') return state;
      return { ...state, phase: { ...state.phase, cards: action.cards } };

    case 'LOAD_DIARY':
      if (state.phase.status !== 'ready') return state;
      return { ...state, phase: { ...state.phase, entries: action.entries } };

    case 'LOAD_TECH_DEBT':
      if (state.phase.status !== 'ready') return state;
      return { ...state, phase: { ...state.phase, techDebtCards: action.cards } };

    case 'LOAD_SPRINTS':
      if (state.phase.status !== 'ready') return state;
      return { ...state, phase: { ...state.phase, sprintRecords: action.records } };

    case 'LOAD_AGENT_RESOURCES':
      if (state.phase.status !== 'ready') return state;
      return { ...state, phase: { ...state.phase, agentResources: action.resources } };

    case 'LOAD_SETTINGS':
      return { ...state, settings: action.settings };

    case 'LOAD_THEME':
      return { ...state, themeOverride: action.override };

    case 'LOAD_WORKSPACE_PATHS':
      return {
        ...state,
        inboxPath: action.inboxPath,
        diaryPath: action.diaryPath,
        sprintsPath: action.sprintsPath,
        techDebtPath: action.techDebtPath,
        agentsPath: action.agentsPath,
      };

    case 'LOAD_EXAMPLE_STATE':
      return { ...state, hasGettingStartedExamples: action.hasGettingStartedExamples };

    case 'SET_VIEW':
      return { ...state, activeView: action.view };

    default:
      return state;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  const isJsdom =
    typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  const isTestEnv =
    isJsdom || typeof (globalThis as { acquireVsCodeApi?: unknown }).acquireVsCodeApi !== 'function';
  const minLoadingMs = isTestEnv ? 0 : 450;

  const loadingSteps = [
    'Booting dashboard shell',
    'Reading workspace signals',
    'Loading workflows and skills',
    'Preparing guides and task cards',
  ];

  const [state, dispatch] = useReducer(reducer, {
    phase: { status: 'loading' },
    activeView: 'storymap',
    settings: DEFAULT_SETTINGS,
    themeOverride: 'auto',
    hasGettingStartedExamples: false,
    inboxPath: '.mandala/inbox',
    diaryPath: '.mandala/diary',
    sprintsPath: '.mandala/sprints',
    techDebtPath: '.mandala/tech-debt',
    agentsPath: '.mandala/agents',
  });
  const [loadingMessage, setLoadingMessage] = useState('Starting extension');
  const [loadingElapsedMs, setLoadingElapsedMs] = useState<number | undefined>(undefined);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [contentVisible, setContentVisible] = useState(false);
  const loadingStartedAtRef = useRef(Date.now());
  const initTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as HostMessage;
      switch (msg.command) {
        case 'initState':
          if (initTimerRef.current !== undefined) {
            window.clearTimeout(initTimerRef.current);
          }
          const elapsed = Date.now() - loadingStartedAtRef.current;
          const waitMs = Math.max(0, minLoadingMs - elapsed);
          if (waitMs === 0) {
            dispatch({ type: 'INIT', initialized: msg.initialized, hasMigratableData: msg.hasMigratableData });
            initTimerRef.current = undefined;
          } else {
            initTimerRef.current = window.setTimeout(() => {
              dispatch({ type: 'INIT', initialized: msg.initialized, hasMigratableData: msg.hasMigratableData });
            }, waitMs);
          }
          break;
        case 'loadStoryMap':
          dispatch({ type: 'LOAD_STORY_MAP', cards: msg.cards });
          break;
        case 'loadDiary':
          dispatch({ type: 'LOAD_DIARY', entries: msg.entries });
          break;
        case 'loadTechDebt':
          dispatch({ type: 'LOAD_TECH_DEBT', cards: msg.cards });
          break;
        case 'loadSprints':
          dispatch({ type: 'LOAD_SPRINTS', records: msg.records });
          break;
        case 'loadAgentResources':
          dispatch({ type: 'LOAD_AGENT_RESOURCES', resources: msg.resources });
          break;
        case 'loadSettings':
          dispatch({ type: 'LOAD_SETTINGS', settings: msg.settings });
          break;
        case 'loadTheme':
          dispatch({ type: 'LOAD_THEME', override: msg.override });
          break;
        case 'workspacePaths':
          dispatch({
            type: 'LOAD_WORKSPACE_PATHS',
            inboxPath: msg.inboxPath,
            diaryPath: msg.diaryPath,
            sprintsPath: msg.sprintsPath,
            techDebtPath: msg.techDebtPath,
            agentsPath: msg.agentsPath,
          });
          break;
        case 'loadExampleState':
          dispatch({ type: 'LOAD_EXAMPLE_STATE', hasGettingStartedExamples: msg.hasGettingStartedExamples });
          break;
        case 'loadProgress':
          setLoadingMessage(msg.step);
          setLoadingElapsedMs(msg.elapsedMs);
          break;
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ command: 'ready' });
    return () => {
      window.removeEventListener('message', handler);
      if (initTimerRef.current !== undefined) {
        window.clearTimeout(initTimerRef.current);
      }
    };
  }, [minLoadingMs]);

  useEffect(() => {
    document.documentElement.setAttribute('data-mandala-theme', state.themeOverride);
  }, [state.themeOverride]);

  useEffect(() => {
    if (state.phase.status !== 'loading') {
      setLoadingStepIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % loadingSteps.length);
    }, 900);

    return () => window.clearInterval(timer);
  }, [state.phase.status, loadingSteps.length]);

  useEffect(() => {
    if (state.phase.status === 'loading') {
      setContentVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setContentVisible(true), 16);
    return () => window.clearTimeout(timer);
  }, [state.phase.status]);

  const loadingIconClass = (() => {
    const step = loadingMessage.toLowerCase();
    if (step.includes('workspace')) return 'codicon-folder-library';
    if (step.includes('setting')) return 'codicon-settings-gear';
    if (step.includes('theme')) return 'codicon-symbol-color';
    if (step.includes('cards') || step.includes('diary') || step.includes('sprints')) return 'codicon-database';
    if (step.includes('composing')) return 'codicon-layout';
    if (step.includes('ready')) return 'codicon-pass-filled';
    return 'codicon-sync';
  })();

  const openFile = (path: string) => vscode.postMessage({ command: 'openFile', path });
  const runSdlcStep = (
    step: 'plan' | 'execute' | 'validate' | 'close',
    suggestedSlash: string,
    fallbackPath?: string
  ) => vscode.postMessage({ command: 'runSdlcStep', step, suggestedSlash, fallbackPath });
  const setThemeOverride = (override: ThemeOverride) =>
    vscode.postMessage({ command: 'setThemeOverride', override });

  const { phase, activeView, settings } = state;

  if (phase.status === 'loading') {
    return (
      <div className="mandala-loading" role="status" aria-live="polite">
        <div className="mandala-loading-glow" aria-hidden="true" />
        <h1 className="mandala-loading-title">Mandala is waking up</h1>
        <p className="mandala-loading-subtitle">
          <span className={`codicon ${loadingIconClass} mandala-loading-icon`} aria-hidden="true" />
          {loadingMessage || loadingSteps[loadingStepIndex]}…
          {loadingElapsedMs !== undefined ? (
            <span className="mandala-loading-ms">{loadingElapsedMs}ms</span>
          ) : null}
        </p>
        <div className="mandala-loading-track" aria-hidden="true">
          <div className="mandala-loading-bar" />
        </div>
        <div className="mandala-loading-grid" aria-hidden="true">
          <div className="mandala-loading-card" />
          <div className="mandala-loading-card" />
          <div className="mandala-loading-card" />
        </div>
      </div>
    );
  }

  if (phase.status === 'setup') {
    return (
      <div className={`mandala-setup mandala-boot-target${contentVisible ? ' is-visible' : ''}`}>
        <div className="mandala-welcome-container">
          <div className="mandala-welcome-glow" aria-hidden="true" />
          <h1 className="mandala-welcome-title">Welcome to Mandala</h1>
          <p className="mandala-welcome-subtitle">Your developer diary and sprint planner</p>

          {phase.hasMigratableData ? (
            <div className="mandala-welcome-content">
              <p className="mandala-welcome-text">
                We found existing data in your workspace (.meridian/, __inbox/, diary/, or .agents/). 
                Would you like to migrate it to the new .mandala/ structure?
              </p>
              <div className="mandala-welcome-actions">
                <button 
                  className="mandala-btn mandala-btn-primary"
                  onClick={() => vscode.postMessage({ command: 'migrateWorkspace' })}
                >
                  Migrate Existing Data
                </button>
                <button 
                  className="mandala-btn mandala-btn-secondary"
                  onClick={() => vscode.postMessage({ command: 'initWorkspace' })}
                >
                  Start Fresh
                </button>
              </div>
            </div>
          ) : (
            <div className="mandala-welcome-content">
              <p className="mandala-welcome-text">
                To get started, initialize a new Mandala workspace. This creates the .mandala/ folder 
                with all necessary directories for managing your diary, sprints, tasks, and more.
              </p>
              <div className="mandala-welcome-actions">
                <button 
                  className="mandala-btn mandala-btn-primary"
                  onClick={() => vscode.postMessage({ command: 'initWorkspace', withExamples: true })}
                >
                  Initialize with Examples
                </button>
                <button 
                  className="mandala-btn mandala-btn-secondary"
                  onClick={() => vscode.postMessage({ command: 'initWorkspace' })}
                >
                  Initialize Empty Workspace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`mandala-dashboard mandala-boot-target${contentVisible ? ' is-visible' : ''}`}>
      <Sidebar active={activeView} onSelect={(v) => dispatch({ type: 'SET_VIEW', view: v })} />
      <main className="mandala-main">
        {state.hasGettingStartedExamples && (
          <div className="mandala-example-badge-row" role="status" aria-live="polite">
            <span className="mandala-example-badge">Starter Examples Active</span>
          </div>
        )}
        {activeView === 'storymap' && (
          <StoryMapView cards={phase.cards} onOpenFile={openFile} />
        )}
        {activeView === 'diary' && (
          <DiaryView entries={phase.entries} onOpenFile={openFile} />
        )}
        {activeView === 'techdebt' && (
          <TechDebtView cards={phase.techDebtCards} onOpenFile={openFile} />
        )}
        {activeView === 'sprints' && (
          <SprintsView records={phase.sprintRecords} onOpenFile={openFile} />
        )}
        {activeView === 'inbox' && (
          <InboxView cards={phase.cards} onOpenFile={openFile} />
        )}
        {activeView === 'agents' && (
          <AgentsView
            resources={phase.agentResources}
            onOpenFile={openFile}
            onRunSdlcStep={runSdlcStep}
          />
        )}
        {activeView === 'settings' && (
          <SettingsView
            settings={settings}
            themeOverride={state.themeOverride}
            hasGettingStartedExamples={state.hasGettingStartedExamples}
            inboxPath={state.inboxPath}
            diaryPath={state.diaryPath}
            sprintsPath={state.sprintsPath}
            techDebtPath={state.techDebtPath}
            agentsPath={state.agentsPath}
            onThemeOverrideChange={setThemeOverride}
            onWorkspacePathChange={(path, value) => {
              vscode.postMessage({ command: 'updateWorkspacePath', path, value });
            }}
            onSeedExamples={() => vscode.postMessage({ command: 'seedExamples' })}
            onRemoveExamples={() => vscode.postMessage({ command: 'removeExamples' })}
            onReinitializeWorkspace={() => vscode.postMessage({ command: 'reinitializeWorkspace' })}
            onSave={(nextSettings) => {
              dispatch({ type: 'LOAD_SETTINGS', settings: nextSettings });
              vscode.postMessage({ command: 'saveSettings', settings: nextSettings });
            }}
          />
        )}
      </main>
    </div>
  );
}
