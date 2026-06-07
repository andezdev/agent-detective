import { describe, test } from 'node:test';
import assert from 'node:assert';
import { formatDoctorReport } from '../../src/cli/doctor-format.js';
import type { DoctorCheck } from '../../src/cli/doctor-checks.js';

describe('doctor format', () => {
  test('formatDoctorReport groups checks into readable sections', () => {
    const checks: DoctorCheck[] = [
      { id: 'config.load', ok: true, message: 'Config loaded and validated' },
      { id: 'agent.installed', ok: true, message: "Agent 'opencode' is installed" },
      {
        id: 'plugin.0',
        ok: true,
        message: 'Plugin OK: @agent-detective/jira-adapter@0.1.0',
      },
      {
        id: 'repos.path.symfony',
        ok: true,
        message: "Repo 'symfony' OK (/data/symfony)",
        details: { absolutePath: '/data/symfony' },
      },
      {
        id: 'tracker.jira.credentials',
        ok: true,
        message: 'Jira mock mode (no API credentials required)',
      },
      {
        id: 'server.port',
        ok: true,
        message: 'Port 3001 in use — agent-detective appears to be running',
      },
    ];

    const text = formatDoctorReport({
      ok: true,
      configRootUsed: '/tmp/ad/config',
      checks,
      verbose: false,
    });

    assert.match(text, /doctor: OK \(6\/6 checks\)/);
    assert.match(text, /Configuration/);
    assert.match(text, /Agent/);
    assert.match(text, /Plugins \(1\/1\)/);
    assert.match(text, /Repositories/);
    assert.match(text, /symfony/);
    assert.match(text, /Issue trackers/);
    assert.match(text, /in use \(this app\)/);
    assert.doesNotMatch(text, /plugin\.0/);
    assert.doesNotMatch(text, /details:/);
  });

  test('formatDoctorReport prints verbose details as indented lines', () => {
    const text = formatDoctorReport({
      ok: true,
      configRootUsed: '/tmp/ad/config',
      checks: [
        {
          id: 'repos.path.symfony',
          ok: true,
          message: "Repo 'symfony' OK (/data/symfony)",
          details: { configuredPath: '/data/symfony', absolutePath: '/data/symfony' },
        },
      ],
      verbose: true,
    });

    assert.match(text, /configuredPath: \/data\/symfony/);
    assert.doesNotMatch(text, /\{"configuredPath"/);
  });

  test('formatDoctorReport highlights failures', () => {
    const text = formatDoctorReport({
      ok: false,
      configRootUsed: '/tmp/ad/config',
      checks: [
        {
          id: 'agent.installed',
          ok: false,
          message: "Agent 'cursor' is not installed or not on PATH",
        },
      ],
      verbose: false,
    });

    assert.match(text, /doctor: FAILED/);
    assert.match(text, /FAIL  Agent CLI/);
    assert.match(text, /not installed or not on PATH/);
  });
});
