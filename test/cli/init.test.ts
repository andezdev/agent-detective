import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildInitLocalConfig,
  parseInitFlags,
  resolvePackagedDefaultConfigPath,
  runInit,
  seedDefaultConfigIfMissing,
} from '../../src/cli/init.js';
import { shouldRunWizard } from '../../src/cli/init-interactive.js';
import {
  promptDefaultModel,
  runInitWizard,
  WIZARD_STEP_COPY,
  formatReviewBox,
  type InitWizardPrompter,
} from '../../src/cli/init-wizard.js';
import { createWizardState } from '../../src/cli/init-wizard-state.js';
import { loadConfig } from '../../src/config/load.js';

function stubPrompter(answers: {
  configDir?: string;
  agent?: string;
  defaultModel?: string;
  repoPath?: string;
  repoName?: string;
  port?: string;
  issueTracker?: string;
  jiraMock?: boolean;
  jiraBaseUrl?: string;
  linearMock?: boolean;
  ackMessage?: string;
  advanced?: boolean;
  addAnotherRepo?: boolean;
  failOnMissing?: boolean;
  prPipeline?: boolean;
  prDryRun?: boolean;
  prettyLogs?: boolean;
  reviewActions?: string[];
}): InitWizardPrompter {
  let textIndex = 0;
  let reviewIndex = 0;
  const textDefaults = [
    answers.repoName ?? 'install',
    answers.port ?? '3001',
    answers.jiraBaseUrl,
    answers.ackMessage ?? 'Thanks — we are reviewing this issue.',
  ].filter((v): v is string => v !== undefined);

  const baseSelect = async <T extends string>(opts: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
    initialValue?: T;
  }): Promise<T> => {
    const { initialValue, options, message } = opts;
    if (message.includes('What would you like')) {
      const action = answers.reviewActions?.[reviewIndex++] ?? 'write';
      return action as T;
    }
    if (message.includes('Default model') && answers.defaultModel) {
      return answers.defaultModel as T;
    }
    if (answers.agent && options.some((o) => o.value === answers.agent)) {
      return answers.agent as T;
    }
    if (answers.issueTracker && options.some((o) => o.value === answers.issueTracker)) {
      return answers.issueTracker as T;
    }
    return (initialValue ?? options[0]!.value) as T;
  };

  return {
    intro: () => {},
    outro: () => {},
    cancel: () => {},
    isCancel: (value) => typeof value === 'symbol',
    text: async ({ message, defaultValue }) => {
      if (message.includes('Install directory')) {
        return answers.configDir ?? defaultValue ?? '';
      }
      if (message.includes('Default model')) {
        return answers.defaultModel ?? defaultValue ?? '';
      }
      if (message.includes('Repo label')) {
        return answers.repoName ?? defaultValue ?? '';
      }
      const value = textDefaults[textIndex] ?? defaultValue ?? '';
      textIndex++;
      return value;
    },
    select: baseSelect as InitWizardPrompter['select'],
    autocomplete: baseSelect as InitWizardPrompter['autocomplete'],
    confirm: async ({ message, initialValue }) => {
      if (message.includes('Jira mock')) return answers.jiraMock ?? true;
      if (message.includes('Linear mock')) return answers.linearMock ?? true;
      if (message.includes('advanced options')) return answers.advanced ?? false;
      if (message.includes('another repository')) return answers.addAnotherRepo ?? false;
      if (message.includes('repo path is missing')) return answers.failOnMissing ?? false;
      if (message.includes('PR-from-Jira')) return answers.prPipeline ?? true;
      if (message.includes('dry-run')) return answers.prDryRun ?? true;
      if (message.includes('Pretty console')) return answers.prettyLogs ?? false;
      return initialValue ?? true;
    },
    note: () => {},
    path: async ({ message, initialValue }) => {
      if (message.includes('Repository')) {
        return answers.repoPath ?? initialValue ?? '';
      }
      return initialValue ?? '';
    },
    spinner: () => ({
      start: () => {},
      stop: () => {},
      message: () => {},
    }),
    log: {
      step: () => {},
      warn: () => {},
      success: () => {},
      info: () => {},
    },
    box: () => {},
  };
}

describe('init CLI', () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  test('shouldRunWizard is false for --json, --yes, and non-TTY', () => {
    assert.strictEqual(
      shouldRunWizard(['node', 'agent-detective', 'init', '--json'], true),
      false,
    );
    assert.strictEqual(
      shouldRunWizard(['node', 'agent-detective', 'init', '--yes'], true),
      false,
    );
    assert.strictEqual(
      shouldRunWizard(['node', 'agent-detective', 'init', '-y'], true),
      false,
    );
    assert.strictEqual(shouldRunWizard(['node', 'agent-detective', 'init'], false), false);
    assert.strictEqual(shouldRunWizard(['node', 'agent-detective', 'init'], true), true);
  });

  test('WIZARD_STEP_COPY explains acknowledgment and PR pipeline', () => {
    assert.match(WIZARD_STEP_COPY.ackMessage.note!, /acknowledges a webhook/i);
    assert.match(WIZARD_STEP_COPY.prPipeline.note!, /#agent-detective pr/i);
  });

  test('formatReviewBox includes install root and webhook URL', () => {
    const state = createWizardState('/opt/ad');
    state.port = 4000;
    state.agent = 'opencode';
    state.defaultModel = 'opencode/deepseek-v4-flash-free';
    state.repos = [{ name: 'symfony', path: '/opt/checkout' }];
    const box = formatReviewBox(state);
    assert.match(box, /Install directory:\s+\/opt\/ad/);
    assert.match(box, /4000/);
    assert.match(box, /agent-detective-jira-adapter\/webhook\/jira/);
  });

  test('parseInitFlags reads non-interactive options', () => {
    const flags = parseInitFlags([
      'node',
      'agent-detective',
      'init',
      '--repo-path',
      '/repos/my-app',
      '--repo-name',
      'my-app',
      '--agent',
      'cursor',
      '--port',
      '4000',
      '--tracker',
      'linear',
      '--force',
      '--json',
      '--yes',
    ]);

    assert.strictEqual(flags.repos[0]?.path, '/repos/my-app');
    assert.strictEqual(flags.repos[0]?.name, 'my-app');
    assert.strictEqual(flags.agent, 'cursor');
    assert.strictEqual(flags.port, 4000);
    assert.strictEqual(flags.issueTracker, 'linear');
    assert.strictEqual(flags.force, true);
    assert.strictEqual(flags.json, true);
    assert.strictEqual(flags.yes, true);
  });

  test('parseInitFlags parses --repo name:path and disables jira mock', () => {
    const flags = parseInitFlags([
      'node',
      'agent-detective',
      'init',
      '--repo',
      'symfony:/data/symfony',
      '--no-jira-mock',
      '--jira-base-url',
      'https://acme.atlassian.net',
    ]);

    assert.strictEqual(flags.repos[0]?.name, 'symfony');
    assert.strictEqual(flags.repos[0]?.path, '/data/symfony');
    assert.strictEqual(flags.jiraMockMode, false);
    assert.strictEqual(flags.jiraBaseUrl, 'https://acme.atlassian.net');
  });

  test('parseInitFlags falls back to opencode for unknown agent', () => {
    const flags = parseInitFlags(['node', 'agent-detective', 'init', '--agent', 'unknown-bot']);
    assert.strictEqual(flags.agent, 'opencode');
  });

  test('buildInitLocalConfig produces mock-first-run shape', () => {
    const config = buildInitLocalConfig({
      port: 3001,
      agent: 'opencode',
      repos: [{ path: '/data/checkout', name: 'symfony' }],
      issueTracker: 'jira',
      jiraMockMode: true,
      linearMockMode: true,
      failOnMissingRepos: false,
      prPipelineEnabled: true,
      prDryRun: true,
      prettyLogs: false,
      advancedConfigured: false,
      force: false,
    });

    assert.strictEqual(config.port, 3001);
    assert.strictEqual(config.agent, 'opencode');
    const plugins = config.plugins as Array<{ package: string; options: Record<string, unknown> }>;
    const localRepos = plugins.find((p) => p.package === '@agent-detective/local-repos-plugin');
    const jira = plugins.find((p) => p.package === '@agent-detective/jira-adapter');
    const linear = plugins.find((p) => p.package === '@agent-detective/linear-adapter');
    assert.ok(localRepos);
    assert.ok(jira);
    assert.ok(linear);
    const repos = localRepos!.options.repos as Array<{ name: string; path: string }>;
    assert.strictEqual(repos[0]?.name, 'symfony');
    assert.strictEqual(repos[0]?.path, '/data/checkout');
    assert.strictEqual(jira!.options.mockMode, true);
    assert.strictEqual(jira!.options.enabled, true);
    assert.strictEqual(linear!.options.enabled, false);
  });

  test('buildInitLocalConfig enables Linear and real Jira baseUrl', () => {
    const config = buildInitLocalConfig({
      port: 3001,
      agent: 'opencode',
      repos: [{ path: '/data/checkout', name: 'symfony' }],
      issueTracker: 'linear',
      jiraMockMode: true,
      linearMockMode: false,
      failOnMissingRepos: false,
      prPipelineEnabled: true,
      prDryRun: true,
      prettyLogs: false,
      advancedConfigured: false,
      force: false,
    });

    const plugins = config.plugins as Array<{ package: string; options: Record<string, unknown> }>;
    const jira = plugins.find((p) => p.package === '@agent-detective/jira-adapter');
    const linear = plugins.find((p) => p.package === '@agent-detective/linear-adapter');
    assert.strictEqual(jira!.options.enabled, false);
    assert.strictEqual(linear!.options.enabled, true);
    assert.strictEqual(linear!.options.mockMode, false);
  });

  test('buildInitLocalConfig adds observability when advanced pretty logs enabled', () => {
    const config = buildInitLocalConfig({
      port: 3001,
      agent: 'opencode',
      repos: [{ path: '/data/checkout', name: 'symfony' }],
      issueTracker: 'jira',
      jiraMockMode: true,
      linearMockMode: true,
      failOnMissingRepos: true,
      prPipelineEnabled: true,
      prDryRun: true,
      prettyLogs: true,
      advancedConfigured: true,
      force: false,
    });

    const observability = config.observability as Record<string, unknown>;
    assert.ok(observability);
    assert.deepStrictEqual(
      (observability.requestLogger as { excludePaths: string[] }).excludePaths,
      ['/api/health', '/api/metrics'],
    );
    assert.strictEqual(
      (observability.logging as { pretty: { enabled: boolean } }).pretty.enabled,
      true,
    );
  });

  test('buildInitLocalConfig disables PR pipeline when requested', () => {
    const config = buildInitLocalConfig({
      port: 3001,
      agent: 'opencode',
      repos: [{ path: '/data/checkout', name: 'symfony' }],
      issueTracker: 'jira',
      jiraMockMode: true,
      linearMockMode: true,
      failOnMissingRepos: false,
      prPipelineEnabled: false,
      prDryRun: true,
      prettyLogs: false,
      advancedConfigured: false,
      force: false,
    });

    const plugins = config.plugins as Array<{ package: string; options: Record<string, unknown> }>;
    const pr = plugins.find((p) => p.package === '@agent-detective/pr-pipeline');
    assert.strictEqual(pr!.options.enabled, false);
  });

  test('buildInitLocalConfig passes Zod validation when loaded', () => {
    const dir = mkdtempSync(join(tmpdir(), 'init-cfg-'));
    const body = buildInitLocalConfig({
      port: 3001,
      agent: 'opencode',
      repos: [{ path: dir, name: 'symfony' }],
      issueTracker: 'jira',
      jiraMockMode: true,
      linearMockMode: true,
      failOnMissingRepos: false,
      prPipelineEnabled: true,
      prDryRun: true,
      prettyLogs: false,
      advancedConfigured: false,
      force: false,
    });
    writeFileSync(join(dir, 'local.json'), JSON.stringify(body));

    const cfg = loadConfig({ configRoot: dir });
    assert.strictEqual(cfg.agent, 'opencode');
    assert.strictEqual(cfg.port, 3001);
  });

  test('runInitWizard returns options from injectable prompter', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'init-wiz-'));
    const result = await runInitWizard({
      installRoot: dir,
      prompter: stubPrompter({
        configDir: dir,
        agent: 'cursor',
        defaultModel: 'composer-2.5-fast',
        repoPath: dir,
        repoName: 'symfony',
        issueTracker: 'jira',
        jiraMock: true,
        reviewActions: ['write'],
      }),
      isTTY: true,
      listAgentModels: async () => ['composer-2.5-fast', 'gpt-5.3-codex'],
    });

    assert.strictEqual(result.installRoot, dir);
    assert.strictEqual(result.options.agent, 'cursor');
    assert.strictEqual(result.options.defaultModel, 'composer-2.5-fast');
    assert.strictEqual(result.options.repos[0]?.name, 'symfony');
    assert.strictEqual(result.options.issueTracker, 'jira');
    assert.strictEqual(result.options.jiraMockMode, true);
  });

  test('runInitWizard review loop can edit agent before write', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'init-wiz-edit-'));
    const agents: string[] = [];

    const prompter = stubPrompter({
      configDir: dir,
      agent: 'opencode',
      defaultModel: 'opencode/deepseek-v4-flash-free',
      repoPath: dir,
      repoName: 'symfony',
      issueTracker: 'jira',
      reviewActions: ['edit-agent', 'write'],
    });

    const originalSelect = prompter.select;
    prompter.select = (async (opts) => {
      const value = await originalSelect(opts);
      if (opts.message.includes('Default agent') && typeof value === 'string') {
        agents.push(value);
      }
      return value;
    }) as InitWizardPrompter['select'];

    const result = await runInitWizard({
      installRoot: dir,
      prompter,
      listAgentModels: async () => null,
    });

    assert.strictEqual(agents.length, 2);
    assert.strictEqual(result.options.agent, 'opencode');
  });

  test('promptDefaultModel offers a select when models are available', async () => {
    const selected: string[] = [];
    const prompter = stubPrompter({ defaultModel: 'gpt-5.3-codex' });
    const originalSelect = prompter.select;
    prompter.select = (async (opts) => {
      selected.push(opts.message);
      return originalSelect(opts);
    }) as InitWizardPrompter['select'];

    const model = await promptDefaultModel(
      prompter,
      'cursor',
      async () => ['composer-2.5-fast', 'gpt-5.3-codex'],
    );

    assert.strictEqual(model, 'gpt-5.3-codex');
    assert.ok(selected.some((message) => message.includes('Default model')));
  });

  test('promptDefaultModel falls back to text when listing fails', async () => {
    const prompter = stubPrompter({ defaultModel: 'sonnet' });
    const model = await promptDefaultModel(prompter, 'claude', async () => null);
    assert.strictEqual(model, 'sonnet');
  });

  test('resolvePackagedDefaultConfigPath finds repo config/default.json', () => {
    const packaged = resolvePackagedDefaultConfigPath();
    assert.ok(packaged);
    assert.ok(existsSync(packaged!));
    const body = JSON.parse(readFileSync(packaged!, 'utf8')) as { port: number };
    assert.strictEqual(typeof body.port, 'number');
  });

  test('seedDefaultConfigIfMissing copies default.json and does not overwrite', () => {
    const root = mkdtempSync(join(tmpdir(), 'init-seed-'));
    const configDir = join(root, 'config');

    assert.strictEqual(seedDefaultConfigIfMissing(configDir), true);
    const defaultPath = join(configDir, 'default.json');
    assert.ok(existsSync(defaultPath));

    const first = readFileSync(defaultPath, 'utf8');
    assert.strictEqual(seedDefaultConfigIfMissing(configDir), false);
    assert.strictEqual(readFileSync(defaultPath, 'utf8'), first);

    writeFileSync(defaultPath, '{"port":9999}\n');
    assert.strictEqual(seedDefaultConfigIfMissing(configDir), false);
    assert.strictEqual(readFileSync(defaultPath, 'utf8'), '{"port":9999}\n');
  });

  test('runInit seeds default.json alongside local.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'init-default-'));
    const defaultPath = join(root, 'config', 'default.json');
    const localPath = join(root, 'config', 'local.json');

    await runInit({
      installRoot: root,
      argv: ['node', 'agent-detective', 'init', '--yes', '--repo-name', 'symfony', '--repo-path', root],
    });
    assert.strictEqual(process.exitCode, 0);
    assert.ok(existsSync(defaultPath));
    assert.ok(existsSync(localPath));

    const merged = loadConfig({ configRoot: join(root, 'config') });
    assert.strictEqual(merged.agent, 'opencode');
    assert.strictEqual(merged.port, 3001);
  });

  test('runInit writes local.json and refuses overwrite without --force', async () => {
    const root = mkdtempSync(join(tmpdir(), 'init-run-'));
    const configDir = join(root, 'config');
    const localPath = join(configDir, 'local.json');

    await runInit({
      installRoot: root,
      argv: ['node', 'agent-detective', 'init', '--yes', '--repo-name', 'symfony', '--repo-path', root],
    });
    assert.strictEqual(process.exitCode, 0);
    assert.ok(existsSync(localPath));
    const first = JSON.parse(readFileSync(localPath, 'utf8')) as { agent: string };
    assert.strictEqual(first.agent, 'opencode');

    process.exitCode = 0;
    await runInit({
      installRoot: root,
      argv: ['node', 'agent-detective', 'init', '--yes', '--repo-name', 'other'],
    });
    assert.strictEqual(process.exitCode, 1);
    const still = JSON.parse(readFileSync(localPath, 'utf8')) as { agent: string };
    assert.strictEqual(still.agent, 'opencode');
  });
});
