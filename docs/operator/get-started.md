---
title: "Get started"
description: Five-minute npm quickstart — install, scaffold config, run the server, and verify with a mock Jira webhook.
sidebar:
  order: 1
---

# Get started

Run Agent Detective on your host in about **five minutes**. This path uses the **npm CLI**, **mock Jira mode** (no Jira Cloud account required for the smoke test), and a **local git checkout** you point at in config.

**After this page:** [golden path](golden-path.md) (full Jira + tunnel), [configuration hub](../config/configuration-hub.md), or [installation paths](installation.mdx) if you need from-source or bare metal.

## Prerequisites

| Requirement | Why |
|-------------|-----|
| **Node.js 24+** | Runs the `agent-detective` CLI and server |
| **git** on `PATH` | **local-repos** plugin reads your checkout |
| **Agent CLI** on `PATH` (e.g. [OpenCode](https://opencode.ai/docs), [Cursor](https://cursor.com/docs/cli/overview)) | Matches `config.agent`; must be authenticated for real analysis. Cursor runs headless with workspace trust handled by the host. |
| A **git clone** on disk | Registered in `config/local.json` under `repos[].path` |

:::note[No Docker]
Agent CLIs (OpenCode, Cursor, Claude) must run on the **same host** as Agent Detective with your local auth. This quickstart installs via **npm on the host**, not in a container.
:::

## 1. Install and scaffold

```bash
npm i -g agent-detective

mkdir -p ~/agent-detective && cd ~/agent-detective

agent-detective init
```

In a terminal (TTY), bare **`agent-detective init`** opens a **guided wizard** in six sections (setup, agent, repository, server, integration, advanced). You finish on a **review screen** where you can edit any section before writing **`config/local.json`**. Jira mock mode is the default for the smoke test.

For scripts and CI, use non-interactive mode:

```bash
agent-detective init --yes \
  --repo-path /absolute/path/to/your/git/checkout \
  --repo-name symfony
```

Use `--repo-name` equal to a label you will attach in Jira later; the bundled smoke fixture uses **`symfony`** and **`probando`**.

| Flag | Purpose |
|------|---------|
| `--yes` / `-y` | Skip wizard; use flags or defaults |
| `--json` | Machine-readable result |
| `--repo-path`, `--repo-name` | Single repo (legacy) |
| `--repo name:path` | Repeatable repo spec |
| `--port`, `--agent`, `--default-model` | Server and agent runtime |
| `--tracker jira\|linear\|mock-only` | Issue tracker branch |
| `--jira-mock` / `--no-jira-mock`, `--jira-base-url` | Jira mode (secrets via env) |
| `--force` | Overwrite existing `local.json` |

Prefer not to install globally?

```bash
npx agent-detective init --yes --repo-path /path/to/repo --repo-name symfony
```

## 2. Validate and run

```bash
agent-detective doctor --config-root .
agent-detective --config-root .
```

**Doctor** runs preflight checks (config, agent CLI, plugins, repo paths, listen port). See [CLI reference — doctor](cli.md#doctor) for the full checklist and `--verbose` / `--json`.

| Flag | Purpose |
|------|---------|
| `--config-root` | Install directory (same as server) |
| `--verbose` | Extra paths and plugin details |
| `--json` | Machine-readable report |

Leave the server running. Default port is **3001**. Open **http://127.0.0.1:3001/docs** for the API reference (Scalar).

## 3. Mock webhook smoke (no Jira Cloud)

With the server running, POST the bundled **issue created** fixture:

```bash
agent-detective smoke --config-root .
```

The CLI ships the same fixture as the monorepo (`fixtures/jira-issue-created.json`). Labels **`probando`** and **`symfony`** must match a repo name in your config (re-run `init` with `--repo-name symfony` if needed).

| Flag | Purpose |
|------|---------|
| `--config-root` | Read `port` from config (default webhook host `127.0.0.1:3001`) |
| `--url` | Full webhook URL override (or `JIRA_WEBHOOK_URL` env) |
| `--host` | Host override when building URL from config port |
| `--json` | Machine-readable result |

From a **monorepo clone**, the same check is:

```bash
pnpm run jira:webhook-smoke
```

**Success:** server logs show the webhook accepted, a task queued, and **`[MOCK] Added comment`** when mock analysis finishes. **`GET /api/health`** should stay **ok**.

More on **`smoke`** and other commands: [CLI reference](cli.md).

## 4. What you have now

- A working server with **OpenAPI docs** at `/docs`
- **Mock** Jira adapter — safe to hit without posting to Jira
- One **local repo** wired for label-based matching

## Next steps

| Goal | Where to go |
|------|-------------|
| CLI commands (doctor, smoke, flags) | [CLI reference](cli.md) |
| Real Jira + tunnel | [Golden path](golden-path.md) · [Jira E2E](../e2e/jira-manual-e2e.md) |
| Production VM (systemd, nginx) | [Deployment](deployment.md) |
| Env, secrets, plugins | [Configuration hub](../config/configuration-hub.md) |
| Linear instead of Jira | [Linear adapter](../plugins/linear-adapter.md) · [Linear E2E](../e2e/linear-manual-e2e.md) |
| Fork or change core code | [Development](../development/development.md) |
