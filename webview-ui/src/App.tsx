import { useState } from 'react';
import { vscode } from './vscode';
import './App.css';

function App() {
  const [activeView, setActiveView] = useState<'tactical' | 'strategic'>('strategic');

  const triggerTestMessage = () => {
    vscode.postMessage({
      command: 'hello',
      text: 'Hello from Meridian!',
    });
  };

  return (
    <div className="meridian-dashboard">
      <header className="dashboard-header">
        <h1>Meridian</h1>
        <div className="view-toggles">
          <button
            className={activeView === 'tactical' ? 'active' : ''}
            onClick={() => setActiveView('tactical')}
          >
            Tactical (Calendar)
          </button>
          <button
            className={activeView === 'strategic' ? 'active' : ''}
            onClick={() => setActiveView('strategic')}
          >
            Strategic (Story Map)
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        {activeView === 'strategic' ? (
          <div className="view-strategic">
            <h2>Jeff Patton Story Map</h2>
            <p>DuckDB JSON indexing will populate this CSS Grid.</p>
            <button onClick={triggerTestMessage}>Test VS Code Bridge</button>
          </div>
        ) : (
          <div className="view-tactical">
            <h2>Daily Execution Ledger</h2>
            <p>__todo/ and diary/ data will render here.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
