import React from 'react';
import type { AgentResources } from '../../shared/types';

interface AgentsViewProps {
  resources: AgentResources;
  onOpenFile: (path: string) => void;
  onRunSdlcStep: (
    step: 'plan' | 'execute' | 'validate' | 'close',
    suggestedSlash: string,
    fallbackPath?: string
  ) => void;
}

function renderFileList(
  title: string,
  items: Array<{ name: string; path: string; relativePath: string }>,
  onOpenFile: (path: string) => void
) {
  return (
    <section className="agent-section">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="agent-empty">No items found.</p>
      ) : (
        <ul className="agent-list">
          {items.map((item) => (
            <li key={`${title}:${item.path}`}>
              <button
                className="agent-link"
                type="button"
                onClick={() => onOpenFile(item.path)}
                title={item.path}
              >
                {item.relativePath}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function findFirstByToken(
  items: Array<{ name: string; path: string; relativePath: string }>,
  token: string
) {
  const normalized = token.toLowerCase();
  return items.find((item) => {
    const haystack = `${item.name} ${item.relativePath}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function AgentsView({ resources, onOpenFile, onRunSdlcStep }: AgentsViewProps) {
  const primaryGuidePath = resources.guidePath;
  const guideInsights = resources.guideInsights;

  const sdlcSteps = [
    {
      id: 'plan' as const,
      phase: '1. Plan',
      objective: 'Create the sprint card and define acceptance criteria before coding.',
      command: '/build-sprint',
      file: findFirstByToken(resources.workflows, 'build-sprint'),
    },
    {
      id: 'execute' as const,
      phase: '2. Execute',
      objective: 'Run TDD tasks and iterate through sprint work items.',
      command: '/run-sprint',
      file: findFirstByToken(resources.workflows, 'run-sprint'),
    },
    {
      id: 'validate' as const,
      phase: '3. Validate',
      objective: 'Run quality gates and address findings before close.',
      command: '/quality-gates',
      file: findFirstByToken(resources.workflows, 'quality-gates'),
    },
    {
      id: 'close' as const,
      phase: '4. Close',
      objective: 'Finalize sprint outcomes, debt handling, and handoff notes.',
      command: '/sprint-close',
      file: findFirstByToken(resources.workflows, 'sprint-close'),
    },
  ];

  return (
    <div className="agents-view" data-testid="agents-view">
      <header className="agents-header">
        <h2>Agent Assets</h2>
        <p>SDLC playbook, workflows, registry, and guides sourced from this workspace.</p>
      </header>

      <section className="agent-section agent-summary">
        <h3>Workspace Summary</h3>
        <div className="agent-summary-grid">
          <div className="agent-stat"><span>Workflows</span><strong>{resources.workflows.length}</strong></div>
          <div className="agent-stat"><span>Skills</span><strong>{resources.skills.length}</strong></div>
          <div className="agent-stat"><span>Registry</span><strong>{resources.registry.length}</strong></div>
          <div className="agent-stat"><span>Guides</span><strong>{resources.guides.length}</strong></div>
        </div>
        {guideInsights && (
          <div className="agent-guide-insights">
            <span>{guideInsights.title ?? 'Guide detected'}</span>
            {guideInsights.updated && <span>Updated: {guideInsights.updated}</span>}
            {guideInsights.workflowCount !== undefined && <span>{guideInsights.workflowCount} workflows</span>}
            {guideInsights.slashCommandCount !== undefined && <span>{guideInsights.slashCommandCount} slash commands</span>}
            {guideInsights.autoTriggerCount !== undefined && <span>{guideInsights.autoTriggerCount} auto triggers</span>}
            {guideInsights.qualityGateCount !== undefined && <span>{guideInsights.qualityGateCount} quality gates</span>}
          </div>
        )}
      </section>

      <section className="agent-section agent-runbook">
        <h3>SDLC Quick Run</h3>
        <ol className="agent-runbook-list">
          {sdlcSteps.map((step) => (
            <li key={step.phase}>
              <div className="agent-runbook-head">
                <strong>{step.phase}</strong>
                <code>{step.command}</code>
              </div>
              <p>{step.objective}</p>
              <div className="agent-runbook-actions">
                <button
                  className="agent-run-btn"
                  type="button"
                  onClick={() => onRunSdlcStep(step.id, step.command, step.file?.path)}
                >
                  Run SDLC Step
                </button>
              {step.file ? (
                <button
                  className="agent-link"
                  type="button"
                  onClick={() => onOpenFile(step.file!.path)}
                  title={step.file.path}
                >
                  Open workflow: {step.file.relativePath}
                </button>
              ) : (
                <p className="agent-empty">Workflow file not found for this step.</p>
              )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="agent-grid">
        <section className="agent-section">
          <h3>Guides</h3>
          {primaryGuidePath ? (
            <button className="agent-guide-btn" type="button" onClick={() => onOpenFile(primaryGuidePath)}>
              Open agent-guide.html
            </button>
          ) : (
            <p className="agent-empty">agent-guide.html not found.</p>
          )}
          {!primaryGuidePath && (
            <p className="agent-empty">Expected path: __guides/agent-guide.html</p>
          )}
          {resources.guides.length > 0 && (
            <ul className="agent-list">
              {resources.guides.map((item) => (
                <li key={`guides:${item.path}`}>
                  <button
                    className="agent-link"
                    type="button"
                    onClick={() => onOpenFile(item.path)}
                    title={item.path}
                  >
                    {item.relativePath}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        {renderFileList('Workflows', resources.workflows, onOpenFile)}
        {renderFileList('Skills', resources.skills, onOpenFile)}
        {renderFileList('Registry', resources.registry, onOpenFile)}
      </div>
    </div>
  );
}
