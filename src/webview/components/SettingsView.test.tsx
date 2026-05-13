import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SettingsView } from './SettingsView';
import type { IntegrationSettings } from '../../shared/types';

const defaultSettings = (): IntegrationSettings => ({
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
});

describe('SettingsView', () => {
  it('renders a checkbox for each known integration', () => {
    render(<SettingsView settings={defaultSettings()} onSave={jest.fn()} />);
    expect(screen.getByLabelText(/claude code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/copilot/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cursor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slash commands/i)).toBeInTheDocument();
  });

  it('checks boxes that are enabled in settings', () => {
    render(<SettingsView settings={defaultSettings()} onSave={jest.fn()} />);
    expect(screen.getByLabelText(/claude code/i)).toBeChecked();
    expect(screen.getByLabelText(/copilot/i)).not.toBeChecked();
    expect(screen.getByLabelText(/slash commands/i)).toBeChecked();
  });

  it('calls onSave with toggled known flag when checkbox changes', () => {
    const onSave = jest.fn();
    render(<SettingsView settings={defaultSettings()} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText(/copilot/i));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        known: expect.objectContaining({ copilot: true }),
      })
    );
  });

  it('renders custom integrations table', () => {
    const settings: IntegrationSettings = {
      ...defaultSettings(),
      custom: [
        { id: 'mytool', label: 'My Tool', source: 'context/CUSTOM.md', target: '.mytool/rules.md' },
      ],
    };
    render(<SettingsView settings={settings} onSave={jest.fn()} />);
    expect(screen.getByText('My Tool')).toBeInTheDocument();
    expect(screen.getByText('context/CUSTOM.md')).toBeInTheDocument();
    expect(screen.getByText('.mytool/rules.md')).toBeInTheDocument();
  });

  it('shows an Add row button', () => {
    render(<SettingsView settings={defaultSettings()} onSave={jest.fn()} />);
    expect(screen.getByRole('button', { name: /add custom integration/i })).toBeInTheDocument();
  });

  it('calls onSave with new custom entry after filling in add form', () => {
    const onSave = jest.fn();
    render(<SettingsView settings={defaultSettings()} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /add custom integration/i }));

    const form = screen.getByRole('form', { name: /new integration/i });
    fireEvent.change(within(form).getByPlaceholderText(/label/i), {
      target: { value: 'My Agent' },
    });
    fireEvent.change(within(form).getByPlaceholderText(/source/i), {
      target: { value: 'context/MY.md' },
    });
    fireEvent.change(within(form).getByPlaceholderText(/target/i), {
      target: { value: '.myagent/rules.md' },
    });
    fireEvent.click(within(form).getByRole('button', { name: /confirm/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        custom: expect.arrayContaining([
          expect.objectContaining({
            label: 'My Agent',
            source: 'context/MY.md',
            target: '.myagent/rules.md',
          }),
        ]),
      })
    );
  });

  it('calls onSave with custom entry removed when Remove is clicked', () => {
    const settings: IntegrationSettings = {
      ...defaultSettings(),
      custom: [
        { id: 'mytool', label: 'My Tool', source: 'context/CUSTOM.md', target: '.mytool/rules.md' },
      ],
    };
    const onSave = jest.fn();
    render(<SettingsView settings={settings} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /remove my tool/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ custom: [] })
    );
  });

  it('does not call onSave when add form is cancelled', () => {
    const onSave = jest.fn();
    render(<SettingsView settings={defaultSettings()} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /add custom integration/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('offers adding getting started examples when they are not present', () => {
    const onSeedExamples = jest.fn();
    render(
      <SettingsView
        settings={defaultSettings()}
        onSave={jest.fn()}
        hasGettingStartedExamples={false}
        onSeedExamples={onSeedExamples}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add getting started examples/i }));
    expect(onSeedExamples).toHaveBeenCalled();
  });

  it('offers removing getting started examples when they are present', () => {
    const onRemoveExamples = jest.fn();
    render(
      <SettingsView
        settings={defaultSettings()}
        onSave={jest.fn()}
        hasGettingStartedExamples
        onRemoveExamples={onRemoveExamples}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /remove getting started examples/i }));
    expect(onRemoveExamples).toHaveBeenCalled();
  });

  it('renders Authentication & Secrets section with credential inputs and ADO config inputs', () => {
    render(<SettingsView settings={defaultSettings()} onSave={jest.fn()} />);
    expect(screen.getByRole('heading', { name: /Authentication & Secrets/i })).toBeInTheDocument();
    
    // Check for ADO config inputs
    expect(screen.getByPlaceholderText(/Azure DevOps Organization URL/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Azure DevOps Project/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Work Item Type/i)).toBeInTheDocument();

    // Check for PAT/Key inputs
    expect(screen.getByPlaceholderText(/Azure DevOps PAT/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Claude API Key/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Azure Foundry Key/i)).toBeInTheDocument();
  });

  it('calls onSaveSecret when a credential is saved', () => {
    const onSaveSecret = jest.fn();
    render(<SettingsView settings={defaultSettings()} onSave={jest.fn()} onSaveSecret={onSaveSecret} />);
    
    const input = screen.getByPlaceholderText(/Claude API Key/i);
    fireEvent.change(input, { target: { value: 'sk-ant-123' } });
    
    const saveBtn = screen.getByRole('button', { name: /Save Claude API Key/i });
    fireEvent.click(saveBtn);
    
    expect(onSaveSecret).toHaveBeenCalledWith('mandala.claude.key', 'sk-ant-123');
    // The field should show placeholders after save
    expect(input).toHaveValue('');
  });
});
