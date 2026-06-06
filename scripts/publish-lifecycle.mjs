#!/usr/bin/env node
/**
 * Root package lifecycle for npm installs.
 * Published tarball only ships dist/ + this script — dev-only hooks no-op for end users.
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const event = process.env.npm_lifecycle_event;

function runNodeScript(rel) {
  const script = path.join(root, rel);
  if (!existsSync(script)) return;
  execFileSync(process.execPath, [script], { cwd: root, stdio: 'inherit' });
}

if (event === 'postinstall') {
  runNodeScript('scripts/sync-cursor-from-agents.mjs');
}

if (event === 'prepare') {
  const huskyBin = path.join(root, 'node_modules', 'husky', 'bin.js');
  if (existsSync(path.join(root, '.git')) && existsSync(huskyBin)) {
    execFileSync(process.execPath, [huskyBin], { cwd: root, stdio: 'inherit' });
  }
}
