import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { isAgentInstalled, listAgents, normalizeAgent } from '../agents/index.js';
import { listAgentModels } from '../agents/list-models.js';
import { DEFAULT_ACK_MESSAGE, defaultModelForAgent } from './init-types.js';
import { WIZARD_STEP_COPY } from './init-wizard-copy.js';
import {
  abortWizard,
  expandHomePath,
  promptAutocomplete,
  promptConfirm,
  promptPath,
  promptSelect,
  promptText,
  showSectionHeader,
  showStepNote,
  type InitWizardPrompter,
} from './init-wizard-prompter.js';
import type { WizardState } from './init-wizard-state.js';
import type { InitRepo, IssueTracker } from './init-types.js';
import { agentInstallHint } from './init-ui.js';

const CUSTOM_MODEL_VALUE = '__custom__';
const MODEL_AUTOCOMPLETE_THRESHOLD = 8;

export type WizardStepContext = {
  prompter: InitWizardPrompter;
  state: WizardState;
  isTTY: boolean;
  listAgentModels: (agentId: string) => Promise<string[] | null>;
};

function sortModelsForSelect(models: string[], preferredDefault: string): string[] {
  const unique = [...new Set(models)];
  const rest = unique.filter((m) => m !== preferredDefault);
  return unique.includes(preferredDefault) ? [preferredDefault, ...rest] : [preferredDefault, ...unique];
}

export async function promptDefaultModel(
  prompter: InitWizardPrompter,
  agentId: string,
  resolveModels: (id: string) => Promise<string[] | null> = listAgentModels,
): Promise<string> {
  const copy = WIZARD_STEP_COPY.model;
  showStepNote(prompter, copy.note);

  const defaultModel = defaultModelForAgent(agentId);
  const spin = prompter.spinner();
  spin.start('Loading models from agent CLI…');
  const models = await resolveModels(agentId);
  spin.stop(models ? `Found ${models.length} model(s)` : 'Using manual entry');

  if (models && models.length > 0) {
    const sorted = sortModelsForSelect(models, defaultModel);
    const options = [
      ...sorted.map((model) => ({
        value: model,
        label: model,
        hint: model === defaultModel ? 'recommended default' : undefined,
      })),
      {
        value: CUSTOM_MODEL_VALUE,
        label: 'Other (enter manually)',
        hint: 'Use when your model is not listed',
      },
    ];

    const choice =
      sorted.length > MODEL_AUTOCOMPLETE_THRESHOLD
        ? await promptAutocomplete<string>(prompter, {
            message: copy.message,
            options,
            initialValue: sorted.includes(defaultModel) ? defaultModel : sorted[0],
            placeholder: 'Type to filter models…',
          })
        : await promptSelect<string>(prompter, {
            message: copy.message,
            options,
            initialValue: sorted.includes(defaultModel) ? defaultModel : sorted[0],
          });

    if (choice !== CUSTOM_MODEL_VALUE) {
      return choice;
    }
  } else if (!isAgentInstalled(agentId)) {
    const hint = agentInstallHint(agentId);
    prompter.log.warn(
      `${agentId} is not on PATH — enter a model id manually.${hint ? ` Install: ${hint}` : ''}`,
    );
  } else {
    prompter.log.warn('Could not load models from the agent CLI. Enter a model id manually.');
  }

  return promptText(prompter, {
    message: copy.message,
    defaultValue: defaultModel,
    validate: (value) => ((value ?? '').trim() ? undefined : 'Model is required'),
  });
}

async function promptRepoFields(
  ctx: WizardStepContext,
  label: string,
  defaultPath: string,
): Promise<InitRepo> {
  const pathCopy = WIZARD_STEP_COPY.repoPath;
  const labelCopy = WIZARD_STEP_COPY.repoLabel;

  showStepNote(ctx.prompter, pathCopy.note);
  const repoPathRaw = await promptPath(ctx.prompter, {
    message: `${label} — ${pathCopy.message}`,
    directory: true,
    initialValue: defaultPath,
    validate: (value) => {
      const trimmed = (value ?? '').trim();
      if (!trimmed) return 'Path is required';
      const resolved = resolve(expandHomePath(trimmed));
      if (!existsSync(resolved)) return `Path does not exist: ${resolved}`;
      return undefined;
    },
  });

  const resolvedPath = resolve(expandHomePath(repoPathRaw));
  if (!existsSync(resolve(resolvedPath, '.git'))) {
    ctx.prompter.log.warn('No .git directory found — analysis still works if this path is a valid checkout.');
  }

  const defaultName = basename(resolvedPath) || 'symfony';
  showStepNote(ctx.prompter, labelCopy.note);
  const repoName = await promptText(ctx.prompter, {
    message: `${label} — ${labelCopy.message}`,
    defaultValue: defaultName,
    validate: (value) => ((value ?? '').trim() ? undefined : 'Label name is required'),
  });

  return { path: resolvedPath, name: repoName.trim() };
}

export async function runSetupStep(ctx: WizardStepContext): Promise<void> {
  const copy = WIZARD_STEP_COPY.installDir;
  showSectionHeader(ctx.prompter, copy.sectionStep!, copy.sectionTitle!);
  showStepNote(ctx.prompter, copy.note);

  const answer = await promptText(ctx.prompter, {
    message: copy.message,
    defaultValue: ctx.state.installRoot,
    placeholder: copy.placeholder,
    validate: (value) => ((value ?? '').trim() ? undefined : 'Directory path is required'),
  });

  const resolved = resolve(expandHomePath(answer.trim()));
  if (!existsSync(resolved)) {
    ctx.prompter.log.info(`Directory does not exist yet — it will be created at ${resolved}/config/`);
  }
  ctx.state.installRoot = resolved;
}

export async function runAgentStep(ctx: WizardStepContext): Promise<void> {
  const copy = WIZARD_STEP_COPY.agent;
  showSectionHeader(ctx.prompter, copy.sectionStep!, copy.sectionTitle!);
  showStepNote(ctx.prompter, copy.note);

  const agentOptions = listAgents().map((agent) => {
    const installed = isAgentInstalled(agent.id);
    return {
      value: agent.id,
      label: `${agent.label} (${installed ? 'installed' : 'not on PATH'})`,
      hint: agentInstallHint(agent.id),
    };
  });

  const agent = await promptSelect<string>(ctx.prompter, {
    message: copy.message,
    options: agentOptions,
    initialValue: ctx.state.agent,
  });

  ctx.state.agent = normalizeAgent(agent);
  ctx.state.defaultModel = await promptDefaultModel(
    ctx.prompter,
    ctx.state.agent,
    ctx.listAgentModels,
  );
}

export async function runRepoStep(ctx: WizardStepContext): Promise<void> {
  const copy = WIZARD_STEP_COPY.repoPath;
  showSectionHeader(ctx.prompter, copy.sectionStep!, copy.sectionTitle!);

  const primary = await promptRepoFields(
    ctx,
    'Primary repository',
    ctx.state.repos[0]?.path ?? ctx.state.installRoot,
  );
  ctx.state.repos = [primary, ...ctx.state.repos.slice(1)];
}

export async function runServerStep(ctx: WizardStepContext): Promise<void> {
  const copy = WIZARD_STEP_COPY.port;
  showSectionHeader(ctx.prompter, copy.sectionStep!, copy.sectionTitle!);

  const portRaw = await promptText(ctx.prompter, {
    message: copy.message,
    defaultValue: String(ctx.state.port),
    validate: (value) => {
      const n = Number.parseInt(value ?? '', 10);
      if (!Number.isFinite(n) || n < 1 || n > 65535) return 'Enter a port between 1 and 65535';
      return undefined;
    },
  });
  ctx.state.port = Number.parseInt(portRaw, 10);
}

export async function runIntegrationStep(ctx: WizardStepContext): Promise<void> {
  const trackerCopy = WIZARD_STEP_COPY.issueTracker;
  showSectionHeader(ctx.prompter, trackerCopy.sectionStep!, trackerCopy.sectionTitle!);

  const issueTracker = await promptSelect<IssueTracker>(ctx.prompter, {
    message: trackerCopy.message,
    options: [
      {
        value: 'jira',
        label: 'Jira (mock mode by default)',
        hint: trackerCopy.jiraHint,
      },
      { value: 'linear', label: 'Linear', hint: trackerCopy.linearHint },
      {
        value: 'mock-only',
        label: 'Mock smoke only',
        hint: trackerCopy.mockOnlyHint,
      },
    ],
    initialValue: ctx.state.issueTracker,
  });
  ctx.state.issueTracker = issueTracker;

  if (issueTracker === 'jira') {
    const mockCopy = WIZARD_STEP_COPY.jiraMock;
    ctx.state.jiraMockMode = await promptConfirm(ctx.prompter, {
      message: `${mockCopy.message} (no real Jira API calls)`,
      initialValue: ctx.state.jiraMockMode,
    });
    if (!ctx.state.jiraMockMode) {
      const urlCopy = WIZARD_STEP_COPY.jiraBaseUrl;
      showStepNote(ctx.prompter, urlCopy.note);
      ctx.state.jiraBaseUrl = await promptText(ctx.prompter, {
        message: urlCopy.message,
        placeholder: urlCopy.placeholder,
        defaultValue: ctx.state.jiraBaseUrl,
        validate: (value) => {
          const trimmed = (value ?? '').trim();
          if (!trimmed) return 'Base URL is required for real Jira mode';
          try {
            new URL(trimmed);
            return undefined;
          } catch {
            return 'Enter a valid URL';
          }
        },
      });
      ctx.prompter.note(
        'Set JIRA_EMAIL and JIRA_API_TOKEN (or OAuth env vars) before starting the server. See docs/config/configuration.md.',
        'Environment variables',
      );
    } else {
      ctx.state.jiraBaseUrl = undefined;
    }
  } else if (issueTracker === 'linear') {
    const mockCopy = WIZARD_STEP_COPY.linearMock;
    ctx.state.linearMockMode = await promptConfirm(ctx.prompter, {
      message: `${mockCopy.message} (no real Linear API calls)`,
      initialValue: ctx.state.linearMockMode,
    });
    if (!ctx.state.linearMockMode) {
      ctx.prompter.note(
        'Set LINEAR_API_KEY and webhook signing secret via env before starting. See docs/config/configuration.md.',
        'Environment variables',
      );
    }
  } else {
    ctx.state.jiraMockMode = true;
    ctx.state.jiraBaseUrl = undefined;
  }

  const ackCopy = WIZARD_STEP_COPY.ackMessage;
  showStepNote(ctx.prompter, ackCopy.note);
  const ackMessage = await promptText(ctx.prompter, {
    message: ackCopy.message,
    defaultValue: ctx.state.acknowledgmentMessage || DEFAULT_ACK_MESSAGE,
  });
  ctx.state.acknowledgmentMessage = ackMessage.trim() || DEFAULT_ACK_MESSAGE;
}

export async function runAdvancedStep(ctx: WizardStepContext): Promise<void> {
  const advancedCopy = WIZARD_STEP_COPY.configureAdvanced;
  showSectionHeader(ctx.prompter, advancedCopy.sectionStep!, advancedCopy.sectionTitle!);
  showStepNote(ctx.prompter, advancedCopy.note);

  ctx.state.advancedVisited = true;
  const configureAdvanced = await promptConfirm(ctx.prompter, {
    message: advancedCopy.message,
    initialValue: ctx.state.advancedConfigured,
  });

  if (!configureAdvanced) {
    ctx.state.advancedConfigured = false;
    return;
  }

  ctx.state.advancedConfigured = true;

  const addCopy = WIZARD_STEP_COPY.addRepo;
  showStepNote(ctx.prompter, addCopy.note);
  let addAnother = await promptConfirm(ctx.prompter, {
    message: addCopy.message,
    initialValue: false,
  });
  while (addAnother) {
    const extra = await promptRepoFields(
      ctx,
      `Repository ${ctx.state.repos.length + 1}`,
      ctx.state.installRoot,
    );
    ctx.state.repos.push(extra);
    addAnother = await promptConfirm(ctx.prompter, {
      message: addCopy.message,
      initialValue: false,
    });
  }

  const failCopy = WIZARD_STEP_COPY.failOnMissing;
  ctx.state.failOnMissingRepos = await promptConfirm(ctx.prompter, {
    message: failCopy.message,
    initialValue: ctx.state.failOnMissingRepos,
  });

  const prCopy = WIZARD_STEP_COPY.prPipeline;
  showStepNote(ctx.prompter, prCopy.note);
  ctx.state.prPipelineEnabled = await promptConfirm(ctx.prompter, {
    message: prCopy.message,
    initialValue: ctx.state.prPipelineEnabled,
  });

  if (ctx.state.prPipelineEnabled) {
    const dryCopy = WIZARD_STEP_COPY.prDryRun;
    showStepNote(ctx.prompter, dryCopy.note);
    ctx.state.prDryRun = await promptConfirm(ctx.prompter, {
      message: dryCopy.message,
      initialValue: ctx.state.prDryRun,
    });
  }

  const logsCopy = WIZARD_STEP_COPY.prettyLogs;
  showStepNote(ctx.prompter, logsCopy.note);
  ctx.state.prettyLogs = await promptConfirm(ctx.prompter, {
    message: logsCopy.message,
    initialValue: ctx.isTTY ? ctx.state.prettyLogs || true : ctx.state.prettyLogs,
  });
}

export function abortWizardFromReview(prompter: InitWizardPrompter): never {
  abortWizard(prompter);
}
