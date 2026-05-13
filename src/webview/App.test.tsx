import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FolderCandidates, HostMessage } from '../shared/types';

const mockPostMessage = jest.fn();

jest.mock('./vscode', () => ({
  vscode: {
    postMessage: (...args: unknown[]) => mockPostMessage(...args),
    getState: jest.fn(),
    setState: jest.fn(),
  },
}));

// App must be imported AFTER jest.mock so it picks up the mock
import App from './App';

const BLANK_CANDIDATES: FolderCandidates = {
  inbox: '.mandala/inbox',
  diary: '.mandala/diary',
  sprints: '.mandala/sprints',
  techDebt: '.mandala/tech-debt',
  agents: '.mandala/agents',
};

function fireHostMessage(msg: HostMessage) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: msg }));
  });
}

function fireInit(initialized: boolean, hasMigratableData = false) {
  fireHostMessage({
    command: 'initState',
    initialized,
    hasMigratableData,
    folderCandidates: BLANK_CANDIDATES,
  });
}

describe('App', () => {
  beforeEach(() => mockPostMessage.mockClear());

  it('sends ready message on mount', () => {
    render(<App />);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'ready' });
  });

  it('renders the folder-mapping setup screen when not initialized', () => {
    render(<App />);
    fireInit(false);
    expect(screen.getByText(/map your folders/i)).toBeInTheDocument();
  });

  it('shows apply button on setup screen', () => {
    render(<App />);
    fireInit(false);
    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
  });

  it('renders sidebar navigation when initialized', () => {
    render(<App />);
    fireInit(true);
    fireHostMessage({ command: 'loadStoryMap', cards: [] });
    fireHostMessage({ command: 'loadDiary', entries: [] });
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('switches to diary view when diary nav item is clicked', async () => {
    render(<App />);
    fireInit(true);
    fireHostMessage({ command: 'loadStoryMap', cards: [] });
    fireHostMessage({ command: 'loadDiary', entries: [] });
    await userEvent.click(screen.getByTitle(/diary/i));
    expect(screen.getByTestId('diary-view')).toBeInTheDocument();
  });

  it('shows story map view by default when initialized', () => {
    render(<App />);
    fireInit(true);
    fireHostMessage({ command: 'loadStoryMap', cards: [] });
    fireHostMessage({ command: 'loadDiary', entries: [] });
    expect(screen.getByTestId('story-map-view')).toBeInTheDocument();
  });

  it('shows a starter-examples badge when example state is active', () => {
    render(<App />);
    fireInit(true);
    fireHostMessage({ command: 'loadStoryMap', cards: [] });
    fireHostMessage({ command: 'loadDiary', entries: [] });
    fireHostMessage({ command: 'loadExampleState', hasGettingStartedExamples: true });
    expect(screen.getByText(/starter examples active/i)).toBeInTheDocument();
  });
});
