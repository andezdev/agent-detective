import { shellQuote, resolvePromptValue, isCommandAvailable } from './utils.js';
import type { Agent, AgentOutput } from '../core/types.js';

const CURSOR_AGENT_CMD = 'agent';
const OUTPUT_FORMAT = 'json';
const DEFAULT_MODEL = 'composer-2.5-fast';

function safeJsonParse(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildCommand({
  prompt,
  promptExpression,
  threadId,
  model,
  readOnly,
}: {
  prompt: string;
  promptExpression: string;
  threadId?: string;
  model?: string;
  readOnly?: boolean;
}): string {
  const promptValue = resolvePromptValue(prompt, promptExpression);
  const modelToUse = model || DEFAULT_MODEL;
  const args: string[] = [
    '--trust',
    '-p',
    promptValue,
    '--output-format',
    OUTPUT_FORMAT,
    '--model',
    shellQuote(modelToUse),
  ];
  if (readOnly) {
    args.push('--mode=ask');
  }
  if (threadId) {
    args.push('--resume', shellQuote(threadId));
  }
  return `${CURSOR_AGENT_CMD} ${args.join(' ')}`.trim();
}

function listModelsCommand(): string {
  return `${CURSOR_AGENT_CMD} models < /dev/null`;
}

function parseModelList(output: string): string {
  const lines = String(output || '').split(/\r?\n/);
  const models: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'Available models') continue;
    const idMatch = trimmed.match(/^(\S+)\s+-\s+/);
    if (idMatch) {
      models.push(idMatch[1]!);
      continue;
    }
    if (!/\s/.test(trimmed)) {
      models.push(trimmed);
    }
  }
  return models.join('\n');
}

function parseOutput(output: string): AgentOutput {
  const trimmed = String(output || '').trim();
  if (!trimmed) {
    return { text: '', threadId: undefined, sawJson: false };
  }
  const payload = safeJsonParse(trimmed);
  if (!payload || payload.type !== 'result') {
    return { text: trimmed, threadId: undefined, sawJson: false };
  }
  const result = payload.result;
  const sessionId = payload.session_id;
  const text = typeof result === 'string' ? result.trim() : '';
  const threadId = typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : undefined;
  return { text, threadId, sawJson: true };
}

const cursorAgent: Agent = {
  id: 'cursor',
  label: 'cursor',
  needsPty: false,
  mergeStderr: false,
  command: CURSOR_AGENT_CMD,
  buildCommand,
  parseOutput,
  listModelsCommand,
  parseModelList,
  defaultModel: DEFAULT_MODEL,
  checkAvailable: () => isCommandAvailable(CURSOR_AGENT_CMD),
};

export default cursorAgent;
