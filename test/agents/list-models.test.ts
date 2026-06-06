import { describe, test } from 'node:test';
import assert from 'node:assert';
import cursorAgent from '../../src/agents/cursor.js';
import { CLAUDE_MODEL_ALIASES, listAgentModels } from '../../src/agents/list-models.js';

describe('listAgentModels', () => {
  test('returns Claude aliases without invoking the CLI', async () => {
    const models = await listAgentModels('claude');
    assert.deepStrictEqual(models, [...CLAUDE_MODEL_ALIASES]);
  });

  test('cursor parseModelList extracts model ids from CLI output', () => {
    const sample = `Available models

auto - Auto
composer-2.5-fast - Composer 2.5 Fast
gpt-5.3-codex - Codex 5.3
`;
    const parsed = cursorAgent.parseModelList!(sample)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    assert.deepStrictEqual(parsed, ['auto', 'composer-2.5-fast', 'gpt-5.3-codex']);
  });
});
