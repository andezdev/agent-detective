import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadConfig } from '../server.js';
import { createAgentRunner } from '../core/agent-runner.js';
import { execLocal, execLocalStreaming, terminateChildProcess } from '../core/process.js';
import { listAgents, normalizeAgent } from '../agents/index.js';
import {
  jiraAdapterOptionsSchema,
  createRealJiraClient,
  createMockJiraClient,
  stampComment,
  isOwnComment,
  hasTriggerPhrase,
  type JiraAdapterConfig,
  type JiraClient,
} from '@agent-detective/jira-adapter';
import {
  localReposPluginOptionsSchema,
  matchAllReposByLabels,
  buildRepoContext,
  formatRepoContextForPrompt,
  getDefaultAnalysisPrompt,
  formatTemplate,
  type ValidatedRepo,
} from '@agent-detective/local-repos-plugin';

const JIRA_KEY_REGEX = /^[A-Z][A-Z0-9_]+-\d+$/i;

type OutputMode = 'stdout' | 'file' | 'jira';

interface TriageFlags {
  issueInput: string;
  text?: string;
  repo?: string;
  output: OutputMode;
  outputPath: string;
  prompt?: string;
  verbose: boolean;
  json: boolean;
}

interface TriageResult {
  repo: string;
  text: string;
  usage?: { wallTimeMs: number };
  error?: string;
}

export function parseJiraKey(input: string): string {
  const trimmed = input.trim();

  if (JIRA_KEY_REGEX.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    const candidate = segments[segments.length - 1];
    if (candidate && JIRA_KEY_REGEX.test(candidate)) {
      return candidate.toUpperCase();
    }
  } catch {
    // not a URL, fall through
  }

  throw new Error(
    `Could not extract a Jira issue key from "${trimmed}". ` +
    `Expected "PROJ-123" or a Jira URL like "https://site.atlassian.net/browse/PROJ-123".`
  );
}

function parseTriageFlags(argv: string[]): TriageFlags {
  const args = argv.slice(2);
  let issueInput = '';
  let text: string | undefined;
  let repo: string | undefined;
  let output: OutputMode = 'stdout';
  let outputPath = './reports/';
  let prompt: string | undefined;
  let verbose = false;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === 'triage') continue;
    if (a === '--config-root') { i++; continue; }
    if (a.startsWith('--config-root=')) continue;

    if (a === '--text') { text = args[++i]; continue; }
    if (a.startsWith('--text=')) { text = a.slice('--text='.length); continue; }
    if (a === '--repo') { repo = args[++i]; continue; }
    if (a.startsWith('--repo=')) { repo = a.slice('--repo='.length); continue; }
    if (a === '--output') { output = (args[++i] ?? 'stdout') as OutputMode; continue; }
    if (a.startsWith('--output=')) { output = a.slice('--output='.length) as OutputMode; continue; }
    if (a === '--output-path') { outputPath = args[++i] ?? './reports/'; continue; }
    if (a.startsWith('--output-path=')) { outputPath = a.slice('--output-path='.length); continue; }
    if (a === '--prompt') { prompt = args[++i]; continue; }
    if (a.startsWith('--prompt=')) { prompt = a.slice('--prompt='.length); continue; }
    if (a === '--verbose') { verbose = true; continue; }
    if (a === '--json') { json = true; continue; }
    if (a === '-h' || a === '--help') continue;

    if (!a.startsWith('-') && !issueInput) {
      issueInput = a;
    }
  }

  if (!['stdout', 'file', 'jira'].includes(output)) {
    throw new Error(`Invalid --output "${output}". Must be one of: stdout, file, jira`);
  }

  return { issueInput, text, repo, output, outputPath, prompt, verbose, json };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

function resolveConfigDirFromInstallRoot(installRoot: string | undefined): string | undefined {
  if (!installRoot) return undefined;
  if (installRoot.split(/[\\/]/).pop() === 'config') return installRoot;
  return resolve(installRoot, 'config');
}

function findPluginOptions<T>(
  config: { plugins?: Array<{ package?: string; options?: Record<string, unknown> }> },
  packageName: string,
): T | null {
  const entry = config.plugins?.find((p) => p.package === packageName);
  return entry?.options as T | undefined ?? null;
}

function log(message: string, json: boolean): void {
  if (!json) process.stderr.write(`${message}\n`);
}

function outputJson(data: unknown): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(data, null, 2));
}

function fail(message: string, json: boolean): never {
  if (json) {
    outputJson({ ok: false, error: message });
  } else {
    process.stderr.write(`Error: ${message}\n`);
  }
  process.exitCode = 1;
  throw new Error(message);
}

export async function runTriage(options: { installRoot?: string; argv: string[] }): Promise<void> {
  let flags: TriageFlags;
  try {
    flags = parseTriageFlags(options.argv);
  } catch (err) {
    const message = (err as Error).message;
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return;
  }

  const { output, outputPath, prompt, verbose, json } = flags;

  // --- Detect text mode: --text flag, or stdin pipe ---
  if (!flags.text && !flags.issueInput && !process.stdin.isTTY) {
    flags.text = await readStdin();
  }

  const textMode = Boolean(flags.text);

  // --- Validate mode-specific constraints ---
  if (textMode && flags.issueInput) {
    fail('Cannot combine a Jira issue key with --text. Use one or the other.', json);
  }
  if (textMode && !flags.repo) {
    fail('--repo is required in text mode. Usage: agent-detective triage --text "..." --repo av-symf', json);
  }
  if (textMode && output === 'jira') {
    fail('--output jira is not available in text mode (no Jira ticket to comment on).', json);
  }
  if (!textMode && !flags.issueInput) {
    fail('Missing Jira issue key or URL. Usage: agent-detective triage PROJ-123', json);
  }

  // --- Load config ---
  const configRoot = resolveConfigDirFromInstallRoot(options.installRoot);
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig({ configRoot });
  } catch (err) {
    fail(`Failed to load config: ${(err as Error).message}. Run \`agent-detective init\` first or pass \`--config-root\`.`, json);
  }

  // --- Extract local-repos config (always needed) ---
  const rawReposOptions = findPluginOptions(config, '@agent-detective/local-repos-plugin');
  if (!rawReposOptions) {
    fail('No @agent-detective/local-repos-plugin found in config.', json);
  }
  const reposParsed = localReposPluginOptionsSchema.safeParse(rawReposOptions);
  if (!reposParsed.success) {
    fail(`Invalid local-repos config: ${JSON.stringify(reposParsed.error)}`, json);
  }
  const reposConfig = reposParsed.data;

  const validatedRepos: ValidatedRepo[] = reposConfig.repos.map((r) => ({
    name: r.name,
    path: r.path,
    exists: true,
    techStack: r.techStack ?? [],
    summary: r.description ?? '',
    commits: [],
    lastChecked: new Date(),
  }));

  // --- Resolve issue data and repos depending on mode ---
  let issueKey: string;
  let summary: string;
  let description: string;
  let labels: string[];
  let commentsContext = '';
  let repos: ValidatedRepo[];
  let jiraClient: JiraClient | null = null;
  let jiraConfig: JiraAdapterConfig | null = null;

  if (textMode) {
    // --- Text mode: description from --text/stdin, repo from --repo ---
    issueKey = 'text-triage';
    const fullText = flags.text!;
    const firstLine = fullText.split('\n')[0] ?? '';
    summary = firstLine.slice(0, 200);
    description = fullText;
    labels = [];

    const repoName = flags.repo!;
    const found = validatedRepos.find((r) => r.name.toLowerCase() === repoName.toLowerCase());
    if (!found) {
      const available = validatedRepos.map((r) => r.name).join(', ');
      fail(`Repo '${repoName}' not found in config. Available: [${available}].`, json);
    }
    repos = [found];

    log(`Triaging text against '${found.name}'...`, json);
  } else {
    // --- Jira mode: fetch from Jira, match by labels ---
    try {
      issueKey = parseJiraKey(flags.issueInput);
    } catch (err) {
      fail((err as Error).message, json);
    }

    log(`Triaging ${issueKey}...`, json);

    const rawJiraOptions = findPluginOptions(config, '@agent-detective/jira-adapter');
    if (!rawJiraOptions) {
      fail('No @agent-detective/jira-adapter plugin found in config.', json);
    }
    const jiraParsed = jiraAdapterOptionsSchema.safeParse(rawJiraOptions);
    if (!jiraParsed.success) {
      fail(`Invalid Jira adapter config: ${JSON.stringify(jiraParsed.error)}`, json);
    }
    jiraConfig = jiraParsed.data as JiraAdapterConfig;

    const mockMode = jiraConfig.mockMode ?? true;
    if (mockMode) {
      log('Jira is in mock mode — fetched data will be synthetic.', json);
    }
    try {
      jiraClient = mockMode
        ? createMockJiraClient()
        : createRealJiraClient(jiraConfig);
    } catch (err) {
      fail(`Failed to create Jira client: ${(err as Error).message}`, json);
    }

    log(`Fetching issue ${issueKey}...`, json);
    const issue = await jiraClient.getIssue(issueKey);
    if (!issue) {
      fail(`Issue ${issueKey} not found in Jira.`, json);
    }

    const fields = issue.fields as Record<string, unknown>;
    summary = (fields.summary as string) ?? '';
    description = typeof fields.description === 'string' ? fields.description : '';
    labels = Array.isArray(fields.labels) ? fields.labels : [];

    if (jiraConfig.fetchIssueComments) {
      log('Fetching comments...', json);
      const allComments = await jiraClient.getComments(issueKey);
      const retryPhrase = jiraConfig.retryTriggerPhrase ?? '#agent-detective analyze';
      const prPhrase = jiraConfig.prTriggerPhrase ?? '#agent-detective pr';
      const filtered = allComments
        .filter((c) => !isOwnComment(c.text, c.author ?? null, jiraConfig!.jiraUser ?? null))
        .filter((c) => !hasTriggerPhrase(c.text, retryPhrase) && !hasTriggerPhrase(c.text, prPhrase))
        .map((c) => {
          const who = c.author?.displayName || 'Unknown';
          const text = c.text.slice(0, 2_000);
          return `[${c.createdAt}] ${who}:\n${text}`;
        })
        .slice(-30);
      if (filtered.length > 0) {
        commentsContext = `\n\n## Issue Comments\n\n${filtered.join('\n\n---\n\n')}`;
      }
    }

    // --repo overrides label matching in Jira mode
    if (flags.repo) {
      const found = validatedRepos.find((r) => r.name.toLowerCase() === flags.repo!.toLowerCase());
      if (!found) {
        const available = validatedRepos.map((r) => r.name).join(', ');
        fail(`Repo '${flags.repo}' not found in config. Available: [${available}].`, json);
      }
      repos = [found];
    } else {
      const matched = matchAllReposByLabels(labels, validatedRepos);
      const maxRepos = jiraConfig.maxReposPerIssue ?? 5;
      repos = matched.slice(0, maxRepos);

      if (repos.length === 0) {
        const available = validatedRepos.map((r) => r.name).join(', ');
        fail(
          `No configured repos match labels [${labels.join(', ')}]. Available repos: [${available}].`,
          json
        );
      }
    }

    log(`Matched ${repos.length} repo(s): ${repos.map((r) => r.name).join(', ')}`, json);
  }

  // --- Create agent runner ---
  const defaultModels: Record<string, { defaultModel?: string }> = {};
  let runnerConfig: {
    timeoutMs?: number;
    maxBufferBytes?: number;
    postFinalGraceMs?: number;
    forceKillDelayMs?: number;
  } | undefined;
  if (config.agents) {
    for (const [key, value] of Object.entries(config.agents)) {
      if (key === 'runner') {
        runnerConfig = value as typeof runnerConfig;
      } else {
        defaultModels[key] = value as { defaultModel?: string };
      }
    }
  }

  const silentLogger = { info: () => {}, warn: () => {}, error: () => {} };
  const verboseLogger = {
    info: (msg: string) => process.stderr.write(`[info] ${msg}\n`),
    warn: (msg: string) => process.stderr.write(`[warn] ${msg}\n`),
    error: (msg: string) => process.stderr.write(`[error] ${msg}\n`),
  };

  const agentRunner = createAgentRunner({
    execLocal,
    execLocalStreaming,
    terminateChildProcess,
    defaultModels,
    agentTimeoutMs: runnerConfig?.timeoutMs,
    agentMaxBuffer: runnerConfig?.maxBufferBytes,
    postFinalGraceMs: runnerConfig?.postFinalGraceMs,
    forceKillDelayMs: runnerConfig?.forceKillDelayMs,
    logger: verbose ? verboseLogger : silentLogger,
    defaultAgentId: normalizeAgent(config.agent),
  });

  for (const agent of listAgents()) {
    agentRunner.registerAgent(agent);
  }

  // --- Run analysis per repo ---
  const customPrompt = prompt ?? jiraConfig?.analysisPrompt;
  const readOnly = jiraConfig?.analysisReadOnly !== false;
  const results: TriageResult[] = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i]!;
    log(`Analyzing ${issueKey} against '${repo.name}' (${i + 1}/${repos.length})...`, json);

    try {
      const repoContext = await buildRepoContext(repo.path, {
        maxCommits: reposConfig.repoContext?.gitLogMaxCommits ?? 50,
        gitCommandTimeoutMs: reposConfig.repoContext?.gitCommandTimeoutMs,
        gitMaxBufferBytes: reposConfig.repoContext?.gitMaxBufferBytes,
      });
      const contextBlock = formatRepoContextForPrompt(repoContext);

      const promptTemplate = customPrompt || getDefaultAnalysisPrompt();
      const fullPrompt = formatTemplate(promptTemplate, {
        task_id: issueKey,
        task_summary: summary,
        task_description: `${description}${commentsContext}`,
        task_labels: labels.join(', ') || '(no labels)',
        repo_name: repo.name,
        repo_path: repo.path,
        repo_tech_stack: repo.techStack?.join(', ') || '(not detected)',
        repo_summary: repo.summary || '',
        repo_commits: contextBlock,
      });

      const result = await agentRunner.runAgentForChat(
        `triage:${issueKey}:${repo.name}`,
        fullPrompt,
        {
          repoPath: repo.path,
          cwd: repo.path,
          readOnly,
          onStdout: verbose ? (chunk: string) => process.stderr.write(chunk) : undefined,
        },
      );

      results.push({
        repo: repo.name,
        text: result.text,
        usage: result.usage?.wallTimeMs != null ? { wallTimeMs: result.usage.wallTimeMs } : undefined,
      });
    } catch (err) {
      const message = (err as Error).message;
      log(`Agent failed for repo '${repo.name}': ${message}`, json);
      results.push({ repo: repo.name, text: '', error: message });
    }
  }

  agentRunner.shutdown();

  // --- Output results ---
  const hasErrors = results.some((r) => r.error);
  if (hasErrors) process.exitCode = 1;

  if (output === 'stdout') {
    if (json) {
      outputJson({ ok: !hasErrors, issueKey, results });
    } else {
      for (const r of results) {
        if (r.error) {
          process.stderr.write(`Failed for '${r.repo}': ${r.error}\n`);
          continue;
        }
        const heading = repos.length > 1 ? `## Analysis for \`${r.repo}\`\n\n` : '';
        // eslint-disable-next-line no-console
        console.log(`${heading}${r.text}`);
      }
    }
  } else if (output === 'file') {
    mkdirSync(outputPath, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const paths: string[] = [];
    for (const r of results) {
      if (r.error) continue;
      const filename = `${issueKey}-${r.repo}-${timestamp}.md`;
      const filePath = resolve(outputPath, filename);
      const heading = repos.length > 1 ? `## Analysis for \`${r.repo}\`\n\n` : '';
      writeFileSync(filePath, `${heading}${r.text}\n`, 'utf8');
      paths.push(filePath);
      log(`Wrote ${filePath}`, json);
    }
    if (json) {
      outputJson({ ok: !hasErrors, issueKey, files: paths, results });
    } else {
      for (const p of paths) {
        // eslint-disable-next-line no-console
        console.log(p);
      }
    }
  } else if (output === 'jira') {
    for (const r of results) {
      if (r.error) continue;
      const heading = repos.length > 1 ? `## Analysis for \`${r.repo}\`\n\n` : '';
      const body = stampComment(`${heading}${r.text}`);
      try {
        await jiraClient!.addComment(issueKey, body);
        log(`Posted analysis to ${issueKey} (repo: ${r.repo})`, json);
      } catch (err) {
        log(`Failed to post comment for '${r.repo}': ${(err as Error).message}`, json);
        r.error = (err as Error).message;
      }
    }
    if (json) {
      outputJson({ ok: !results.some((r) => r.error), issueKey, results });
    } else if (!hasErrors) {
      // eslint-disable-next-line no-console
      console.log(`Posted analysis to ${issueKey}`);
    }
  }

  log('Done.', json);
}
