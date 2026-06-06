import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildInitLocalConfig,
  parseInitFlags,
  runInit,
} from '../../src/cli/init.js';
import { loadConfig } from '../../src/config/load.js';

describe('init CLI', () => {
  afterEach(() => {
    process.exitCode = 0;
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
      '--force',
      '--json',
    ]);

    assert.strictEqual(flags.repoPath, '/repos/my-app');
    assert.strictEqual(flags.repoName, 'my-app');
    assert.strictEqual(flags.agent, 'cursor');
    assert.strictEqual(flags.force, true);
    assert.strictEqual(flags.json, true);
  });

  test('parseInitFlags falls back to opencode for unknown agent', () => {
    const flags = parseInitFlags(['node', 'agent-detective', 'init', '--agent', 'unknown-bot']);
    assert.strictEqual(flags.agent, 'opencode');
  });

  test('buildInitLocalConfig produces mock-first-run shape', () => {
    const config = buildInitLocalConfig({
      repoPath: '/data/checkout',
      repoName: 'symfony',
      agent: 'opencode',
      force: false,
    });

    assert.strictEqual(config.port, 3001);
    assert.strictEqual(config.agent, 'opencode');
    const plugins = config.plugins as Array<{ package: string; options: Record<string, unknown> }>;
    const localRepos = plugins.find((p) => p.package === '@agent-detective/local-repos-plugin');
    const jira = plugins.find((p) => p.package === '@agent-detective/jira-adapter');
    assert.ok(localRepos);
    assert.ok(jira);
    const repos = (localRepos!.options.repos as Array<{ name: string; path: string }>);
    assert.strictEqual(repos[0]?.name, 'symfony');
    assert.strictEqual(repos[0]?.path, '/data/checkout');
    assert.strictEqual(jira!.options.mockMode, true);
    assert.strictEqual(jira!.options.enabled, true);
  });

  test('buildInitLocalConfig passes Zod validation when loaded', () => {
    const dir = mkdtempSync(join(tmpdir(), 'init-cfg-'));
    const body = buildInitLocalConfig({
      repoPath: dir,
      repoName: 'symfony',
      agent: 'opencode',
      force: false,
    });
    writeFileSync(join(dir, 'local.json'), JSON.stringify(body));

    const cfg = loadConfig({ configRoot: dir });
    assert.strictEqual(cfg.agent, 'opencode');
    assert.strictEqual(cfg.port, 3001);
  });

  test('runInit writes local.json and refuses overwrite without --force', async () => {
    const root = mkdtempSync(join(tmpdir(), 'init-run-'));
    const configDir = join(root, 'config');
    const localPath = join(configDir, 'local.json');

    await runInit({
      installRoot: root,
      argv: ['node', 'agent-detective', 'init', '--repo-name', 'symfony', '--repo-path', root],
    });
    assert.strictEqual(process.exitCode, 0);
    assert.ok(existsSync(localPath));
    const first = JSON.parse(readFileSync(localPath, 'utf8')) as { agent: string };
    assert.strictEqual(first.agent, 'opencode');

    process.exitCode = 0;
    await runInit({
      installRoot: root,
      argv: ['node', 'agent-detective', 'init', '--repo-name', 'other'],
    });
    assert.strictEqual(process.exitCode, 1);
    const still = JSON.parse(readFileSync(localPath, 'utf8')) as { agent: string };
    assert.strictEqual(still.agent, 'opencode');
  });
});
