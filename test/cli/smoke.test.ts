import { describe, test } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  JIRA_WEBHOOK_PATH,
  readSmokeFixtureBody,
  resolvePackagedSmokeFixturePath,
  resolveSmokeWebhookUrl,
} from '../../src/cli/smoke.js';

describe('smoke CLI', () => {
  test('resolvePackagedSmokeFixturePath finds fixtures/jira-issue-created.json', () => {
    const path = resolvePackagedSmokeFixturePath();
    assert.ok(path);
    assert.ok(existsSync(path!));
  });

  test('readSmokeFixtureBody returns Jira issue_created JSON', () => {
    const body = readSmokeFixtureBody();
    const parsed = JSON.parse(body) as { webhookEvent: string; issue: { fields: { labels: string[] } } };
    assert.strictEqual(parsed.webhookEvent, 'jira:issue_created');
    assert.ok(parsed.issue.fields.labels.includes('probando'));
  });

  test('resolveSmokeWebhookUrl uses config port and default host', () => {
    const root = mkdtempSync(join(tmpdir(), 'smoke-url-'));
    const configDir = join(root, 'config');
    mkdirSync(configDir);
    writeFileSync(
      join(configDir, 'local.json'),
      JSON.stringify({ port: 4000, agent: 'opencode', plugins: [] }),
    );

    const url = resolveSmokeWebhookUrl({ installRoot: root });
    assert.strictEqual(url, `http://127.0.0.1:4000${JIRA_WEBHOOK_PATH}`);
  });

  test('resolveSmokeWebhookUrl respects --url override via explicit url option', () => {
    const custom = 'http://localhost:9999/custom/webhook';
    assert.strictEqual(resolveSmokeWebhookUrl({ url: custom }), custom);
  });

  test('resolveSmokeWebhookUrl respects JIRA_WEBHOOK_URL env', () => {
    const prev = process.env.JIRA_WEBHOOK_URL;
    process.env.JIRA_WEBHOOK_URL = 'http://example.test/webhook';
    try {
      assert.strictEqual(resolveSmokeWebhookUrl({}), 'http://example.test/webhook');
    } finally {
      if (prev === undefined) delete process.env.JIRA_WEBHOOK_URL;
      else process.env.JIRA_WEBHOOK_URL = prev;
    }
  });
});
