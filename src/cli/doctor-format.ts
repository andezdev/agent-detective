import type { DoctorCheck } from './doctor-checks.js';

const SECTION_ORDER = [
  'Configuration',
  'Agent',
  'Plugins',
  'Repositories',
  'Issue trackers',
  'Server',
  'Other',
] as const;

type DoctorSection = (typeof SECTION_ORDER)[number];

export type DoctorReportOptions = {
  ok: boolean;
  configRootUsed: string;
  checks: DoctorCheck[];
  verbose: boolean;
};

function sectionForCheck(id: string): DoctorSection {
  if (id.startsWith('config.')) return 'Configuration';
  if (id.startsWith('agent.')) return 'Agent';
  if (id.startsWith('plugin.')) return 'Plugins';
  if (id.startsWith('repos.')) return 'Repositories';
  if (id.startsWith('tracker.')) return 'Issue trackers';
  if (id.startsWith('server.')) return 'Server';
  return 'Other';
}

function titleForCheck(check: DoctorCheck): string {
  const { id, message } = check;
  const titles: Record<string, string> = {
    'config.files': 'Config files',
    'config.load': 'Schema validation',
    'agent.installed': 'Agent CLI',
    'repos.configured': 'Repo list',
    'tracker.jira.credentials': 'Jira',
    'tracker.linear.credentials': 'Linear',
    'server.port': 'Listen port',
  };
  if (titles[id]) return titles[id]!;

  const repoPath = id.match(/^repos\.path\.(.+)$/);
  if (repoPath) return repoPath[1]!;
  const repoGit = id.match(/^repos\.git\.(.+)$/);
  if (repoGit) return repoGit[1]!;

  if (id.startsWith('plugin.')) {
    const okMatch = message.match(/^Plugin OK: (.+)$/);
    if (okMatch) return okMatch[1]!;
    const failMatch = message.match(/^Plugin failed \(([^)]+)\):/);
    if (failMatch) return failMatch[1]!;
  }

  return id;
}

function summaryForCheck(check: DoctorCheck): string {
  const { id, message } = check;

  if (id === 'config.files') {
    return check.ok ? 'default.json and/or local.json present' : message;
  }
  if (id === 'config.load') {
    return check.ok ? 'valid' : message.replace(/^Config failed to load\/validate: /, '');
  }
  if (id === 'agent.installed') {
    const agent = message.match(/Agent '([^']+)'/)?.[1];
    return check.ok ? `${agent ?? 'agent'} on PATH` : message;
  }
  if (id === 'repos.configured') {
    const count = message.match(/^(\d+)/)?.[1];
    return check.ok ? `${count ?? '0'} configured` : message;
  }
  if (id.startsWith('repos.path.') && check.ok) {
    const path = (check.details?.absolutePath as string | undefined) ?? message.replace(/^Repo '[^']+' OK \(/, '').replace(/\)$/, '');
    return path;
  }
  if (id.startsWith('repos.git.')) {
    return message.replace(/^Repo '[^']+' /, '');
  }
  if (id.startsWith('plugin.') && check.ok) {
    return 'loads and validates';
  }
  if (id.startsWith('plugin.') && !check.ok) {
    return message.replace(/^Plugin failed \([^)]+\): /, '');
  }
  if (id === 'tracker.jira.credentials') {
    if (check.ok && message.includes('mock')) return 'mock mode';
    if (check.ok && message.includes('disabled')) return 'disabled';
    if (check.ok) return 'credentials configured';
    return message;
  }
  if (id === 'tracker.linear.credentials') {
    if (check.ok && message.includes('mock')) return 'mock mode';
    if (check.ok && message.includes('disabled')) return 'disabled';
    if (check.ok) return 'credentials configured';
    return message;
  }
  if (id === 'server.port') {
    if (message.includes('available')) return 'free';
    if (message.includes('appears to be running')) return 'in use (this app)';
    return message;
  }

  return message;
}

function formatDetailLines(details: Record<string, unknown>, indent: string): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${indent}${key}: ${value.join(', ')}`);
      continue;
    }
    if (typeof value === 'object') {
      lines.push(`${indent}${key}: ${JSON.stringify(value)}`);
      continue;
    }
    lines.push(`${indent}${key}: ${String(value)}`);
  }
  return lines;
}

function groupChecks(checks: DoctorCheck[]): Map<DoctorSection, DoctorCheck[]> {
  const groups = new Map<DoctorSection, DoctorCheck[]>();
  for (const check of checks) {
    const section = sectionForCheck(check.id);
    const list = groups.get(section) ?? [];
    list.push(check);
    groups.set(section, list);
  }
  return groups;
}

function padStatus(ok: boolean): string {
  return ok ? 'ok  ' : 'FAIL';
}

function checksForDisplay(checks: DoctorCheck[], configRootUsed: string): DoctorCheck[] {
  const hasRepoPaths = checks.some((c) => c.id.startsWith('repos.path.') || c.id.startsWith('repos.git.'));
  return checks
    .filter((c) => !(hasRepoPaths && c.id === 'repos.configured'))
    .map((c) => {
      if (!c.details?.configRootUsed || c.details.configRootUsed === configRootUsed) {
        const { configRootUsed: _drop, ...rest } = c.details ?? {};
        const details = Object.keys(rest).length > 0 ? rest : undefined;
        return details ? { ...c, details } : { ...c, details: undefined };
      }
      return c;
    });
}

export function formatDoctorReport(options: DoctorReportOptions): string {
  const { ok, configRootUsed, verbose } = options;
  const checks = checksForDisplay(options.checks, configRootUsed);
  const passed = checks.filter((c) => c.ok).length;
  const lines: string[] = [
    `agent-detective doctor: ${ok ? 'OK' : 'FAILED'} (${passed}/${checks.length} checks)`,
    `Config root: ${configRootUsed}`,
    '',
  ];

  const groups = groupChecks(checks);
  for (const section of SECTION_ORDER) {
    const sectionChecks = groups.get(section);
    if (!sectionChecks || sectionChecks.length === 0) continue;

    const sectionPassed = sectionChecks.filter((c) => c.ok).length;
    const header =
      section === 'Plugins'
        ? `${section} (${sectionPassed}/${sectionChecks.length})`
        : section;
    lines.push(header);

    for (const check of sectionChecks) {
      const title = titleForCheck(check);
      const summary = summaryForCheck(check);
      const singleLineOkPlugin = check.ok && check.id.startsWith('plugin.');
      if (singleLineOkPlugin) {
        lines.push(`  ${padStatus(check.ok)}  ${title}`);
      } else {
        lines.push(`  ${padStatus(check.ok)}  ${title}`);
        lines.push(`        ${summary}`);
      }
      if (verbose && check.details && Object.keys(check.details).length > 0) {
        lines.push(...formatDetailLines(check.details, '          '));
      }
    }

    lines.push('');
  }

  while (lines.at(-1) === '') {
    lines.pop();
  }

  return lines.join('\n');
}
