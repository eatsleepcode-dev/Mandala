import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HostMessage } from '../shared/types';

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

function fireHostMessage(msg: HostMessage) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: msg }));
  });
}

describe('App', () => {
  beforeEach(() => mockPostMessage.mockClear());

  it('sends ready message on mount', () => {
    render(<App />);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'ready' });
  });

  it('renders the setup screen when initState.initialized is false', () => {
    render(<App />);
    fireHostMessage({ command: 'initState', initialized: false, hasMigratableData: false });
    expect(screen.getByText(/no \.mandala\/ workspace found/i)).toBeInTheDocument();
  });

  it('offers empty and example workspace initialization from setup', () => {
    render(<App />);
    fireHostMessage({ command: 'initState', initialized: false, hasMigratableData: false });
    expect(screen.getByRole('button', { name: /initialize empty workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /initialize with examples/i })).toBeInTheDocument();
  });

  it('shows migrate option when hasMigratableData is true', () => {
    render(<App />);
    fireHostMessage({ command: 'initState', initialized: false, hasMigratableData: true });
    expect(screen.getByText(/migrate/i)).toBeInTheDocument();
  });

  it('renders sidebar navigation when initialized', () => {
    render(<App />);
    fireHostMessage({ command: 'initState', initialized: true, hasMigratableData: false });
    fireHostMessage({ command: 'loadStoryMap', cards: [] });
    fireHostMessage({ command: 'loadDiary', entries: [] });
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('switches to diary view when diary nav item is clicked', async () => {
    render(<App />);
    fireHostMessage({ command: 'initState', initialized: true, hasMigratableData: false });
    fireHostMessage({ command: 'loadStoryMap', cards: [] });
    fireHostMessage({ command: 'loadDiary', entries: [] });
    await userEvent.click(screen.getByTitle(/diary/i));
    expect(screen.getByTestId('diary-view')).toBeInTheDocument();
  });

  it('shows story map view by default when initialized', () => {
    render(<App />);
    fireHostMessage({ command: 'initState', initialized: true, hasMigratableData: false });
    fireHostMessage({ command: 'loadStoryMap', cards: [] });
    fireHostMessage({ command: 'loadDiary', entries: [] });
    expect(screen.getByTestId('story-map-view')).toBeInTheDocument();
  });

  it('shows a starter-examples badge when example state is active', () => {
    render(<App />);
    fireHostMessage({ command: 'initState', initialized: true, hasMigratableData: false });
    fireHostMessage({ command: 'loadStoryMap', cards: [] });
    fireHostMessage({ command: 'loadDiary', entries: [] });
    fireHostMessage({ command: 'loadExampleState', hasGettingStartedExamples: true });
    expect(screen.getByText(/starter examples active/i)).toBeInTheDocument();
  });
});
