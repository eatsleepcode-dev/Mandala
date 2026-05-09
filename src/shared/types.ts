// ─── Data types (duplicated from lib/workspace to avoid cross-boundary imports in the webview build)

export type TaskStatus = 'planned' | 'in-progress' | 'complete' | 'blocked';
export type EntryType = 'feat' | 'fix' | 'chore' | 'docs' | 'test' | 'tidy';

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

// ─── Host → Webview messages ─────────────────────────────────────────────────

export interface LoadStoryMapMessage {
  command: 'loadStoryMap';
  cards: TaskCard[];
}

export interface LoadDiaryMessage {
  command: 'loadDiary';
  entries: DiaryEntry[];
}

export interface InitStateMessage {
  command: 'initState';
  initialized: boolean;
  hasMigratableData: boolean;
}

export interface ErrorMessage {
  command: 'error';
  text: string;
}

export type HostMessage =
  | LoadStoryMapMessage
  | LoadDiaryMessage
  | InitStateMessage
  | ErrorMessage;

// ─── Webview → Host messages ─────────────────────────────────────────────────

export interface ReadyMessage { command: 'ready'; }
export interface RefreshMessage { command: 'refresh'; }
export interface OpenFileMessage { command: 'openFile'; path: string; }
export interface InitWorkspaceMessage { command: 'initWorkspace'; }
export interface MigrateWorkspaceMessage { command: 'migrateWorkspace'; }

export type WebviewMessage =
  | ReadyMessage
  | RefreshMessage
  | OpenFileMessage
  | InitWorkspaceMessage
  | MigrateWorkspaceMessage;
