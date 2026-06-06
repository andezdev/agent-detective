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
| **Agent CLI** on `PATH` (e.g. [OpenCode](https://opencode.ai/docs)) | Matches `config.agent`; must be authenticated for real analysis |
| A **git clone** on disk | Registered in `config/local.json` under `repos[].path` |

:::note[No Docker]
Agent CLIs (OpenCode, Cursor, Claude) must run on the **same host** as Agent Detective with your local auth. This quickstart installs via **npm on the host**, not in a container.
:::

## 1. Install and scaffold

```bash
npm i -g agent-detective

mkdir -p ~/agent-detective && cd ~/agent-detective

agent-detective init \
  --repo-path /absolute/path/to/your/git/checkout \
  --repo-name symfony
```

`init` writes **`config/local.json`** with **mock Jira mode**, one repo, and bundled plugins. Use `--repo-name` equal to a label you will attach in Jira later; the bundled smoke fixture uses **`symfony`** and **`probando`**.

Prefer not to install globally?

```bash
npx agent-detective init --repo-path /path/to/repo --repo-name symfony
```

## 2. Validate and run

```bash
agent-detective doctor --config-root .
agent-detective --config-root .
```

Leave the server running. Default port is **3001**. Open **http://127.0.0.1:3001/docs** for the API reference (Scalar).

## 3. Mock webhook smoke (no Jira Cloud)

With the server running, POST the bundled **issue created** fixture. You do **not** need a git clone if you pipe the fixture from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/andezdev/agent-detective/main/packages/jira-adapter/test/fixtures/issue-created.json \
  | curl -sS -X POST http://127.0.0.1:3001/plugins/agent-detective-jira-adapter/webhook/jira \
    -H 'Content-Type: application/json' -d @-
```

From a **monorepo clone**, the same fixture is one command:

```bash
pnpm run jira:webhook-smoke
```

**Success:** server logs show the webhook accepted, a task queued, and **`[MOCK] Added comment`** when mock analysis finishes. **`GET /api/health`** should stay **ok**.

If the repo label does not match, re-run `init` with `--repo-name symfony` (fixture labels) or add your `--repo-name` as a label in a real Jira issue later.

## 4. What you have now

- A working server with **OpenAPI docs** at `/docs`
- **Mock** Jira adapter — safe to hit without posting to Jira
- One **local repo** wired for label-based matching

## Next steps

| Goal | Where to go |
|------|-------------|
| Real Jira + tunnel | [Golden path](golden-path.md) · [Jira E2E](../e2e/jira-manual-e2e.md) |
| Production VM (systemd, nginx) | [Deployment](deployment.md) |
| Env, secrets, plugins | [Configuration hub](../config/configuration-hub.md) |
| Linear instead of Jira | [Linear adapter](../plugins/linear-adapter.md) · [Linear E2E](../e2e/linear-manual-e2e.md) |
| Fork or change core code | [Development](../development/development.md) |
