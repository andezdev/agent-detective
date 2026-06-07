import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import type { AppConfig } from '../config/schema.js';

export type DoctorCheck = {
  id: string;
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
};

const LOCAL_REPOS_PACKAGE = '@agent-detective/local-repos-plugin';
const JIRA_PACKAGE = '@agent-detective/jira-adapter';
const LINEAR_PACKAGE = '@agent-detective/linear-adapter';

type RepoEntry = { name: string; path: string };

function getPluginOptions(config: AppConfig, packageName: string): Record<string, unknown> | undefined {
  const entry = config.plugins?.find((p) => p.package === packageName);
  if (!entry?.options || typeof entry.options !== 'object') return undefined;
  return entry.options as Record<string, unknown>;
}

function resolveRepoPath(pathValue: string, resolutionRoot: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(resolutionRoot, pathValue);
}

function isGitCheckout(dir: string): boolean {
  return existsSync(join(dir, '.git'));
}

function parseRepos(options: Record<string, unknown> | undefined): RepoEntry[] {
  if (!options || !Array.isArray(options.repos)) return [];
  const repos: RepoEntry[] = [];
  for (const item of options.repos) {
    if (!item || typeof item !== 'object') continue;
    const name = (item as { name?: unknown }).name;
    const path = (item as { path?: unknown }).path;
    if (typeof name === 'string' && typeof path === 'string') {
      repos.push({ name, path });
    }
  }
  return repos;
}

export function buildLocalRepoChecks(
  config: AppConfig,
  resolutionRoot: string,
  verbose: boolean,
): DoctorCheck[] {
  const options = getPluginOptions(config, LOCAL_REPOS_PACKAGE);
  const repos = parseRepos(options);
  if (repos.length === 0) {
    return [
      {
        id: 'repos.configured',
        ok: false,
        message: 'No local repos configured under @agent-detective/local-repos-plugin',
      },
    ];
  }

  const checks: DoctorCheck[] = [
    {
      id: 'repos.configured',
      ok: true,
      message: `${repos.length} local repo(s) configured`,
      details: verbose ? { names: repos.map((r) => r.name) } : undefined,
    },
  ];

  for (const repo of repos) {
    const absolutePath = resolveRepoPath(repo.path, resolutionRoot);
    const pathExists = existsSync(absolutePath);
    const gitOk = pathExists && isGitCheckout(absolutePath);

    if (!pathExists) {
      checks.push({
        id: `repos.path.${repo.name}`,
        ok: false,
        message: `Repo '${repo.name}' path does not exist: ${absolutePath}`,
        details: verbose ? { configuredPath: repo.path, resolutionRoot } : undefined,
      });
      continue;
    }

    if (!gitOk) {
      checks.push({
        id: `repos.git.${repo.name}`,
        ok: false,
        message: `Repo '${repo.name}' is not a git checkout (missing .git): ${absolutePath}`,
        details: verbose ? { configuredPath: repo.path } : undefined,
      });
      continue;
    }

    checks.push({
      id: `repos.path.${repo.name}`,
      ok: true,
      message: `Repo '${repo.name}' OK (${absolutePath})`,
      details: verbose ? { configuredPath: repo.path, absolutePath } : undefined,
    });
  }

  return checks;
}

export function isPortAvailable(port: number, host = '0.0.0.0'): Promise<boolean> {
  return new Promise((resolveAvailable) => {
    const server = createServer();
    server.once('error', () => resolveAvailable(false));
    server.once('listening', () => {
      server.close(() => resolveAvailable(true));
    });
    server.listen(port, host);
  });
}

async function probeAgentDetectiveHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: unknown };
    return typeof body.status === 'string';
  } catch {
    return false;
  }
}

export async function buildPortCheck(port: number): Promise<DoctorCheck> {
  const available = await isPortAvailable(port);
  if (available) {
    return {
      id: 'server.port',
      ok: true,
      message: `Port ${port} is available`,
    };
  }

  if (await probeAgentDetectiveHealth(port)) {
    return {
      id: 'server.port',
      ok: true,
      message: `Port ${port} in use — agent-detective appears to be running`,
    };
  }

  return {
    id: 'server.port',
    ok: false,
    message: `Port ${port} is already in use by another process`,
  };
}

function hasTrimmedString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildJiraCredentialCheck(options: Record<string, unknown> | undefined): DoctorCheck {
  if (options?.enabled === false) {
    return { id: 'tracker.jira.credentials', ok: true, message: 'Jira adapter disabled' };
  }
  if (options?.mockMode !== false) {
    return {
      id: 'tracker.jira.credentials',
      ok: true,
      message: 'Jira mock mode (no API credentials required)',
    };
  }

  const oauthReady =
    hasTrimmedString(options?.oauthClientId) &&
    hasTrimmedString(options?.oauthClientSecret) &&
    hasTrimmedString(options?.oauthRefreshToken);

  if (oauthReady) {
    if (!hasTrimmedString(options?.cloudId)) {
      return {
        id: 'tracker.jira.credentials',
        ok: false,
        message: 'Jira OAuth configured but cloudId is missing (set JIRA_CLOUD_ID or cloudId in config)',
      };
    }
    return {
      id: 'tracker.jira.credentials',
      ok: true,
      message: 'Jira OAuth credentials present',
    };
  }

  const missing: string[] = [];
  if (!hasTrimmedString(options?.baseUrl)) missing.push('JIRA_BASE_URL or baseUrl');
  if (!hasTrimmedString(options?.email)) missing.push('JIRA_EMAIL or email');
  if (!hasTrimmedString(options?.apiToken)) missing.push('JIRA_API_TOKEN or apiToken');

  if (missing.length > 0) {
    return {
      id: 'tracker.jira.credentials',
      ok: false,
      message: `Jira real mode missing credentials: ${missing.join(', ')}`,
      details: { missing },
    };
  }

  return {
    id: 'tracker.jira.credentials',
    ok: true,
    message: 'Jira Basic auth credentials present',
  };
}

function buildLinearCredentialCheck(options: Record<string, unknown> | undefined): DoctorCheck {
  if (options?.enabled !== true) {
    return { id: 'tracker.linear.credentials', ok: true, message: 'Linear adapter disabled' };
  }
  if (options?.mockMode !== false) {
    return {
      id: 'tracker.linear.credentials',
      ok: true,
      message: 'Linear mock mode (no API credentials required)',
    };
  }

  const oauthReady =
    hasTrimmedString(options?.oauthClientId) &&
    hasTrimmedString(options?.oauthClientSecret) &&
    hasTrimmedString(options?.oauthRefreshToken);

  if (oauthReady || hasTrimmedString(options?.apiKey)) {
    return {
      id: 'tracker.linear.credentials',
      ok: true,
      message: oauthReady ? 'Linear OAuth credentials present' : 'Linear API key present',
    };
  }

  return {
    id: 'tracker.linear.credentials',
    ok: false,
    message:
      'Linear real mode missing credentials: set LINEAR_API_KEY or OAuth client id, secret, and refresh token',
    details: { missing: ['LINEAR_API_KEY or LINEAR_OAUTH_*'] },
  };
}

export function buildTrackerCredentialChecks(config: AppConfig): DoctorCheck[] {
  return [
    buildJiraCredentialCheck(getPluginOptions(config, JIRA_PACKAGE)),
    buildLinearCredentialCheck(getPluginOptions(config, LINEAR_PACKAGE)),
  ];
}
