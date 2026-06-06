import { execLocal } from '../core/process.js';
import { getAgent, isAgentInstalled } from './index.js';

/** Claude CLI aliases when dynamic listing is unavailable. */
export const CLAUDE_MODEL_ALIASES = ['sonnet', 'opus', 'haiku'] as const;

const LIST_MODELS_TIMEOUT_MS = 15_000;

export async function listAgentModels(agentId: string): Promise<string[] | null> {
  if (agentId === 'claude') {
    return [...CLAUDE_MODEL_ALIASES];
  }

  if (!isAgentInstalled(agentId)) return null;

  const agent = getAgent(agentId);
  if (!agent) return null;

  if (agent.listModelsCommand && agent.parseModelList) {
    try {
      const output = await execLocal('bash', ['-lc', agent.listModelsCommand()], {
        timeout: LIST_MODELS_TIMEOUT_MS,
      });
      const models = agent
        .parseModelList(output)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return models.length > 0 ? models : null;
    } catch {
      return null;
    }
  }

  return null;
}
