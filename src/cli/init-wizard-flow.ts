import { listAgentModels } from '../agents/list-models.js';
import { formatReviewBox, WIZARD_INTRO, WIZARD_OUTRO } from './init-ui.js';
import { WIZARD_STEP_COPY } from './init-wizard-copy.js';
import {
  defaultPrompter,
  promptSelect,
  type InitWizardPrompter,
} from './init-wizard-prompter.js';
import {
  runAdvancedStep,
  runAgentStep,
  runIntegrationStep,
  runRepoStep,
  runServerStep,
  runSetupStep,
  abortWizardFromReview,
  type WizardStepContext,
} from './init-wizard-steps.js';
import {
  createWizardState,
  toInitOptions,
  type ReviewAction,
  type WizardSectionId,
  type WizardState,
} from './init-wizard-state.js';
import type { InitOptions } from './init-types.js';

export type InitWizardResult = {
  options: InitOptions;
  installRoot: string;
};

export type RunInitWizardOptions = {
  installRoot?: string;
  prompter?: InitWizardPrompter;
  isTTY?: boolean;
  listAgentModels?: (agentId: string) => Promise<string[] | null>;
};

function createContext(
  state: WizardState,
  prompter: InitWizardPrompter,
  isTTY: boolean,
  resolveModels: (agentId: string) => Promise<string[] | null>,
): WizardStepContext {
  return { prompter, state, isTTY, listAgentModels: resolveModels };
}

async function runSection(
  sectionId: WizardSectionId,
  ctx: WizardStepContext,
): Promise<void> {
  switch (sectionId) {
    case 'setup':
      await runSetupStep(ctx);
      break;
    case 'agent':
      await runAgentStep(ctx);
      break;
    case 'repo':
      await runRepoStep(ctx);
      break;
    case 'server':
      await runServerStep(ctx);
      break;
    case 'integration':
      await runIntegrationStep(ctx);
      break;
    case 'advanced':
      await runAdvancedStep(ctx);
      break;
  }
}

async function runAllSections(ctx: WizardStepContext): Promise<void> {
  await runSection('setup', ctx);
  await runSection('agent', ctx);
  await runSection('repo', ctx);
  await runSection('server', ctx);
  await runSection('integration', ctx);
  await runSection('advanced', ctx);
}

function reviewActionToSection(action: ReviewAction): WizardSectionId | null {
  switch (action) {
    case 'edit-setup':
      return 'setup';
    case 'edit-agent':
      return 'agent';
    case 'edit-repo':
      return 'repo';
    case 'edit-server':
      return 'server';
    case 'edit-integration':
      return 'integration';
    case 'edit-advanced':
      return 'advanced';
    default:
      return null;
  }
}

async function runReviewLoop(ctx: WizardStepContext): Promise<void> {
  const reviewCopy = WIZARD_STEP_COPY.review;

  for (;;) {
    ctx.prompter.box(formatReviewBox(ctx.state), 'Review');

    const options: Array<{ value: ReviewAction; label: string; hint?: string }> = [
      { value: 'write', label: 'Write config/local.json', hint: 'Finish setup' },
      { value: 'edit-setup', label: 'Edit setup (install directory)' },
      { value: 'edit-agent', label: 'Edit agent & model' },
      { value: 'edit-repo', label: 'Edit repository' },
      { value: 'edit-server', label: 'Edit server port' },
      { value: 'edit-integration', label: 'Edit issue tracker & webhooks' },
    ];

    if (ctx.state.advancedVisited || ctx.state.advancedConfigured) {
      options.push({ value: 'edit-advanced', label: 'Edit advanced options' });
    }

    options.push({ value: 'cancel', label: 'Cancel without saving' });

    const action = await promptSelect<ReviewAction>(ctx.prompter, {
      message: reviewCopy.message,
      options,
      initialValue: 'write',
    });

    if (action === 'write') {
      return;
    }
    if (action === 'cancel') {
      abortWizardFromReview(ctx.prompter);
    }

    const section = reviewActionToSection(action);
    if (section) {
      await runSection(section, ctx);
    }
  }
}

export async function runInitWizard({
  installRoot,
  prompter = defaultPrompter(),
  isTTY = process.stdout.isTTY ?? false,
  listAgentModels: resolveModels = listAgentModels,
}: RunInitWizardOptions = {}): Promise<InitWizardResult> {
  const cwd = installRoot ?? process.cwd();
  const state = createWizardState(cwd);
  const ctx = createContext(state, prompter, isTTY, resolveModels);

  prompter.intro(WIZARD_INTRO);
  await runAllSections(ctx);
  await runReviewLoop(ctx);

  prompter.log.success(WIZARD_OUTRO);
  prompter.outro('Ready to start Agent Detective.');

  return {
    options: toInitOptions(state),
    installRoot: state.installRoot,
  };
}
