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
  sprintsPath?: string;
  techDebtPath?: string;
  agentsPath?: string;
  onSave: (settings: IntegrationSettings) => void;
  onThemeOverrideChange?: (override: ThemeOverride) => void;
  onWorkspacePathChange?: (path: 'inbox' | 'diary' | 'sprints' | 'tech-debt' | 'agents', value: string) => void;
  onSeedExamples?: () => void;
  onRemoveExamples?: () => void;
  onReinitializeWorkspace?: () => void;
  onRemapWorkspace?: () => void;
  onSaveSecret?: (key: string, value: string) => void;
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
  sprintsPath = '.mandala/sprints',
  techDebtPath = '.mandala/tech-debt',
  agentsPath = '.mandala/agents',
  onSave,
  onThemeOverrideChange = () => undefined,
  onWorkspacePathChange = () => undefined,
  onSeedExamples = () => undefined,
  onRemoveExamples = () => undefined,
  onReinitializeWorkspace = () => undefined,
  onRemapWorkspace = () => undefined,
  onSaveSecret = () => undefined,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [secrets, setSecrets] = useState<Record<string, string>>({});

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

  function handleSaveSecret(key: string) {
    const val = secrets[key];
    if (val) {
      onSaveSecret(key, val);
      setSecrets((s) => ({ ...s, [key]: '' }));
    }
  }

  return (
    <div className="settings-view">
      <section className="settings-section">
        <h2>Workspace Paths</h2>
        <p className="settings-hint">Configure where Mandala stores workspace data. All paths are relative to the workspace root.</p>
        <label className="settings-theme-row">
          <span>Inbox Path</span>
          <input
            type="text"
            value={inboxPath}
            onChange={(e) => onWorkspacePathChange('inbox', e.target.value)}
            placeholder=".mandala/inbox"
            title="Relative path to inbox folder (where task cards are stored)"
          />
        </label>
        <label className="settings-theme-row">
          <span>Diary Path</span>
          <input
            type="text"
            value={diaryPath}
            onChange={(e) => onWorkspacePathChange('diary', e.target.value)}
            placeholder=".mandala/diary"
            title="Relative path to diary folder (where diary entries are stored)"
          />
        </label>
        <label className="settings-theme-row">
          <span>Sprints Path</span>
          <input
            type="text"
            value={sprintsPath}
            onChange={(e) => onWorkspacePathChange('sprints', e.target.value)}
            placeholder=".mandala/sprints"
            title="Relative path to sprints folder (where sprint records are stored)"
          />
        </label>
        <label className="settings-theme-row">
          <span>Tech Debt Path</span>
          <input
            type="text"
            value={techDebtPath}
            onChange={(e) => onWorkspacePathChange('tech-debt', e.target.value)}
            placeholder=".mandala/tech-debt"
            title="Relative path to tech-debt folder (where tech debt cards are stored)"
          />
        </label>
        <label className="settings-theme-row">
          <span>Agents Path</span>
          <input
            type="text"
            value={agentsPath}
            onChange={(e) => onWorkspacePathChange('agents', e.target.value)}
            placeholder=".mandala/agents"
            title="Relative path to agents folder (where agent configs, skills, and workflows are stored)"
          />
        </label>
      </section>

      <section className="settings-section">
        <h2>Workspace Management</h2>
        <p className="settings-hint">
          Map folder paths or reinitialize the workspace structure.
        </p>
        <div className="settings-example-actions">
          <button className="settings-example-btn" onClick={onRemapWorkspace}>
            Remap Folder Paths
          </button>
          <button className="settings-example-btn" onClick={onReinitializeWorkspace}>
            Reinitialize Workspace
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Authentication &amp; Secrets</h2>
        <p className="settings-hint">
          API keys and tokens are stored securely in your OS keychain via VS Code SecretStorage and are never written to disk or settings files.
        </p>

        <label className="settings-theme-row">
          <span>Azure DevOps Org URL</span>
          <input
            type="text"
            value={settings.ado?.orgUrl || ''}
            onChange={(e) => onSave({ ...settings, ado: { ...settings.ado, orgUrl: e.target.value } })}
            placeholder="Azure DevOps Organization URL (e.g. https://dev.azure.com/myorg)"
            title="Azure DevOps Organization URL"
          />
        </label>
        <label className="settings-theme-row">
          <span>Azure DevOps Project</span>
          <input
            type="text"
            value={settings.ado?.project || ''}
            onChange={(e) => onSave({ ...settings, ado: { ...settings.ado, project: e.target.value } })}
            placeholder="Azure DevOps Project"
            title="Azure DevOps Project"
          />
        </label>
        <label className="settings-theme-row">
          <span>Work Item Type</span>
          <input
            type="text"
            value={settings.ado?.workItemType || 'Task'}
            onChange={(e) => onSave({ ...settings, ado: { ...settings.ado, workItemType: e.target.value } })}
            placeholder="Work Item Type (e.g. Task)"
            title="Work Item Type"
          />
        </label>
        
        <label className="settings-theme-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
          <span>Azure DevOps PAT</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              value={secrets['mandala.ado.pat'] || ''}
              onChange={(e) => setSecrets({ ...secrets, 'mandala.ado.pat': e.target.value })}
              placeholder="Azure DevOps PAT (●●●●● if saved)"
              title="Personal Access Token for Azure DevOps"
              style={{ flex: 1 }}
            />
            <button className="mandala-btn" onClick={() => handleSaveSecret('mandala.ado.pat')}>Save Azure DevOps PAT</button>
          </div>
        </label>

        <label className="settings-theme-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Claude API Key</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              value={secrets['mandala.claude.key'] || ''}
              onChange={(e) => setSecrets({ ...secrets, 'mandala.claude.key': e.target.value })}
              placeholder="Claude API Key (●●●●● if saved)"
              title="API Key for Anthropic Claude"
              style={{ flex: 1 }}
            />
            <button className="mandala-btn" onClick={() => handleSaveSecret('mandala.claude.key')}>Save Claude API Key</button>
          </div>
        </label>

        <label className="settings-theme-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Azure Foundry Key</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              value={secrets['mandala.azure.key'] || ''}
              onChange={(e) => setSecrets({ ...secrets, 'mandala.azure.key': e.target.value })}
              placeholder="Azure Foundry Key (●●●●● if saved)"
              title="API Key for Azure AI Foundry"
              style={{ flex: 1 }}
            />
            <button className="mandala-btn" onClick={() => handleSaveSecret('mandala.azure.key')}>Save Azure Foundry Key</button>
          </div>
        </label>
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
    </div>
  );
}
