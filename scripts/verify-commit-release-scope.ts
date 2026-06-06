#!/usr/bin/env node
/**
 * Reject feat/fix/perf/breaking commits when every staged file is docs or landing only.
 * Prevents accidental npm releases from a misleading Conventional Commit prefix.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DOC_ONLY_PATHS = [
  'docs/',
  'apps/docs/',
  'apps/landing/',
  '.github/workflows/docs-site.yml',
  'scripts/sync-starlight-content.mjs',
  'scripts/merge-landing-into-docs-dist.mjs',
  'README.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'AGENTS.md',
] as const;

const RELEASABLE_TYPES = new Set(['feat', 'fix', 'perf']);

export function isDocOnlyPath(file: string): boolean {
  return DOC_ONLY_PATHS.some((prefix) => file === prefix || file.startsWith(prefix));
}

export function parseCommitType(subject: string): string | undefined {
  const match = subject.match(/^(\w+)(?:\([^)]*\))?!?:\s/);
  return match?.[1]?.toLowerCase();
}

export function isBreakingChange(message: string): boolean {
  const lower = message.toLowerCase();
  return /^(\w+)(?:\([^)]*\))!:/m.test(message) || lower.includes('breaking change');
}

export function verifyCommitReleaseScope(
  subject: string,
  message: string,
  files: readonly string[],
): string | undefined {
  if (!subject || subject.startsWith('Merge ')) return undefined;
  if (files.length === 0) return undefined;

  const type = parseCommitType(subject);
  const releasable =
    isBreakingChange(message) || (type !== undefined && RELEASABLE_TYPES.has(type));
  if (!releasable) return undefined;

  if (!files.every(isDocOnlyPath)) return undefined;

  const label = isBreakingChange(message) ? 'breaking change' : (type ?? 'releasable');
  return (
    `Commit "${label}" triggers an npm release, but every changed file is docs/landing only.\n` +
    'Use docs: or chore: instead (feat/fix/perf are for src/, packages/, test/, config runtime, etc.).'
  );
}

function main(): void {
  const msgFile = process.argv[2];
  if (!msgFile) return;

  const message = readFileSync(msgFile, 'utf8');
  const subject =
    message.split('\n').find((line) => line.trim() && !line.startsWith('#'))?.trim() ?? '';

  let files: string[] = [];
  try {
    files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return;
  }

  const error = verifyCommitReleaseScope(subject, message, files);
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`\n${error}\n`);
    process.exitCode = 1;
  }
}

const entry = process.argv[1];
if (entry && fileURLToPath(import.meta.url) === entry) {
  main();
}
