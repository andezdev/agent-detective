import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isKnownAgent, normalizeAgent } from '../agents/index.js';
import { loadConfig } from '../server.js';
import { shouldRunWizard } from './init-interactive.js';
import {
  DEFAULT_ACK_MESSAGE,
  DEFAULT_REQUEST_LOGGER_EXCLUDE_PATHS,
  defaultInitOptions,
  defaultModelForAgent,
  resolveRepoPath,
  type InitOptions,
  type InitParsedFlags,
  type InitRepo,
  type IssueTracker,
} from './init-types.js';
import { printNextSteps } from './init-ui.js';
import { runInitWizard } from './init-wizard.js';

export type { InitOptions, InitParsedFlags, InitRepo, IssueTracker } from './init-types.js';
export { shouldRunWizard } from './init-interactive.js';
export { runInitWizard } from './init-wizard.js';

type RunInitOptions = {
  installRoot?: string;
  argv: string[];
};

function resolveConfigDirFromInstallRoot(installRoot: string | undefined): string {
  if (installRoot && installRoot.split(/[\\/]/).pop() === 'config') {
    return installRoot;
  }
  const base = installRoot ?? process.cwd();
  return resolve(base, 'config');
}

/** Template shipped in the npm tarball at `config/default.json`. */
export function resolvePackagedDefaultConfigPath(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '..', 'config', 'default.json'),
    resolve(here, '..', '..', 'config', 'default.json'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Copy packaged `default.json` into the operator config dir when missing. */
export function seedDefaultConfigIfMissing(configDir: string): boolean {
  const targetPath = resolve(configDir, 'default.json');
  if (existsSync(targetPath)) return false;

  const packagedPath = resolvePackagedDefaultConfigPath();
  if (!packagedPath) return false;

  mkdirSync(configDir, { recursive: true });
  copyFileSync(packagedPath, targetPath);
  return true;
}

function takeFlagValue(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === flag) return args[i + 1];
    if (a?.startsWith(`${flag}=`)) return a.slice(flag.length + 1);
  }
  return undefined;
}

function takeAllFlagValues(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === flag && args[i + 1]) {
      values.push(args[i + 1]!);
      i++;
    } else if (a?.startsWith(`${flag}=`)) {
      values.push(a.slice(flag.length + 1));
    }
  }
  return values;
}

function parseRepoSpec(spec: string, cwd: string): InitRepo {
  const colon = spec.indexOf(':');
  if (colon === -1) {
    const path = resolveRepoPath(spec, cwd);
    return { name: basename(path) || 'symfony', path };
  }
  const name = spec.slice(0, colon).trim();
  const pathRaw = spec.slice(colon + 1).trim();
  return { name: name || basename(pathRaw) || 'symfony', path: resolveRepoPath(pathRaw, cwd) };
}

function parseReposFromFlags(args: string[], cwd: string): InitRepo[] | undefined {
  const repoSpecs = takeAllFlagValues(args, '--repo');
  if (repoSpecs.length > 0) {
    return repoSpecs.map((spec) => parseRepoSpec(spec, cwd));
  }

  const repoPath = takeFlagValue(args, '--repo-path');
  const repoName = takeFlagValue(args, '--repo-name');
  if (repoPath || repoName) {
    const path = resolveRepoPath(repoPath ?? cwd, cwd);
    return [{ name: repoName ?? (basename(path) || 'symfony'), path }];
  }

  return undefined;
}

function parseIssueTracker(args: string[]): IssueTracker | undefined {
  const raw = takeFlagValue(args, '--tracker');
  if (!raw) return undefined;
  if (raw === 'jira' || raw === 'linear' || raw === 'mock-only') return raw;
  return 'jira';
}

function parsePort(args: string[]): number | undefined {
  const raw = takeFlagValue(args, '--port');
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseBooleanFlag(args: string[], flag: string): boolean | undefined {
  if (args.includes(flag)) return true;
  const negated = `--no-${flag.slice(2)}`;
  if (args.includes(negated)) return false;
  return undefined;
}

export function parseInitFlags(argv: string[], cwd = process.cwd()): InitParsedFlags {
  const args = argv.slice(2).filter((a) => a !== 'init');
  const defaults = defaultInitOptions(cwd);

  const repos = parseReposFromFlags(args, cwd) ?? defaults.repos;
  const agentRaw = takeFlagValue(args, '--agent') ?? defaults.agent;
  const agent = isKnownAgent(agentRaw) ? normalizeAgent(agentRaw) : normalizeAgent('opencode');
  const issueTracker = parseIssueTracker(args) ?? defaults.issueTracker;

  const jiraMockFlag = parseBooleanFlag(args, '--jira-mock');
  const linearMockFlag = parseBooleanFlag(args, '--linear-mock');
  const prPipelineFlag = parseBooleanFlag(args, '--pr-pipeline');

  return {
    port: parsePort(args) ?? defaults.port,
    agent,
    defaultModel: takeFlagValue(args, '--default-model'),
    repos,
    issueTracker,
    jiraMockMode:
      issueTracker === 'mock-only' ? true : jiraMockFlag ?? defaults.jiraMockMode,
    jiraBaseUrl: takeFlagValue(args, '--jira-base-url'),
    linearMockMode: linearMockFlag ?? defaults.linearMockMode,
    acknowledgmentMessage: takeFlagValue(args, '--ack-message') ?? defaults.acknowledgmentMessage,
    failOnMissingRepos: args.includes('--fail-on-missing-repos'),
    prPipelineEnabled: prPipelineFlag ?? defaults.prPipelineEnabled,
    prDryRun: parseBooleanFlag(args, '--pr-dry-run') ?? defaults.prDryRun,
    prettyLogs: args.includes('--pretty-logs'),
    advancedConfigured:
      args.includes('--fail-on-missing-repos') ||
      args.includes('--pretty-logs') ||
      prPipelineFlag !== undefined ||
      parseBooleanFlag(args, '--pr-dry-run') !== undefined ||
      (parseReposFromFlags(args, cwd)?.length ?? 0) > 1,
    force: args.includes('--force'),
    json: args.includes('--json'),
    yes: args.includes('--yes') || args.includes('-y'),
  };
}

export function buildInitLocalConfig(options: InitOptions, cwd = process.cwd()): Record<string, unknown> {
  const resolvedRepos = options.repos.map((repo) => ({
    name: repo.name,
    path: resolveRepoPath(repo.path, cwd),
    description:
      repo.description ??
      `Repo matched when issue has label ${repo.name}`,
  }));

  const jiraEnabled = options.issueTracker === 'jira' || options.issueTracker === 'mock-only';
  const linearEnabled = options.issueTracker === 'linear';

  const jiraOptions: Record<string, unknown> = {
    enabled: jiraEnabled,
    mockMode:
      options.issueTracker === 'mock-only' ? true : jiraEnabled ? options.jiraMockMode : false,
    webhookBehavior: {
      defaults: {
        action: 'ignore',
        acknowledgmentMessage: options.acknowledgmentMessage ?? DEFAULT_ACK_MESSAGE,
      },
      events: {
        'jira:issue_created': { action: 'analyze' },
        'jira:comment_created': { action: 'analyze' },
      },
    },
  };
  if (!jiraOptions.mockMode && options.jiraBaseUrl) {
    jiraOptions.baseUrl = options.jiraBaseUrl;
  }

  const linearOptions: Record<string, unknown> = {
    enabled: linearEnabled,
    mockMode: linearEnabled ? options.linearMockMode : true,
  };

  const prPipelineOptions: Record<string, unknown> = {
    prBranchPrefix: 'hotfix/',
    prTitleTemplate: '[{{key}}] {{summary}}',
  };
  if (options.prPipelineEnabled) {
    prPipelineOptions.enabled = true;
    prPipelineOptions.prDryRun = options.prDryRun;
  } else {
    prPipelineOptions.enabled = false;
  }

  const config: Record<string, unknown> = {
    port: options.port,
    agent: options.agent,
    agents: {
      [options.agent]: {
        defaultModel: options.defaultModel ?? defaultModelForAgent(options.agent),
      },
    },
    plugins: [
      {
        package: '@agent-detective/local-repos-plugin',
        options: {
          repos: resolvedRepos,
          validation: { failOnMissing: options.failOnMissingRepos },
        },
      },
      {
        package: '@agent-detective/jira-adapter',
        options: jiraOptions,
      },
      {
        package: '@agent-detective/linear-adapter',
        options: linearOptions,
      },
      {
        package: '@agent-detective/pr-pipeline',
        options: prPipelineOptions,
      },
    ],
  };

  if (options.prettyLogs || options.advancedConfigured) {
    const observability: Record<string, unknown> = {};
    if (options.prettyLogs) {
      observability.logging = {
        pretty: { enabled: true, format: 'console' },
      };
    }
    if (options.advancedConfigured) {
      observability.requestLogger = {
        excludePaths: DEFAULT_REQUEST_LOGGER_EXCLUDE_PATHS,
      };
    }
    config.observability = observability;
  }

  return config;
}

async function resolveInitOptions(
  installRoot: string | undefined,
  argv: string[],
): Promise<{ options: InitOptions; installRootUsed: string }> {
  const cwd = installRoot ?? process.cwd();

  if (shouldRunWizard(argv)) {
    const wizard = await runInitWizard({ installRoot: cwd });
    const flags = parseInitFlags(argv, cwd);
    return {
      options: { ...wizard.options, force: flags.force },
      installRootUsed: wizard.installRoot,
    };
  }

  const flags = parseInitFlags(argv, cwd);
  return {
    options: flags,
    installRootUsed: installRoot ?? process.cwd(),
  };
}

async function confirmOverwriteInteractive(localPath: string): Promise<boolean> {
  const clack = await import('@clack/prompts');
  const answer = await clack.confirm({
    message: `${localPath} already exists. Overwrite it?`,
    initialValue: false,
  });
  if (clack.isCancel(answer)) {
    clack.cancel('Setup cancelled.');
    return false;
  }
  return answer as boolean;
}

export async function runInit({ installRoot, argv }: RunInitOptions): Promise<void> {
  const flags = parseInitFlags(argv, installRoot ?? process.cwd());
  const resolved = await resolveInitOptions(installRoot, argv);
  const options = resolved.options;
  const installRootUsed = resolved.installRootUsed;
  const configDir = resolveConfigDirFromInstallRoot(installRootUsed);
  const localPath = resolve(configDir, 'local.json');

  if (existsSync(localPath) && !options.force) {
    if (shouldRunWizard(argv)) {
      const overwrite = await confirmOverwriteInteractive(localPath);
      if (!overwrite) {
        process.exitCode = 1;
        return;
      }
    } else {
      const message = `Refusing to overwrite ${localPath}. Use --force to replace it.`;
      if (flags.json) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ok: false, error: message, localPath }, null, 2));
      } else {
        console.error(message);
      }
      process.exitCode = 1;
      return;
    }
  }

  mkdirSync(configDir, { recursive: true });
  seedDefaultConfigIfMissing(configDir);
  const config = buildInitLocalConfig(options, installRootUsed);
  writeFileSync(localPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  let validated = true;
  let validationError: string | undefined;
  try {
    loadConfig({ configRoot: configDir });
  } catch (err) {
    validated = false;
    validationError = (err as Error).message;
  }

  if (flags.json) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: validated,
          localPath,
          configDir,
          installRootUsed,
          repos: options.repos,
          agent: options.agent,
          port: options.port,
          issueTracker: options.issueTracker,
          validationError,
        },
        null,
        2,
      ),
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(`Wrote ${localPath}`);
    if (!validated) {
      console.error(`Warning: generated config failed validation: ${validationError}`);
    } else {
      printNextSteps(installRootUsed, options);
    }
  }

  process.exitCode = validated ? 0 : 1;
}
