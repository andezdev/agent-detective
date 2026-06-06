export type StepCopy = {
  sectionStep?: string;
  sectionTitle?: string;
  note?: string;
  message: string;
  hint?: string;
  placeholder?: string;
  confirmHint?: string;
};

export const WIZARD_STEP_COPY = {
  installDir: {
    sectionStep: '1/6',
    sectionTitle: 'Setup',
    note: 'Choose where config/local.json will live. Your settings merge over bundled defaults. The folder is created when you finish the wizard.',
    message: 'Install directory path',
    placeholder: '~/agent-detective',
  },
  agent: {
    sectionStep: '2/6',
    sectionTitle: 'Agent runtime',
    note: 'CLI invoked when a webhook queues an analysis task. Must be on PATH and authenticated on this host.',
    message: 'Default agent CLI',
  },
  model: {
    note: 'Model id passed to the agent on each run. List comes from your CLI when available.',
    message: 'Default model for this agent',
  },
  repoPath: {
    sectionStep: '3/6',
    sectionTitle: 'Repository',
    note: 'Local checkout the agent reads when an issue label matches. Same machine as the agent CLI.',
    message: 'Repository path',
  },
  repoLabel: {
    note: 'Issues tagged with this label are routed to the repo above. Smoke fixtures use symfony and probando.',
    message: 'Repo label name',
  },
  port: {
    sectionStep: '4/6',
    sectionTitle: 'Server',
    message: 'Agent Detective server port (webhooks, API, /docs)',
  },
  issueTracker: {
    sectionStep: '5/6',
    sectionTitle: 'Integration',
    message: 'Issue tracker',
    jiraHint: 'Webhooks + mock mode for smoke',
    linearHint: 'Linear webhooks',
    mockOnlyHint: 'curl smoke, no tracker account',
  },
  jiraMock: {
    message: 'Use Jira mock mode?',
    confirmHint: 'Recommended for first run — no posts to your tracker',
  },
  linearMock: {
    message: 'Use Linear mock mode?',
    confirmHint: 'Recommended for first run — no posts to your tracker',
  },
  jiraBaseUrl: {
    note: 'Site URL only. API tokens and email go in env vars (JIRA_*), not in this file.',
    message: 'Jira base URL',
    placeholder: 'https://your-domain.atlassian.net',
  },
  ackMessage: {
    note: 'When Agent Detective acknowledges a webhook (action acknowledge), it posts this text as a comment on the issue — a quick "we received it" reply. Issue analysis (issue_created / comment_created) runs separately and is not replaced by this message.',
    message: 'Acknowledgment comment text',
  },
  configureAdvanced: {
    sectionStep: '6/6',
    sectionTitle: 'Advanced',
    note: 'Optional: extra repos, PR workflow, strict paths, dev logging. Skip for a minimal smoke setup.',
    message: 'Configure advanced options?',
  },
  addRepo: {
    note: 'Each repo needs its own label; one issue can fan out to multiple checkouts when labels match.',
    message: 'Add another repository?',
  },
  failOnMissing: {
    message: 'Refuse to start if a repo path is missing?',
    hint: 'Off = smoke-friendly; On = catch typos early',
  },
  prPipeline: {
    note: 'Optional workflow: a Jira comment with #agent-detective pr can spin up an isolated git worktree, run the agent in write mode, commit, push, and open a PR on GitHub or Bitbucket. Requires VCS config and tokens later (see golden path docs). Safe to leave enabled with dry-run for first setup.',
    message: 'Enable PR-from-Jira workflow?',
  },
  prDryRun: {
    note: 'Simulates the PR workflow (worktree + agent) but does not push branches or create real pull requests.',
    message: 'PR workflow dry-run? (no real PRs)',
  },
  prettyLogs: {
    note: 'Human-readable logs in the terminal instead of JSON lines.',
    message: 'Pretty console logs?',
  },
  review: {
    message: 'What would you like to do?',
  },
} as const satisfies Record<string, StepCopy | Record<string, string>>;
