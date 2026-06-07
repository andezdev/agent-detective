---
title: "Get started"
description: Five-minute npm quickstart — install, scaffold config, run the server, and verify with a mock Jira webhook.
sidebar:
  order: 1
---

# Get started

Run Agent Detective on your host in about **five minutes**: **npm CLI**, **mock Jira** (no Jira account for the smoke test), and a **local git checkout**.

**Next:** [golden path](golden-path.md) (real Jira + tunnel) · [CLI reference](cli.md) · [configuration hub](../config/configuration-hub.md)

## Prerequisites

| Requirement | Why |
|-------------|-----|
| **Node.js 24+** | Runs the `agent-detective` CLI and server |
| **git** on `PATH` | local-repos plugin reads your checkout |
| **Agent CLI** on `PATH` ([OpenCode](https://opencode.ai/docs), [Cursor](https://cursor.com/docs/cli/overview), …) | Matches `config.agent`; required for real analysis (Cursor runs headless with workspace trust from the host) |
| A **git clone** on disk | Registered in config as `repos[].path` |

:::note[No Docker]
Agent CLIs must run on the **same host** as Agent Detective with your local auth. This quickstart uses **npm on the host**, not a container.
:::

## 1. Install and scaffold

```bash
npm i -g agent-detective
mkdir -p ~/agent-detective && cd ~/agent-detective
agent-detective init
```

In a TTY, **`agent-detective init`** opens a guided wizard (setup → agent → repo → server → integration → review). Jira **mock mode** is the default.

Non-interactive (scripts / CI):

```bash
agent-detective init --yes \
  --repo-path /absolute/path/to/your/git/checkout \
  --repo-name symfony
```

Use `--repo-name` equal to a label you will attach in Jira; the bundled smoke fixture uses **`symfony`** and **`probando`**.

Without a global install: `npx agent-detective init --yes --repo-path /path/to/repo --repo-name symfony`

All **init** flags: [CLI reference — init](cli.md#init).

## 2. Validate and run

```bash
agent-detective doctor --config-root .
agent-detective --config-root .
```

**Doctor** checks config, agent CLI, plugins, repo paths, listen port, and tracker credentials when not in mock mode. Use `--verbose` or `--json` when automating — [CLI reference — doctor](cli.md#doctor).

Leave the server running (default port **3001**). Open **http://127.0.0.1:3001/docs** for the API reference (Scalar).

## 3. Mock webhook smoke

With the server running:

```bash
agent-detective smoke --config-root .
```

Posts the bundled **`jira:issue_created`** fixture (`fixtures/jira-issue-created.json` in the npm package). Labels **`probando`** and **`symfony`** must match a `repos[].name` in your config.

**Success:** HTTP **200**, `{"status":"queued","taskId":"..."}`; server logs show a queued task and **`[MOCK] Added comment`** when mock analysis finishes.

Monorepo contributors (server already on `PORT`): `pnpm run jira:webhook-smoke`.

## 4. What you have now

- Server with **OpenAPI docs** at `/docs`
- **Mock** Jira adapter — safe without posting to Jira
- One **local repo** wired for label-based matching

## Next steps

| Goal | Document |
|------|----------|
| CLI commands and flags | [CLI reference](cli.md) |
| Real Jira + tunnel | [Golden path](golden-path.md) · [Jira E2E](../e2e/jira-manual-e2e.md) |
| Production VM | [Deployment](deployment.md) |
| Secrets and plugins | [Configuration hub](../config/configuration-hub.md) |
| Contribute to core | [Development](../development/development.md) |
