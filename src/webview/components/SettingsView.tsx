import React, { useState } from 'react';
import type { IntegrationSettings, CustomIntegration } from '../../shared/types';
import { KNOWN_INTEGRATIONS } from '../../shared/types';

interface Props {
  settings: IntegrationSettings;
  onSave: (settings: IntegrationSettings) => void;
}

interface AddForm {
  label: string;
  source: string;
  target: string;
}

const EMPTY_FORM: AddForm = { label: '', source: '', target: '' };

export function SettingsView({ settings, onSave }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);

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
        <h2>AI Tool Integrations</h2>
        <p className="settings-hint">
          Enabled tools will have their context files symlinked from{' '}
          <code>.meridian/agents/</code>.
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
            <input
              placeholder="Label"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <input
              placeholder="Source (relative to .meridian/agents/)"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            />
            <input
              placeholder="Target (relative to workspace root)"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
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
            Add
          </button>
        )}
      </section>
    </div>
  );
}
