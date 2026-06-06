import { basename } from 'node:path';
import {
  DEFAULT_ACK_MESSAGE,
  defaultInitOptions,
  type InitOptions,
  type InitRepo,
  type IssueTracker,
} from './init-types.js';

export type WizardSectionId =
  | 'setup'
  | 'agent'
  | 'repo'
  | 'server'
  | 'integration'
  | 'advanced';

export const WIZARD_SECTIONS: Array<{ id: WizardSectionId; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'agent', label: 'Agent runtime' },
  { id: 'repo', label: 'Repository' },
  { id: 'server', label: 'Server' },
  { id: 'integration', label: 'Integration' },
  { id: 'advanced', label: 'Advanced' },
];

export type WizardState = {
  installRoot: string;
  agent: string;
  defaultModel: string;
  repos: InitRepo[];
  port: number;
  issueTracker: IssueTracker;
  jiraMockMode: boolean;
  jiraBaseUrl?: string;
  linearMockMode: boolean;
  acknowledgmentMessage: string;
  advancedConfigured: boolean;
  advancedVisited: boolean;
  failOnMissingRepos: boolean;
  prPipelineEnabled: boolean;
  prDryRun: boolean;
  prettyLogs: boolean;
};

export type ReviewAction =
  | 'write'
  | 'edit-setup'
  | 'edit-agent'
  | 'edit-repo'
  | 'edit-server'
  | 'edit-integration'
  | 'edit-advanced'
  | 'cancel';

export function createWizardState(cwd: string): WizardState {
  const defaults = defaultInitOptions(cwd);
  return {
    installRoot: cwd,
    agent: defaults.agent,
    defaultModel: '',
    repos: defaults.repos.map((r) => ({ ...r })),
    port: defaults.port,
    issueTracker: defaults.issueTracker,
    jiraMockMode: defaults.jiraMockMode,
    linearMockMode: defaults.linearMockMode,
    acknowledgmentMessage: defaults.acknowledgmentMessage ?? DEFAULT_ACK_MESSAGE,
    advancedConfigured: false,
    advancedVisited: false,
    failOnMissingRepos: defaults.failOnMissingRepos,
    prPipelineEnabled: defaults.prPipelineEnabled,
    prDryRun: defaults.prDryRun,
    prettyLogs: defaults.prettyLogs,
  };
}

export function toInitOptions(state: WizardState): InitOptions {
  return {
    port: state.port,
    agent: state.agent,
    defaultModel: state.defaultModel || undefined,
    repos: state.repos.map((r) => ({ ...r })),
    issueTracker: state.issueTracker,
    jiraMockMode: state.issueTracker === 'mock-only' ? true : state.jiraMockMode,
    jiraBaseUrl: state.jiraBaseUrl,
    linearMockMode: state.linearMockMode,
    acknowledgmentMessage: state.acknowledgmentMessage,
    failOnMissingRepos: state.failOnMissingRepos,
    prPipelineEnabled: state.prPipelineEnabled,
    prDryRun: state.prDryRun,
    prettyLogs: state.prettyLogs,
    advancedConfigured: state.advancedConfigured,
    force: false,
  };
}

export function primaryRepoLabel(state: WizardState): string {
  return state.repos[0]?.name ?? (basename(state.installRoot) || 'symfony');
}
