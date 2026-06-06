import { basename, isAbsolute, resolve } from 'node:path';

export type IssueTracker = 'jira' | 'linear' | 'mock-only';

export type InitRepo = {
  name: string;
  path: string;
  description?: string;
};

export type InitOptions = {
  port: number;
  agent: string;
  defaultModel?: string;
  repos: InitRepo[];
  issueTracker: IssueTracker;
  jiraMockMode: boolean;
  jiraBaseUrl?: string;
  linearMockMode: boolean;
  acknowledgmentMessage?: string;
  failOnMissingRepos: boolean;
  prPipelineEnabled: boolean;
  prDryRun: boolean;
  prettyLogs: boolean;
  advancedConfigured: boolean;
  force: boolean;
};

export type InitParsedFlags = InitOptions & {
  json: boolean;
  yes: boolean;
};

export const DEFAULT_ACK_MESSAGE = 'Thanks — we are reviewing this issue.';

export const DEFAULT_REQUEST_LOGGER_EXCLUDE_PATHS = ['/api/health', '/api/metrics'];

export function defaultModelForAgent(agentId: string): string {
  switch (agentId) {
    case 'claude':
      return 'sonnet';
    case 'cursor':
      return 'composer-2.5-fast';
    default:
      return 'opencode/deepseek-v4-flash-free';
  }
}

export function resolveRepoPath(repoPath: string, cwd = process.cwd()): string {
  return isAbsolute(repoPath) ? repoPath : resolve(cwd, repoPath);
}

export function defaultInitOptions(cwd = process.cwd()): InitOptions {
  const repoPath = cwd;
  const repoName = basename(repoPath) || 'symfony';
  return {
    port: 3001,
    agent: 'opencode',
    repos: [{ name: repoName, path: repoPath }],
    issueTracker: 'jira',
    jiraMockMode: true,
    linearMockMode: true,
    acknowledgmentMessage: DEFAULT_ACK_MESSAGE,
    failOnMissingRepos: false,
    prPipelineEnabled: true,
    prDryRun: true,
    prettyLogs: false,
    advancedConfigured: false,
    force: false,
  };
}
