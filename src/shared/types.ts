// ─── Data types (duplicated from lib/workspace to avoid cross-boundary imports in the webview build)

export type TaskStatus = 'planned' | 'in-progress' | 'complete' | 'blocked';
export type EntryType = 'feat' | 'fix' | 'chore' | 'docs' | 'test' | 'tidy';
export type TechDebtSeverity = 'high' | 'medium' | 'low';

export interface TaskCard {
  id: string;
  title: string;
  sprint: number;
  status: TaskStatus;
  type: EntryType;
  tags: string[];
  points?: number;
  branch?: string;
  activity?: string;
  path: string;
  body: string;
}

export interface DiaryEntry {
  date: string;
  type: EntryType;
  title: string;
  branch?: string;
  files?: string[];
  techDebt: boolean;
  adr: boolean;
  path: string;
  body: string;
}

export interface TechDebtCard {
  id: string;
  title: string;
  severity: TechDebtSeverity;
  tags: string[];
  added: string;
  status: 'open' | 'resolved';
  path: string;
  body: string;
}

export interface SprintRecord {
  sprint: number;
  goal: string;
  status: TaskStatus;
  startDate?: string;
  endDate?: string;
  path: string;
  body: string;
}

export interface AgentFileRef {
  name: string;
  path: string;
  relativePath: string;
}

export interface GuideInsights {
  title?: string;
  updated?: string;
  workflowCount?: number;
  slashCommandCount?: number;
  autoTriggerCount?: number;
  qualityGateCount?: number;
}

export interface AgentResources {
  workflows: AgentFileRef[];
  skills: AgentFileRef[];
  tasks: AgentFileRef[];
  guides: AgentFileRef[];
  registry: AgentFileRef[];
  guidePath?: string;
  guideInsights?: GuideInsights;
}

export type ThemeOverride = 'auto' | 'light' | 'dark' | 'neuromancer';

// ─── Host → Webview messages ─────────────────────────────────────────────────

export interface LoadStoryMapMessage {
  command: 'loadStoryMap';
  cards: TaskCard[];
}

export interface LoadDiaryMessage {
  command: 'loadDiary';
  entries: DiaryEntry[];
}

export interface LoadSprintsMessage {
  command: 'loadSprints';
  records: SprintRecord[];
}

export interface LoadTechDebtMessage {
  command: 'loadTechDebt';
  cards: TechDebtCard[];
}

export interface LoadAgentResourcesMessage {
  command: 'loadAgentResources';
  resources: AgentResources;
}

export interface LoadThemeMessage {
  command: 'loadTheme';
  override: ThemeOverride;
}

export interface LoadProgressMessage {
  command: 'loadProgress';
  step: string;
  elapsedMs?: number;
}

export interface InitStateMessage {
  command: 'initState';
  initialized: boolean;
  hasMigratableData: boolean;
}

export interface LoadExampleStateMessage {
  command: 'loadExampleState';
  hasGettingStartedExamples: boolean;
}

export interface ErrorMessage {
  command: 'error';
  text: string;
}

// ─── Integration / settings types ────────────────────────────────────────────

export interface KnownIntegration {
  id: string;
  label: string;
  source: string;
  target: string;
}

export const KNOWN_INTEGRATIONS: KnownIntegration[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    source: 'context/CLAUDE.md',
    target: 'CLAUDE.md',
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    source: 'context/COPILOT.md',
    target: '.github/copilot-instructions.md',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    source: 'context/CURSORRULES.md',
    target: '.cursorrules',
  },
  {
    id: 'cline',
    label: 'Cline',
    source: 'context/CLINERULES.md',
    target: '.clinerules',
  },
  {
    id: 'claudeCommands',
    label: 'Slash Commands',
    source: 'skills',
    target: '.claude/commands',
  },
];

export interface CustomIntegration {
  id: string;
  label: string;
  source: string;
  target: string;
}

export interface KnownIntegrationFlags {
  claude: boolean;
  copilot: boolean;
  cursor: boolean;
  cline: boolean;
  claudeCommands: boolean;
}

export interface IntegrationSettings {
  known: KnownIntegrationFlags;
  custom: CustomIntegration[];
}

// ─── Host → Webview: settings ────────────────────────────────────────────────

export interface LoadSettingsMessage {
  command: 'loadSettings';
  settings: IntegrationSettings;
}

export interface PathSelectedMessage {
  command: 'pathSelected';
  field: 'source' | 'target';
  path: string;
}

// ─── Webview → Host messages ─────────────────────────────────────────────────

export interface ReadyMessage { command: 'ready'; }
export interface RefreshMessage { command: 'refresh'; }
export interface OpenFileMessage { command: 'openFile'; path: string; }
export interface InitWorkspaceMessage {
  command: 'initWorkspace';
  withExamples?: boolean;
}
export interface MigrateWorkspaceMessage { command: 'migrateWorkspace'; }
export interface SeedExamplesMessage { command: 'seedExamples'; }
export interface RemoveExamplesMessage { command: 'removeExamples'; }
export interface SaveSettingsMessage {
  command: 'saveSettings';
  settings: IntegrationSettings;
}
export interface OpenSettingsMessage { command: 'openSettings'; }
export interface OpenGuideMessage { command: 'openGuide'; }
export interface SetThemeOverrideMessage {
  command: 'setThemeOverride';
  override: ThemeOverride;
}
export interface RunSdlcStepMessage {
  command: 'runSdlcStep';
  step: 'plan' | 'execute' | 'validate' | 'close';
  suggestedSlash: string;
  fallbackPath?: string;
}

export type HostMessage =
  | LoadStoryMapMessage
  | LoadDiaryMessage
  | LoadSprintsMessage
  | LoadTechDebtMessage
  | LoadAgentResourcesMessage
  | LoadThemeMessage
  | LoadProgressMessage
  | InitStateMessage
  | LoadExampleStateMessage
  | ErrorMessage
  | LoadSettingsMessage
  | PathSelectedMessage;

export interface BrowsePathMessage {
  command: 'browsePath';
  field: 'source' | 'target';
}

export type WebviewMessage =
  | ReadyMessage
  | RefreshMessage
  | OpenFileMessage
  | InitWorkspaceMessage
  | MigrateWorkspaceMessage
  | SeedExamplesMessage
  | RemoveExamplesMessage
  | SaveSettingsMessage
  | BrowsePathMessage
  | OpenSettingsMessage
  | OpenGuideMessage
  | SetThemeOverrideMessage
  | RunSdlcStepMessage;

