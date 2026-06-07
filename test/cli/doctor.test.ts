import { describe, test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import type { AppConfig } from '../../src/config/schema.js';
import {
  buildLocalRepoChecks,
  buildTrackerCredentialChecks,
  isPortAvailable,
} from '../../src/cli/doctor-checks.js';

function configWithPlugins(plugins: AppConfig['plugins']): AppConfig {
  return { port: 3001, agent: 'opencode', plugins };
}

describe('doctor checks', () => {
  test('buildLocalRepoChecks reports missing repo path', () => {
    const checks = buildLocalRepoChecks(
      configWithPlugins([
        {
          package: '@agent-detective/local-repos-plugin',
          options: { repos: [{ name: 'symfony', path: '/path/does-not-exist' }] },
        },
      ]),
      '/tmp',
      false,
    );

    assert.ok(checks.some((c) => c.id === 'repos.configured' && c.ok));
    assert.ok(checks.some((c) => c.id === 'repos.path.symfony' && !c.ok));
  });

  test('buildLocalRepoChecks requires a git checkout', () => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-repo-'));
    const checks = buildLocalRepoChecks(
      configWithPlugins([
        {
          package: '@agent-detective/local-repos-plugin',
          options: { repos: [{ name: 'app', path: root }] },
        },
      ]),
      root,
      false,
    );

    assert.ok(checks.some((c) => c.id === 'repos.git.app' && !c.ok));

    mkdirSync(join(root, '.git'));
    const again = buildLocalRepoChecks(
      configWithPlugins([
        {
          package: '@agent-detective/local-repos-plugin',
          options: { repos: [{ name: 'app', path: root }] },
        },
      ]),
      root,
      false,
    );
    assert.ok(again.some((c) => c.id === 'repos.path.app' && c.ok));
  });

  test('buildLocalRepoChecks resolves relative repo paths from resolution root', () => {
    const root = mkdtempSync(join(tmpdir(), 'doctor-rel-'));
    const checkout = join(root, 'checkout');
    mkdirSync(checkout, { recursive: true });
    mkdirSync(join(checkout, '.git'));

    const checks = buildLocalRepoChecks(
      configWithPlugins([
        {
          package: '@agent-detective/local-repos-plugin',
          options: { repos: [{ name: 'app', path: 'checkout' }] },
        },
      ]),
      root,
      true,
    );

    const pass = checks.find((c) => c.id === 'repos.path.app');
    assert.ok(pass?.ok);
    assert.strictEqual(pass?.details?.absolutePath, checkout);
  });

  test('buildTrackerCredentialChecks passes for Jira mock mode', () => {
    const checks = buildTrackerCredentialChecks(
      configWithPlugins([
        {
          package: '@agent-detective/jira-adapter',
          options: { enabled: true, mockMode: true },
        },
      ]),
    );
    const jira = checks.find((c) => c.id === 'tracker.jira.credentials');
    assert.ok(jira?.ok);
    assert.match(jira!.message, /mock mode/i);
  });

  test('buildTrackerCredentialChecks fails for real Jira without credentials', () => {
    const checks = buildTrackerCredentialChecks(
      configWithPlugins([
        {
          package: '@agent-detective/jira-adapter',
          options: { enabled: true, mockMode: false, baseUrl: 'https://acme.atlassian.net' },
        },
      ]),
    );
    const jira = checks.find((c) => c.id === 'tracker.jira.credentials');
    assert.ok(jira);
    assert.strictEqual(jira!.ok, false);
    assert.match(jira!.message, /JIRA_EMAIL/);
  });

  test('buildTrackerCredentialChecks passes for Jira basic auth fields', () => {
    const checks = buildTrackerCredentialChecks(
      configWithPlugins([
        {
          package: '@agent-detective/jira-adapter',
          options: {
            enabled: true,
            mockMode: false,
            baseUrl: 'https://acme.atlassian.net',
            email: 'ops@example.com',
            apiToken: 'secret',
          },
        },
      ]),
    );
    assert.ok(checks.find((c) => c.id === 'tracker.jira.credentials')?.ok);
  });

  test('isPortAvailable finds a free ephemeral port', async () => {
    const port = await new Promise<number>((resolvePort, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        server.close(() => {
          if (!addr || typeof addr !== 'object') {
            reject(new Error('expected listening address'));
            return;
          }
          resolvePort(addr.port);
        });
      });
    });

    const available = await isPortAvailable(port, '127.0.0.1');
    assert.strictEqual(available, true);
  });
});
