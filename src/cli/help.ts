import { APP_NAME, APP_VERSION } from '../version.js';

export type HelpTopic = 'main' | 'serve' | 'init' | 'doctor' | 'smoke' | 'triage' | 'validate-config';

const DOCS_URL = 'https://agent-detective.chapascript.dev/docs/';

/** Resolve help topic from argv (after node + script). Returns undefined → main help. */
export function resolveHelpTopic(argv: string[]): HelpTopic | undefined {
  const args = argv.slice(2);
  const hasHelpFlag = args.some((a) => a === '--help' || a === '-h');
  if (!hasHelpFlag && args[0] !== 'help') return undefined;

  const positional = args.filter((a) => !a.startsWith('-') && a !== 'help');
  const topic = args[0] === 'help' ? args[1] : positional[0];

  switch (topic) {
    case 'init':
    case 'doctor':
    case 'smoke':
    case 'triage':
    case 'validate-config':
    case 'serve':
    case 'start':
      return topic === 'start' ? 'serve' : topic;
    default:
      return 'main';
  }
}

export function formatMainHelp(): string {
  return `${APP_NAME} ${APP_VERSION}
AI agent host — issue trackers, webhooks, local repos, code analysis.

Quick start (npm)
  mkdir -p ~/agent-detective && cd ~/agent-detective
  ${APP_NAME} init
  ${APP_NAME} doctor --config-root .
  ${APP_NAME} --config-root .              # terminal 1: server
  ${APP_NAME} smoke --config-root .        # terminal 2: mock Jira webhook

Commands
  ${APP_NAME} [options]                    Start HTTP server (default)
  ${APP_NAME} init [options]               Create config/local.json (+ default.json)
  ${APP_NAME} doctor [options]             Preflight: config, agent, plugins
  ${APP_NAME} smoke [options]              Mock webhook smoke (server must be running)
  ${APP_NAME} triage <key|url> [options]  Triage a Jira ticket from the CLI
  ${APP_NAME} validate-config [options]    Validate config files only
  ${APP_NAME} help [command]               Show help for a command
  ${APP_NAME} --version                    Print version

Global options
  --config-root <dir>    Directory with config/ (or the config/ dir itself)
  -h, --help             Show help (use: ${APP_NAME} help <command>)
  AGENT_DETECTIVE_CONFIG_ROOT   Same as --config-root

Details: ${APP_NAME} help init | doctor | smoke | triage | validate-config
Docs:    ${DOCS_URL}`;
}

export function formatCommandHelp(topic: Exclude<HelpTopic, 'main'>): string {
  switch (topic) {
    case 'serve':
      return `${APP_NAME} serve — start the server

Usage:
  ${APP_NAME} [--config-root <dir>]

Starts the HTTP server, loads plugins from config, and listens for webhooks.
OpenAPI docs are served at /docs (default port 3001).

Examples:
  ${APP_NAME}
  ${APP_NAME} --config-root ~/agent-detective

Options:
  --config-root <dir>    Install directory (contains config/local.json)
  -h, --help             Show this help`;
    case 'init':
      return `${APP_NAME} init — scaffold operator config

Usage:
  ${APP_NAME} init [options]

In a TTY, runs a guided wizard (review screen before writing files).
With --yes, uses flags or sensible defaults (CI/scripts).

Writes:
  config/local.json      Your settings (plugins, repos, agent, port)
  config/default.json    Copied from package template when missing

Examples:
  ${APP_NAME} init
  ${APP_NAME} init --yes --repo-path /path/to/checkout --repo-name symfony
  ${APP_NAME} init --yes --agent cursor --default-model composer-2.5-fast

Common options:
  --yes, -y              Non-interactive mode
  --json                 Machine-readable result
  --force                Overwrite existing local.json
  --config-root <dir>    Install directory (default: cwd)
  --repo-path, --repo-name, --repo <name:path>
  --port, --agent, --default-model
  --tracker jira|linear|mock-only
  --jira-mock | --no-jira-mock, --jira-base-url <url>
  --linear-mock | --no-linear-mock
  --ack-message, --fail-on-missing-repos
  --pr-pipeline | --no-pr-pipeline, --pr-dry-run | --no-pr-dry-run
  --pretty-logs
  -h, --help             Show this help`;
    case 'doctor':
      return `${APP_NAME} doctor — preflight checks

Usage:
  ${APP_NAME} doctor [options]

Validates config load, agent CLI on PATH, plugin packages, local repo
paths, tracker credentials (when not in mock mode), and listen port.

Examples:
  ${APP_NAME} doctor
  ${APP_NAME} doctor --config-root ~/agent-detective --verbose
  ${APP_NAME} doctor --json

Options:
  --config-root <dir>    Install directory
  --json                 Machine-readable report
  --verbose              Extra check details
  -h, --help             Show this help`;
    case 'smoke':
      return `${APP_NAME} smoke — mock Jira webhook test

Usage:
  ${APP_NAME} smoke [options]

POSTs the bundled jira:issue_created fixture to your local Jira adapter.
Requires the server running and mock Jira enabled (default after init).

Fixture labels: probando, symfony — match a repos[].name in your config.

Examples:
  ${APP_NAME} smoke --config-root ~/agent-detective
  ${APP_NAME} smoke --json
  ${APP_NAME} smoke --url http://127.0.0.1:3001/plugins/agent-detective-jira-adapter/webhook/jira

Options:
  --config-root <dir>    Read port from config (default host 127.0.0.1)
  --url <webhook-url>    Full webhook URL (overrides config port)
  --host <host>          Host when building URL from config port
  --json                 Machine-readable result
  JIRA_WEBHOOK_URL       Same as --url
  AGENT_DETECTIVE_SMOKE_HOST   Default host (127.0.0.1)
  -h, --help             Show this help

Success: HTTP 200 and {"status":"queued",...}; server logs show agent run
and [MOCK] Added comment when analysis completes.`;
    case 'triage':
      return `${APP_NAME} triage — triage a Jira ticket or free text from the CLI

Usage:
  ${APP_NAME} triage <PROJ-123 | URL> [options]       Jira mode
  ${APP_NAME} triage --text "description" --repo NAME  Text mode
  echo "description" | ${APP_NAME} triage --repo NAME  Stdin mode

Jira mode fetches the issue, matches repos by labels, runs the analysis
agent. Text mode skips Jira entirely — paste the incident description
directly. Does not require the server to be running.

Examples:
  ${APP_NAME} triage PROJ-123
  ${APP_NAME} triage https://mysite.atlassian.net/browse/PROJ-123
  ${APP_NAME} triage PROJ-123 --output file --output-path ./reports/
  ${APP_NAME} triage PROJ-123 --output jira
  ${APP_NAME} triage --text "JSON corruption on save" --repo av-symf
  echo "JSON corruption" | ${APP_NAME} triage --repo av-symf --verbose
  ${APP_NAME} triage PROJ-123 --repo av-symf   (override label matching)

Options:
  --text <description>   Free-text incident (skips Jira fetch)
  --repo <name>          Explicit repo (required in text mode, optional override in Jira mode)
  --output <mode>        stdout (default), file, or jira (jira not available in text mode)
  --output-path <dir>    Directory for file output (default: ./reports/)
  --prompt <text>        Override the analysisPrompt from config
  --verbose              Stream raw agent output to stderr
  --json                 Machine-readable JSON output
  --config-root <dir>    Install directory
  -h, --help             Show this help`;
    case 'validate-config':
      return `${APP_NAME} validate-config — config files only

Usage:
  ${APP_NAME} validate-config [options]

Loads and validates config/default.json + config/local.json with Zod.
Does not check agent CLI or plugin imports (use doctor for full preflight).

Examples:
  ${APP_NAME} validate-config --config-root ~/agent-detective

Options:
  --config-root <dir>    Install directory
  --json, --verbose
  -h, --help             Show this help`;
  }
}

export function formatHelp(topic: HelpTopic = 'main'): string {
  if (topic === 'main') return formatMainHelp();
  return formatCommandHelp(topic);
}

export function printHelp(topic: HelpTopic = 'main'): void {
  // eslint-disable-next-line no-console
  console.log(formatHelp(topic));
}
