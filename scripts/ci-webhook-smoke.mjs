#!/usr/bin/env node
/**
 * CI smoke: start dist/index.js with mock agent + mock Jira, POST issue_created fixture,
 * assert webhook queued and [MOCK] Added comment appears in server logs.
 *
 * Requires: pnpm run build && pnpm run build:app beforehand.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const distEntry = join(root, 'dist', 'index.js');
const fixturePath = join(root, 'fixtures', 'jira-issue-created.json');
const defaultConfigPath = join(root, 'config', 'default.json');
const WEBHOOK_PATH = '/plugins/agent-detective-jira-adapter/webhook/jira';

/** Mutable capture buffer for the spawned server process (stdout + stderr). */
let serverLog = '';

function fail(message) {
  console.error(`ci-webhook-smoke: ${message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function pickFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : undefined;
      probe.close((err) => {
        if (err) reject(err);
        else if (port) resolvePort(port);
        else reject(new Error('could not resolve ephemeral port'));
      });
    });
  });
}

function initGitRepo(repoPath) {
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'ci@agent-detective.test'], { cwd: repoPath, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'CI'], { cwd: repoPath, stdio: 'ignore' });
}

function writeCiConfig(installRoot, repoPath, port) {
  const configDir = join(installRoot, 'config');
  mkdirSync(configDir, { recursive: true });
  if (existsSync(defaultConfigPath)) {
    copyFileSync(defaultConfigPath, join(configDir, 'default.json'));
  }
  const local = {
    port,
    agent: 'opencode',
    agents: {
      opencode: { defaultModel: 'opencode/deepseek-v4-flash-free' },
    },
    plugins: [
      {
        package: '@agent-detective/local-repos-plugin',
        options: {
          repos: [
            {
              name: 'symfony',
              path: repoPath,
              description: 'CI smoke repo (label symfony)',
            },
          ],
        },
      },
      {
        package: '@agent-detective/jira-adapter',
        options: {
          enabled: true,
          mockMode: true,
          webhookBehavior: {
            defaults: { action: 'ignore', acknowledgmentMessage: 'Thanks — CI smoke.' },
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
        options: { enabled: false },
      },
    ],
  };
  writeFileSync(join(configDir, 'local.json'), `${JSON.stringify(local, null, 2)}\n`, 'utf8');
}

async function waitForServerReady(baseUrl, server, attempts = 45) {
  for (let i = 0; i < attempts; i++) {
    if (server.exitCode !== null) {
      fail(`server exited early with code ${server.exitCode}\n${serverLog.slice(-4000)}`);
    }
    if (/EADDRINUSE|address already in use/i.test(serverLog)) {
      fail(`server failed to bind listen port\n${serverLog.slice(-4000)}`);
    }
    if (/Server started|"listeningOn":\s*"http:\/\/localhost:\d+"/.test(serverLog)) {
      try {
        const res = await fetch(`${baseUrl}/api/health`);
        if (res.ok) {
          const body = await res.json();
          if (body && typeof body.status === 'string') return;
        }
      } catch {
        // still starting
      }
    }
    await sleep(1000);
  }
  fail(`server did not become ready at ${baseUrl}/api/health\n${serverLog.slice(-4000)}`);
}

async function waitForLogPattern(pattern, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    if (pattern.test(serverLog)) return;
    await sleep(500);
  }
  fail(`timed out waiting for log pattern ${pattern}\n${serverLog.slice(-4000)}`);
}

async function main() {
  if (!existsSync(distEntry)) {
    fail(`missing ${distEntry} — run pnpm run build:app first`);
  }
  if (!existsSync(fixturePath)) {
    fail(`missing fixture ${fixturePath}`);
  }

  const port = await pickFreePort();
  const installRoot = mkdtempSync(join(tmpdir(), 'ad-ci-smoke-'));
  const repoPath = join(installRoot, 'checkout');
  mkdirSync(repoPath, { recursive: true });
  initGitRepo(repoPath);
  writeCiConfig(installRoot, repoPath, port);

  serverLog = '';
  const server = spawn(process.execPath, [distEntry], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      AGENT_DETECTIVE_CONFIG_ROOT: installRoot,
      AGENT_DETECTIVE_MOCK_AGENT: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const capture = (chunk) => {
    serverLog += chunk.toString();
  };
  server.stdout.on('data', capture);
  server.stderr.on('data', capture);

  const baseUrl = `http://127.0.0.1:${port}`;
  const webhookUrl = `${baseUrl}${WEBHOOK_PATH}`;

  try {
    await waitForServerReady(baseUrl, server);
    console.log(`Server ready (${baseUrl})`);

    const body = readFileSync(fixturePath, 'utf8');
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const text = await res.text();
    console.log(`Webhook ${res.status} ${res.statusText}`);
    console.log(text);
    if (!res.ok) fail(`webhook returned ${res.status}`);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      fail('webhook response was not JSON');
    }
    if (parsed.status !== 'queued' || typeof parsed.taskId !== 'string') {
      fail(`unexpected webhook body: ${text}`);
    }

    await waitForLogPattern(/\[MOCK\] Added comment to KAN-4/);
    console.log('ci-webhook-smoke: OK (mock Jira comment logged)');
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolveDone) => {
      server.once('exit', () => resolveDone());
      setTimeout(() => {
        try {
          server.kill('SIGKILL');
        } catch {
          // ignore
        }
        resolveDone();
      }, 5000);
    });
  }
}

await main();
