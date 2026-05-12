import React, { useState, useEffect } from 'react';
import { vscode } from '../vscode';
import type { IntegrationSettings, CustomIntegration, HostMessage, ThemeOverride } from '../../shared/types';
import { KNOWN_INTEGRATIONS } from '../../shared/types';

interface Props {
  settings: IntegrationSettings;
  themeOverride?: ThemeOverride;
  hasGettingStartedExamples?: boolean;
  inboxPath?: string;
  diaryPath?: string;
  onSave: (settings: IntegrationSettings) => void;
  onThemeOverrideChange?: (override: ThemeOverride) => void;
  onWorkspacePathChange?: (path: 'inbox' | 'diary', value: string) => void;
  onSeedExamples?: () => void;
  onRemoveExamples?: () => void;
}

interface AddForm {
  label: string;
  source: string;
  target: string;
}

const EMPTY_FORM: AddForm = { label: '', source: '', target: '' };

export function SettingsView({
  settings,
  themeOverride = 'auto',
  hasGettingStartedExamples = false,
  inboxPath = '.mandala/inbox',
  diaryPath = '.mandala/diary',
  onSave,
  onThemeOverrideChange = () => undefined,
  onWorkspacePathChange = () => undefined,
  onSeedExamples = () => undefined,
  onRemoveExamples = () => undefined,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as HostMessage;
      if (msg.command === 'pathSelected') {
        setForm((f) => ({ ...f, [msg.field]: msg.path }));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  function requestBrowse(field: 'source' | 'target') {
    vscode.postMessage({ command: 'browsePath', field });
  }

  function toggleKnown(id: string) {
    onSave({
      ...settings,
      known: {
        ...settings.known,
        [id]: !settings.known[id as keyof typeof settings.known],
      },
    });
  }

  function removeCustom(id: string) {
    onSave({
      ...settings,
      custom: settings.custom.filter((c) => c.id !== id),
    });
  }

  function confirmAdd() {
    const entry: CustomIntegration = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label: form.label,
      source: form.source,
      target: form.target,
    };
    onSave({ ...settings, custom: [...settings.custom, entry] });
    setAdding(false);
    setForm(EMPTY_FORM);
  }

  function cancelAdd() {
    setAdding(false);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="settings-view">
      <section className="settings-section">
        <h2>Theme</h2>
        <p className="settings-hint">Choose how the Mandala dashboard should be themed.</p>
        <label className="settings-theme-row">
          <span>Dashboard Theme</span>
          <select
            value={themeOverride}
            onChange={(e) => onThemeOverrideChange(e.target.value as ThemeOverride)}
          >
            <option value="auto">VS Code Default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="neuromancer">Neuromancer</option>
          </select>
        </label>
      </section>

      <section className="settings-section">
        <h2>Workspace Paths</h2>
        <p className="settings-hint">Configure where Mandala stores diary entries and task cards within the workspace.</p>
        <label className="settings-theme-row">
          <span>Inbox Path</span>
          <input
            type="text"
            value={inboxPath}
            onChange={(e) => onWorkspacePathChange('inbox', e.target.value)}
            placeholder=".mandala/inbox"
            title="Relative path to inbox folder (relative to workspace root)"
          />
        </label>
        <label className="settings-theme-row">
          <span>Diary Path</span>
          <input
            type="text"
            value={diaryPath}
            onChange={(e) => onWorkspacePathChange('diary', e.target.value)}
            placeholder=".mandala/diary"
            title="Relative path to diary folder (relative to workspace root)"
          />
        </label>
      </section>

      <section className="settings-section">
        <h2>Getting Started</h2>
        <p className="settings-hint">
          Add a small sample diary, sprint, story-map, and tech-debt set to explore the dashboard.
          Mandala tracks these example files and can remove them later without touching your own notes.
        </p>
        <div className="settings-example-actions">
          {hasGettingStartedExamples ? (
            <button className="settings-example-btn danger" onClick={onRemoveExamples}>
              Remove Getting Started Examples
            </button>
          ) : (
            <button className="settings-example-btn" onClick={onSeedExamples}>
              Add Getting Started Examples
            </button>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2>AI Tool Integrations</h2>
        <p className="settings-hint">
          Enabled tools will have their context files symlinked from{' '}
          <code>.mandala/agents/</code>.
        </p>
        <ul className="settings-known-list">
          {KNOWN_INTEGRATIONS.map((integ) => {
            const checked = !!settings.known[integ.id as keyof typeof settings.known];
            return (
              <li key={integ.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleKnown(integ.id)}
                  />
                  {' '}
                  {integ.label}
                </label>
                <span className="settings-target-hint">{integ.target}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="settings-section">
        <h2>Custom Integrations</h2>
        {settings.custom.length === 0 && !adding && (
          <p className="settings-hint">No custom integrations configured.</p>
        )}
        {settings.custom.length > 0 && (
          <table className="settings-custom-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Source</th>
                <th>Target</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {settings.custom.map((c) => (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td>{c.source}</td>
                  <td>{c.target}</td>
                  <td>
                    <button
                      aria-label={`Remove ${c.label}`}
                      onClick={() => removeCustom(c.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {adding ? (
          <form aria-label="New integration" className="settings-add-form">
            <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
              <input
                placeholder="Label"
                title="A descriptive name for your custom integration"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                style={{ flex: 1 }}
                placeholder="Source (relative to .mandala/agents/)"
                title="The file path inside the .mandala/agents folder"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
              <button type="button" onClick={() => requestBrowse('source')} title="Browse for source file">Browse...</button>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                style={{ flex: 1 }}
                placeholder="Target (relative to workspace root)"
                title="The destination file path where it will be linked/copied"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              />
              <button type="button" onClick={() => requestBrowse('target')} title="Browse for target location">Browse...</button>
            </div>
            <p className="settings-hint">
              <strong>Source:</strong> Select the agent configuration or instructions file from your Mandala agents folder.<br/>
              <strong>Target:</strong> Select where the file should be linked or copied in your workspace.
            </p>
            <div className="settings-add-actions">
              <button type="button" onClick={confirmAdd} aria-label="Confirm">
                Confirm
              </button>
              <button type="button" onClick={cancelAdd} aria-label="Cancel">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="settings-add-btn" onClick={() => setAdding(true)}>
            Add Custom Integration
          </button>
        )}
      </section>
    </div>
  );
}
