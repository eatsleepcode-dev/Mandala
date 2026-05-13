import React, { useEffect, useReducer, useRef, useState } from 'react';
import { vscode } from './vscode';
import { computeScore } from './score';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { StoryMapView } from './components/StoryMapView';
import { DiaryView } from './components/DiaryView';
import { TechDebtView } from './components/TechDebtView';
import { SprintsView } from './components/SprintsView';
import { InboxView } from './components/InboxView';
import { SettingsView } from './components/SettingsView';
import { AgentsView } from './components/AgentsView';
import { CardDetailPanel } from './components/CardDetailPanel';
import { ThermostatSettingsPage } from './components/ThermostatSettingsPage';
import type {
  AgentResources,
  FolderCandidates,
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
  ado: {
    orgUrl: '',
    project: '',
    workItemType: 'Task',
  },
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
  | { status: 'setup'; hasMigratableData: boolean; folderCandidates: FolderCandidates }
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
  | { type: 'INIT'; initialized: boolean; hasMigratableData: boolean; folderCandidates: FolderCandidates }
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
        : { ...state, phase: { status: 'setup', hasMigratableData: action.hasMigratableData, folderCandidates: action.folderCandidates } };

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

// ─── Workspace setup form ────────────────────────────────────────────────────
function WorkspaceSetupForm({ candidates, contentVisible }: { candidates: FolderCandidates; contentVisible: boolean }) {
  const [inbox, setInbox] = useState(candidates.inbox);
  const [diary, setDiary] = useState(candidates.diary);
  const [sprints, setSprints] = useState(candidates.sprints);
  const [techDebt, setTechDebt] = useState(candidates.techDebt);
  const [agents, setAgents] = useState(candidates.agents);

  function apply() {
    vscode.postMessage({ command: 'mapWorkspace', inbox, diary, sprints, techDebt, agents });
  }

  const rows: { label: string; value: string; set: (v: string) => void; hint: string }[] = [
    { label: 'Inbox', value: inbox, set: setInbox, hint: 'Task cards & sprint backlog' },
    { label: 'Diary', value: diary, set: setDiary, hint: 'Daily dev diary entries' },
    { label: 'Sprints', value: sprints, set: setSprints, hint: 'Sprint records' },
    { label: 'Tech Debt', value: techDebt, set: setTechDebt, hint: 'Tech debt cards' },
    { label: 'Agents', value: agents, set: setAgents, hint: 'AI context, skills & workflows' },
  ];

  return (
    <div className={`mandala-setup mandala-boot-target${contentVisible ? ' is-visible' : ''}`}>
      <div className="mandala-welcome-container">
        <div className="mandala-welcome-glow" aria-hidden="true" />
        <h1 className="mandala-welcome-title">Map Your Folders</h1>
        <p className="mandala-welcome-subtitle">Point Mandala to where your data lives</p>
        <div className="mandala-welcome-content">
          <p className="mandala-welcome-text">
            Confirm or edit the folder paths below. Existing folders are used as-is;
            paths that don’t exist will be created.
          </p>
          <div className="mandala-folder-map">
            {rows.map(({ label, value, set, hint }) => (
              <label key={label} className="mandala-folder-map-row">
                <span className="mandala-folder-map-label">{label}</span>
                <input
                  type="text"
                  className="mandala-folder-map-input"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  spellCheck={false}
                />
                <span className="mandala-folder-map-hint">{hint}</span>
              </label>
            ))}
          </div>
          <div className="mandala-welcome-actions">
            <button className="mandala-btn mandala-btn-primary" onClick={apply}>
              Apply &amp; Open Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  const isJsdom =
    typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  const isTestEnv =
    isJsdom || typeof (globalThis as { acquireVsCodeApi?: unknown }).acquireVsCodeApi !== 'function';
  const minLoadingMs = 0;

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
            dispatch({ type: 'INIT', initialized: msg.initialized, hasMigratableData: msg.hasMigratableData, folderCandidates: msg.folderCandidates });
            initTimerRef.current = undefined;
          } else {
            initTimerRef.current = window.setTimeout(() => {
              dispatch({ type: 'INIT', initialized: msg.initialized, hasMigratableData: msg.hasMigratableData, folderCandidates: msg.folderCandidates });
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
        case 'setView':
          dispatch({ type: 'SET_VIEW', view: msg.view as any });
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
  const openMarkdownPreview = (path: string) => vscode.postMessage({ command: 'openMarkdownPreview', path });
  const openInPanel = (panelId: string, title: string, initialView?: string) =>
    vscode.postMessage({ command: 'openInPanel', panelId, title, initialView });
  const runSdlcStep = (
    step: 'plan' | 'execute' | 'validate' | 'close',
    suggestedSlash: string,
    fallbackPath?: string
  ) => vscode.postMessage({ command: 'runSdlcStep', step, suggestedSlash, fallbackPath });
  const setThemeOverride = (override: ThemeOverride) =>
    vscode.postMessage({ command: 'setThemeOverride', override });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<TaskCard | null>(null);

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
    return <WorkspaceSetupForm candidates={phase.folderCandidates} contentVisible={contentVisible} />;
  }

  const q = searchQuery.trim().toLowerCase();
  const visibleCards = q
    ? phase.cards.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.id?.toLowerCase().includes(q) ||
          c.activity?.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q))
      )
    : phase.cards;

  const statusLabel = (() => {
    const active = phase.sprintRecords.find((r) => r.status === 'in-progress');
    const latest = phase.sprintRecords.slice().sort((a, b) => b.sprint - a.sprint)[0];
    const sprint = active ?? latest;
    const { done, total, pct } = computeScore(phase.cards);
    const parts: string[] = [];
    if (sprint) parts.push(`Sprint ${sprint.sprint}`);
    if (total > 0) parts.push(`${done}/${total} pts (${pct}%)`);
    parts.push(`${phase.cards.length} tasks`);
    return parts.join(' · ');
  })();

  return (
    <div className={`mandala-dashboard mandala-boot-target${contentVisible ? ' is-visible' : ''}`}>
      <Sidebar active={activeView} onSelect={(v) => { dispatch({ type: 'SET_VIEW', view: v }); setSelectedCard(null); }} />
      <main className="mandala-main">
        <Topbar sprintRecords={phase.sprintRecords} cards={phase.cards} onSearch={setSearchQuery} />
        {state.hasGettingStartedExamples && (
          <div className="mandala-example-badge-row" role="status" aria-live="polite">
            <span className="mandala-example-badge">Starter Examples Active</span>
          </div>
        )}
        {activeView === 'storymap' && (
          <StoryMapView
            cards={visibleCards}
            sprintRecords={phase.sprintRecords}
            onOpenFile={openFile}
            onSelectCard={setSelectedCard}
            onExpand={() => openInPanel('storymap', 'Story Map', 'storymap')}
          />
        )}
        <CardDetailPanel
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onOpenFile={(path) => { openFile(path); setSelectedCard(null); }}
        />
        {activeView === 'diary' && (
          <DiaryView entries={phase.entries} onOpenFile={openFile} onOpenMarkdownPreview={openMarkdownPreview} />
        )}
        {activeView === 'techdebt' && (
          <TechDebtView cards={phase.techDebtCards} onOpenFile={openFile} onOpenMarkdownPreview={openMarkdownPreview} />
        )}
        {activeView === 'sprints' && (
          <SprintsView records={phase.sprintRecords} onOpenFile={openFile} onOpenMarkdownPreview={openMarkdownPreview} />
        )}
        {activeView === 'inbox' && (
          <InboxView cards={visibleCards} onOpenFile={openFile} onOpenMarkdownPreview={openMarkdownPreview} />
        )}
        {activeView === 'agents' && (
          <AgentsView
            resources={phase.agentResources}
            onOpenFile={openFile}
            onRunSdlcStep={runSdlcStep}
          />
        )}
        {activeView === 'thermostat' && (
          <div className="mandala-view-container" style={{ overflowY: 'auto', height: '100%' }}>
            <ThermostatSettingsPage onExpand={() => openInPanel('thermostat', 'Fabric Thermostat', 'thermostat')} />
          </div>
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
            onRemapWorkspace={() => vscode.postMessage({ command: 'remapWorkspace' })}
            onSaveSecret={(key, value) => vscode.postMessage({ command: 'saveSecret', key, value })}
            onSave={(nextSettings) => {
              dispatch({ type: 'LOAD_SETTINGS', settings: nextSettings });
              vscode.postMessage({ command: 'saveSettings', settings: nextSettings });
            }}
          />
        )}
        {statusLabel && (
          <div className="mandala-status-bar">
            <span className="mandala-status-ok">●</span>
            <span>{statusLabel}</span>
          </div>
        )}
      </main>
    </div>
  );
}
