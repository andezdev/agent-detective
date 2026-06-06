import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import { isKnownAgent, normalizeAgent } from '../agents/index.js';
import { loadConfig } from '../server.js';

export type InitOptions = {
  repoPath: string;
  repoName: string;
  agent: string;
  force: boolean;
};

export type InitParsedFlags = InitOptions & {
  json: boolean;
};

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

function takeFlagValue(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === flag) return args[i + 1];
    if (a?.startsWith(`${flag}=`)) return a.slice(flag.length + 1);
  }
  return undefined;
}

export function parseInitFlags(argv: string[]): InitParsedFlags {
  const args = argv.slice(2).filter((a) => a !== 'init');
  const repoPath = takeFlagValue(args, '--repo-path') ?? process.cwd();
  const repoName =
    takeFlagValue(args, '--repo-name') ?? (basename(repoPath) || 'symfony');
  const agentRaw = takeFlagValue(args, '--agent') ?? 'opencode';
  const agent = isKnownAgent(agentRaw) ? normalizeAgent(agentRaw) : normalizeAgent('opencode');

  return {
    repoPath,
    repoName,
    agent,
    force: args.includes('--force'),
    json: args.includes('--json'),
  };
}

export function buildInitLocalConfig(options: InitOptions): Record<string, unknown> {
  const repoPath = isAbsolute(options.repoPath)
    ? options.repoPath
    : resolve(process.cwd(), options.repoPath);

  return {
    port: 3001,
    agent: options.agent,
    agents: {
      [options.agent]: { defaultModel: defaultModelForAgent(options.agent) },
    },
    plugins: [
      {
        package: '@agent-detective/local-repos-plugin',
        options: {
          repos: [
            {
              name: options.repoName,
              path: repoPath,
              description: `Repo matched when Jira issue has label ${options.repoName}`,
            },
          ],
          validation: { failOnMissing: false },
        },
      },
      {
        package: '@agent-detective/jira-adapter',
        options: {
          enabled: true,
          mockMode: true,
          webhookBehavior: {
            defaults: {
              action: 'ignore',
              acknowledgmentMessage: 'Thanks — we are reviewing this issue.',
            },
            events: {
              'jira:issue_created': { action: 'analyze' },
              'jira:comment_created': { action: 'analyze' },
            },
          },
        },
      },
      {
        package: '@agent-detective/linear-adapter',
        options: { enabled: false, mockMode: true },
      },
      {
        package: '@agent-detective/pr-pipeline',
        options: {
          prBranchPrefix: 'hotfix/',
          prTitleTemplate: '[{{key}}] {{summary}}',
          prDryRun: true,
        },
      },
    ],
  };
}

function defaultModelForAgent(agentId: string): string {
  switch (agentId) {
    case 'claude':
      return 'sonnet';
    case 'cursor':
      return 'composer-2.5-fast';
    default:
      return 'opencode/deepseek-v4-flash-free';
  }
}

function printNextSteps(installRoot: string, repoName: string): void {
  const rootFlag = installRoot !== process.cwd() ? ` --config-root ${installRoot}` : '';
  // eslint-disable-next-line no-console
  console.log(`
Created config/local.json (mockMode: true).

Next steps:
  1. agent-detective doctor${rootFlag}
  2. agent-detective${rootFlag}

Mock webhook smoke (server running in another terminal):
  From a git clone: pnpm run jira:webhook-smoke
  Bundled fixture labels: probando, symfony — your repo name is "${repoName}".
  For a match with the fixture, re-run init with --repo-name symfony or add label "${repoName}" in Jira.

Logs should show [MOCK] Added comment when mock analysis completes.
`);
}

export async function runInit({ installRoot, argv }: RunInitOptions): Promise<void> {
  const flags = parseInitFlags(argv);
  const configDir = resolveConfigDirFromInstallRoot(installRoot);
  const localPath = resolve(configDir, 'local.json');
  const installRootUsed = installRoot ?? process.cwd();

  if (existsSync(localPath) && !flags.force) {
    const message = `Refusing to overwrite ${localPath}. Use --force to replace it.`;
    if (flags.json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ok: false, error: message, localPath }, null, 2));
    } else {
      // eslint-disable-next-line no-console
      console.error(message);
    }
    process.exitCode = 1;
    return;
  }

  mkdirSync(configDir, { recursive: true });
  const config = buildInitLocalConfig(flags);
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
          repoName: flags.repoName,
          repoPath: flags.repoPath,
          agent: flags.agent,
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
      // eslint-disable-next-line no-console
      console.error(`Warning: generated config failed validation: ${validationError}`);
    } else {
      printNextSteps(installRootUsed, flags.repoName);
    }
  }

  process.exitCode = validated ? 0 : 1;
}
