import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../server.js';

export const JIRA_WEBHOOK_PATH = '/plugins/agent-detective-jira-adapter/webhook/jira';

export function resolvePackagedSmokeFixturePath(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '..', 'fixtures', 'jira-issue-created.json'),
    resolve(here, '..', '..', 'fixtures', 'jira-issue-created.json'),
    resolve(
      here,
      '..',
      '..',
      'packages',
      'jira-adapter',
      'test',
      'fixtures',
      'issue-created.json',
    ),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function readSmokeFixtureBody(): string {
  const fixturePath = resolvePackagedSmokeFixturePath();
  if (!fixturePath) {
    throw new Error('Bundled Jira smoke fixture not found (fixtures/jira-issue-created.json)');
  }
  return readFileSync(fixturePath, 'utf8');
}

function resolveConfigDirFromInstallRoot(installRoot: string | undefined): string | undefined {
  if (!installRoot) return undefined;
  if (installRoot.split(/[\\/]/).pop() === 'config') return installRoot;
  return resolve(installRoot, 'config');
}

export function resolveSmokeWebhookUrl(options: {
  installRoot?: string;
  url?: string;
  host?: string;
}): string {
  if (options.url?.trim()) return options.url.trim();
  const fromEnv = process.env.JIRA_WEBHOOK_URL?.trim();
  if (fromEnv) return fromEnv;

  const configRoot = resolveConfigDirFromInstallRoot(options.installRoot);
  let port = 3001;
  try {
    const config = loadConfig({ configRoot });
    port = config.port ?? 3001;
  } catch {
    // defaults when config missing or invalid
  }

  const host = options.host?.trim() || process.env.AGENT_DETECTIVE_SMOKE_HOST?.trim() || '127.0.0.1';
  return `http://${host}:${port}${JIRA_WEBHOOK_PATH}`;
}

type RunSmokeOptions = {
  installRoot?: string;
  argv: string[];
};

function parseSmokeFlags(argv: string[]): {
  json: boolean;
  url?: string;
  host?: string;
} {
  const args = argv.slice(2).filter((a) => a !== 'smoke');
  let url: string | undefined;
  let host: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url') {
      url = args[i + 1];
      i++;
    } else if (a?.startsWith('--url=')) {
      url = a.slice('--url='.length);
    } else if (a === '--host') {
      host = args[i + 1];
      i++;
    } else if (a?.startsWith('--host=')) {
      host = a.slice('--host='.length);
    }
  }
  return { json: args.includes('--json'), url, host };
}

function connectionHint(installRoot: string | undefined): string {
  const rootFlag =
    installRoot && installRoot !== process.cwd() ? ` --config-root ${installRoot}` : '';
  return `Start the server in another terminal: agent-detective${rootFlag}`;
}

export async function runSmoke({ installRoot, argv }: RunSmokeOptions): Promise<void> {
  const { json, url, host } = parseSmokeFlags(argv);
  const webhookUrl = resolveSmokeWebhookUrl({ installRoot, url, host });

  let body: string;
  try {
    body = readSmokeFixtureBody();
  } catch (err) {
    const message = (err as Error).message;
    if (json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ok: false, error: message }, null, 2));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
    return;
  }

  let res: Response;
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
  const cause = err as NodeJS.ErrnoException;
  const refused =
    cause.code === 'ECONNREFUSED' ||
    String(cause.message).includes('ECONNREFUSED') ||
    (cause.cause instanceof Error && String(cause.cause.message).includes('ECONNREFUSED'));
    const message = refused
      ? `Could not connect to ${webhookUrl}. ${connectionHint(installRoot)}`
      : `Webhook request failed: ${(err as Error).message}`;
    if (json) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ok: false, error: message, url: webhookUrl }, null, 2));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
    return;
  }

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    // keep raw text
  }

  const ok = res.ok;
  if (json) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok,
          status: res.status,
          statusText: res.statusText,
          url: webhookUrl,
          body: parsed,
          hint: ok
            ? 'Check server logs for [MOCK] Added comment when mock analysis completes.'
            : undefined,
        },
        null,
        2,
      ),
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(`${res.status} ${res.statusText}`);
    // eslint-disable-next-line no-console
    console.log(text);
    if (ok) {
      // eslint-disable-next-line no-console
      console.log('\nCheck server logs for [MOCK] Added comment when mock analysis completes.');
    } else {
      console.error(`\nWebhook returned ${res.status}. Is mock Jira enabled and the server running?`);
    }
  }

  if (!ok) process.exitCode = 1;
}
