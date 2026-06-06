import * as clack from '@clack/prompts';

export type InitWizardSpinner = {
  start: (msg?: string) => void;
  stop: (msg?: string) => void;
  message: (msg?: string) => void;
};

export type InitWizardPrompter = {
  intro: (message: string) => void;
  outro: (message: string) => void;
  cancel: (message: string) => void;
  isCancel: (value: unknown) => value is symbol;
  text: (opts: {
    message: string;
    defaultValue?: string;
    placeholder?: string;
    validate?: (value: string | undefined) => string | Error | undefined;
  }) => Promise<string | symbol>;
  select: <T extends string>(opts: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
    initialValue?: T;
  }) => Promise<T | symbol>;
  confirm: (opts: {
    message: string;
    initialValue?: boolean;
  }) => Promise<boolean | symbol>;
  note: (message: string, title?: string) => void;
  path: (opts: {
    message: string;
    directory?: boolean;
    initialValue?: string;
    root?: string;
    validate?: (value: string | undefined) => string | Error | undefined;
  }) => Promise<string | symbol>;
  autocomplete: <T extends string>(opts: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
    initialValue?: T;
    placeholder?: string;
  }) => Promise<T | symbol>;
  spinner: () => InitWizardSpinner;
  log: {
    step: (message: string) => void;
    warn: (message: string) => void;
    success: (message: string) => void;
    info: (message: string) => void;
  };
  box: (message: string, title?: string) => void;
};

export function defaultPrompter(): InitWizardPrompter {
  return {
    intro: clack.intro,
    outro: clack.outro,
    cancel: clack.cancel,
    isCancel: clack.isCancel,
    text: clack.text as InitWizardPrompter['text'],
    select: clack.select as InitWizardPrompter['select'],
    confirm: clack.confirm,
    note: clack.note,
    path: clack.path as InitWizardPrompter['path'],
    autocomplete: clack.autocomplete as InitWizardPrompter['autocomplete'],
    spinner: () => {
      const s = clack.spinner();
      return {
        start: (msg) => s.start(msg),
        stop: (msg) => s.stop(msg),
        message: (msg) => s.message(msg),
      };
    },
    log: {
      step: (message) => clack.log.step(message),
      warn: (message) => clack.log.warn(message),
      success: (message) => clack.log.success(message),
      info: (message) => clack.log.info(message),
    },
    box: (message, title) => clack.box(message, title),
  };
}

export function abortWizard(prompter: InitWizardPrompter): never {
  prompter.cancel('Setup cancelled.');
  process.exit(1);
}

export async function promptText(
  prompter: InitWizardPrompter,
  opts: Parameters<InitWizardPrompter['text']>[0],
): Promise<string> {
  const value = await prompter.text(opts);
  if (prompter.isCancel(value)) abortWizard(prompter);
  return value as string;
}

export async function promptSelect<T extends string>(
  prompter: InitWizardPrompter,
  opts: Parameters<InitWizardPrompter['select']>[0],
): Promise<T> {
  const value = await prompter.select(opts);
  if (prompter.isCancel(value)) abortWizard(prompter);
  return value as T;
}

export async function promptConfirm(
  prompter: InitWizardPrompter,
  opts: Parameters<InitWizardPrompter['confirm']>[0],
): Promise<boolean> {
  const value = await prompter.confirm(opts);
  if (prompter.isCancel(value)) abortWizard(prompter);
  return value as boolean;
}

export async function promptPath(
  prompter: InitWizardPrompter,
  opts: Parameters<InitWizardPrompter['path']>[0],
): Promise<string> {
  const value = await prompter.path(opts);
  if (prompter.isCancel(value)) abortWizard(prompter);
  return value as string;
}

export async function promptAutocomplete<T extends string>(
  prompter: InitWizardPrompter,
  opts: Parameters<InitWizardPrompter['autocomplete']>[0],
): Promise<T> {
  const value = await prompter.autocomplete(opts);
  if (prompter.isCancel(value)) abortWizard(prompter);
  return value as T;
}

export function expandHomePath(value: string): string {
  const home = process.env.HOME ?? '';
  if (value === '~') return home;
  if (value.startsWith('~/')) return `${home}/${value.slice(2)}`;
  return value;
}

export function showSectionHeader(
  prompter: InitWizardPrompter,
  step: string,
  title: string,
): void {
  prompter.log.step(`${step} · ${title}`);
}

export function showStepNote(prompter: InitWizardPrompter, note: string | undefined): void {
  if (note) prompter.note(note);
}
