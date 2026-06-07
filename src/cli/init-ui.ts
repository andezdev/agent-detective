import type { InitOptions } from './init-types.js';
import { defaultModelForAgent } from './init-types.js';
import type { WizardState } from './init-wizard-state.js';
import { APP_NAME, APP_VERSION } from '../version.js';

export function formatReviewBox(state: WizardState): string {
  const model = state.defaultModel || defaultModelForAgent(state.agent);
  const webhookPath =
    state.issueTracker === 'linear'
      ? '/plugins/agent-detective-linear-adapter/webhook/linear'
      : '/plugins/agent-detective-jira-adapter/webhook/jira';
  const webhookUrl = `http://127.0.0.1:${state.port}${webhookPath}`;

  const lines = [
    `Install directory:  ${state.installRoot}`,
    `Config file:        ${state.installRoot}/config/local.json`,
    `Server port:        ${state.port}`,
    `API docs:           http://127.0.0.1:${state.port}/docs`,
    `Webhook URL:        ${webhookUrl}`,
    `Agent:              ${state.agent}`,
    `Model:              ${model}`,
    `Repositories:       ${state.repos.map((r) => `${r.name} → ${r.path}`).join(', ')}`,
    `Issue tracker:      ${state.issueTracker}`,
  ];

  if (state.issueTracker === 'jira' || state.issueTracker === 'mock-only') {
    lines.push(
      `Jira mock mode:     ${state.issueTracker === 'mock-only' ? true : state.jiraMockMode}`,
    );
    if (!state.jiraMockMode && state.jiraBaseUrl) {
      lines.push(`Jira base URL:      ${state.jiraBaseUrl}`);
      lines.push('Jira secrets:       set JIRA_EMAIL + JIRA_API_TOKEN via env');
    }
  }
  if (state.issueTracker === 'linear') {
    lines.push(`Linear mock mode:   ${state.linearMockMode}`);
    if (!state.linearMockMode) {
      lines.push('Linear secrets:     set LINEAR_API_KEY + webhook signing secret via env');
    }
  }

  lines.push(`Ack message:        ${state.acknowledgmentMessage}`);

  if (state.advancedConfigured || state.advancedVisited) {
    lines.push(`Fail on missing:    ${state.failOnMissingRepos}`);
    lines.push(
      `PR pipeline:        ${state.prPipelineEnabled ? (state.prDryRun ? 'enabled (dry-run)' : 'enabled') : 'disabled'}`,
    );
    lines.push(`Pretty logs:        ${state.prettyLogs}`);
  }

  return lines.join('\n');
}

/** @deprecated Use formatReviewBox — kept for tests referencing summary shape */
export function formatInitSummary(options: InitOptions & { installRoot?: string }): string {
  return formatReviewBox({
    installRoot: options.installRoot ?? process.cwd(),
    agent: options.agent,
    defaultModel: options.defaultModel ?? defaultModelForAgent(options.agent),
    repos: options.repos,
    port: options.port,
    issueTracker: options.issueTracker,
    jiraMockMode: options.jiraMockMode,
    jiraBaseUrl: options.jiraBaseUrl,
    linearMockMode: options.linearMockMode,
    acknowledgmentMessage: options.acknowledgmentMessage ?? '',
    advancedConfigured: options.advancedConfigured,
    advancedVisited: options.advancedConfigured,
    failOnMissingRepos: options.failOnMissingRepos,
    prPipelineEnabled: options.prPipelineEnabled,
    prDryRun: options.prDryRun,
    prettyLogs: options.prettyLogs,
  });
}

export function printNextSteps(installRoot: string, options: InitOptions): void {
  const rootFlag = installRoot !== process.cwd() ? ` --config-root ${installRoot}` : '';
  const primaryRepo = options.repos[0]?.name ?? 'symfony';
  const trackerNote =
    options.issueTracker === 'linear'
      ? 'Linear adapter is enabled — configure LINEAR_API_KEY and webhook signing secret via env (see docs).'
      : options.jiraMockMode || options.issueTracker === 'mock-only'
        ? 'Mock Jira mode — safe to hit without posting to Jira.'
        : 'Real Jira mode — set JIRA_EMAIL and JIRA_API_TOKEN (or OAuth vars) via env before starting.';

  // eslint-disable-next-line no-console
  console.log(`
Created config/local.json.
${trackerNote}

Next steps:
  1. agent-detective doctor${rootFlag}
  2. agent-detective${rootFlag}

Mock webhook smoke (server running in another terminal):
  agent-detective smoke${rootFlag}

Docs: https://agent-detective.chapascript.dev/docs/operator/get-started/

Fixture labels: probando, symfony — your primary repo label is "${primaryRepo}".
`);
}

export function agentInstallHint(agentId: string): string | undefined {
  switch (agentId) {
    case 'opencode':
      return 'https://opencode.ai/docs';
    case 'claude':
      return 'https://docs.anthropic.com/en/docs/claude-code';
    case 'cursor':
      return 'https://cursor.com/docs/cli/overview';
    default:
      return undefined;
  }
}

export const WIZARD_INTRO = `${APP_NAME} ${APP_VERSION}

Scaffold config/local.json for a mock-first run.
No Jira account required for the smoke test.`;

export const WIZARD_OUTRO = 'Configuration written successfully.';
