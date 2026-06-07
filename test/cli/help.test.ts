import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  formatCommandHelp,
  formatMainHelp,
  resolveHelpTopic,
} from '../../src/cli/help.js';

describe('CLI help', () => {
  test('formatMainHelp lists quick start and commands', () => {
    const text = formatMainHelp();
    assert.match(text, /Quick start/);
    assert.match(text, /agent-detective init/);
    assert.match(text, /agent-detective smoke/);
    assert.match(text, /help init \| doctor \| smoke/);
  });

  test('formatCommandHelp init mentions wizard and --yes', () => {
    const text = formatCommandHelp('init');
    assert.match(text, /guided wizard/);
    assert.match(text, /--yes/);
    assert.match(text, /config\/local\.json/);
  });

  test('formatCommandHelp smoke mentions fixture labels', () => {
    const text = formatCommandHelp('smoke');
    assert.match(text, /probando, symfony/);
    assert.match(text, /\[MOCK\] Added comment/);
  });

  test('resolveHelpTopic for subcommand --help', () => {
    assert.strictEqual(
      resolveHelpTopic(['node', 'agent-detective', 'init', '--help']),
      'init',
    );
    assert.strictEqual(
      resolveHelpTopic(['node', 'agent-detective', 'smoke', '-h']),
      'smoke',
    );
  });

  test('resolveHelpTopic for help <command>', () => {
    assert.strictEqual(
      resolveHelpTopic(['node', 'agent-detective', 'help', 'doctor']),
      'doctor',
    );
  });

  test('resolveHelpTopic returns main for bare --help', () => {
    assert.strictEqual(
      resolveHelpTopic(['node', 'agent-detective', '--help']),
      'main',
    );
    assert.strictEqual(
      resolveHelpTopic(['node', 'agent-detective', 'help']),
      'main',
    );
  });

  test('resolveHelpTopic returns undefined when not asking for help', () => {
    assert.strictEqual(
      resolveHelpTopic(['node', 'agent-detective', 'doctor']),
      undefined,
    );
  });
});
