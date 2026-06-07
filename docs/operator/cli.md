---
title: "CLI reference"
description: npm CLI commands — init, doctor, smoke, validate-config, and server startup.
sidebar:
  order: 2
---

# CLI reference

The **`agent-detective`** npm package is the operator entry point. Install globally (`npm i -g agent-detective`) or run with `npx`.

**Typical flow:** [init](#init) → [doctor](#doctor) → start server → [smoke](#smoke) (mock webhook).

For terminal help at any time:

```bash
agent-detective --help
agent-detective help doctor
agent-detective doctor --help
```

## Global options

| Flag / env | Purpose |
|------------|---------|
| `--config-root <dir>` | Install directory containing `config/`, or the `config/` dir itself |
| `AGENT_DETECTIVE_CONFIG_ROOT` | Same as `--config-root` |
| `--version` | Print CLI version |
| `-h`, `--help` | Overview help, or command help when placed after a subcommand |

Default server command (no subcommand):

```bash
agent-detective --config-root ~/agent-detective
```

OpenAPI docs: **http://127.0.0.1:3001/docs** by default (or your configured `port`).

---

## init

Scaffold **`config/local.json`** (and copy **`config/default.json`** from the package template when missing).

| Mode | Behavior |
|------|----------|
| **TTY, no `--yes`** | Six-section guided wizard with review screen |
| **`--yes` / `-y`** | Non-interactive; use flags or defaults |

Common flags: `--repo-path`, `--repo-name`, `--repo name:path`, `--port`, `--agent`, `--default-model`, `--tracker jira|linear|mock-only`, `--jira-mock` / `--no-jira-mock`, `--force`, `--json`.

See [get started](get-started.md#1-install-and-scaffold) for a full quickstart example.

---

## doctor

**Preflight before you run the server or expose webhooks.** Exit code **0** when all checks pass, **1** otherwise.

```bash
agent-detective doctor --config-root ~/agent-detective
agent-detective doctor --config-root ~/agent-detective --verbose
agent-detective doctor --json
```

### Flags

| Flag | Purpose |
|------|---------|
| `--config-root <dir>` | Install directory (default: cwd) |
| `--verbose` | Extra detail lines under each check (paths, plugin specs) |
| `--json` | Machine-readable report: `{ ok, configRootUsed, checks[] }` |

### What it checks

Human output is grouped into sections. Each check shows **`ok`** or **`FAIL`**, a short title, and a one-line summary.

| Section | Checks |
|---------|--------|
| **Configuration** | Config directory/files present; `default.json` + `local.json` load and pass Zod validation (includes env whitelist merge) |
| **Agent** | Configured agent CLI (OpenCode, Cursor, Claude, …) is on `PATH` |
| **Plugins** | Each configured plugin package imports, schema validates, and options validate |
| **Repositories** | Each `repos[].path` exists, resolves relative to install root, and is a **git checkout** (`.git` present) |
| **Issue trackers** | When Jira/Linear are **enabled** and **not** in mock mode: required API credentials (Basic or OAuth) are present via config or env — see [configuration.md](../config/configuration.md) |
| **Server** | Configured **listen port** is free, **or** agent-detective is already responding on `/api/health` |

Example (success):

```text
agent-detective doctor: OK (11/11 checks)
Config root: ~/agent-detective/config

Configuration
  ok    Config files
        default.json and/or local.json present
  ok    Schema validation
        valid

Agent
  ok    Agent CLI
        opencode on PATH

Plugins (4/4)
  ok    @agent-detective/jira-adapter@0.1.0
  ...

Repositories
  ok    symfony
        /path/to/checkout

Issue trackers
  ok    Jira
        mock mode

Server
  ok    Listen port
        in use (this app)
```

**Port note:** If the server is already running on the configured port, doctor **passes** with `in use (this app)`. If another process holds the port, doctor **fails**.

Fix **`FAIL`** lines before production cutover. Re-run after changing config, env, or repo paths.

---

## smoke

POST the bundled **`jira:issue_created`** fixture to the local Jira webhook. **Requires the server running** and Jira **mock mode** (default after `init`).

```bash
agent-detective smoke --config-root ~/agent-detective
```

Fixture labels: **`probando`**, **`symfony`** — must match a `repos[].name` in config.

| Flag / env | Purpose |
|------------|---------|
| `--config-root <dir>` | Read `port` from config; POST to local Jira webhook on that port |
| `--url <webhook-url>` | Full URL override |
| `JIRA_WEBHOOK_URL` | Same as `--url` |
| `--host <host>` | Host when building URL from config port |
| `AGENT_DETECTIVE_SMOKE_HOST` | Default host (`127.0.0.1`) |
| `--json` | Machine-readable result |

**Success:** HTTP **200**, body like `{"status":"queued","taskId":"..."}`; server logs show task queue + agent run + **`[MOCK] Added comment`**.

From a monorepo clone: `pnpm run jira:webhook-smoke` (same fixture under `fixtures/`).

Details: [get started — mock webhook smoke](get-started.md#3-mock-webhook-smoke-no-jira-cloud).

---

## validate-config

**Config files only** — loads and validates `default.json` + `local.json` with Zod. Does **not** check agent CLI, plugin imports, repo paths, or listen port.

Use when you only need to verify JSON shape (e.g. CI config lint). For operator preflight, prefer **`doctor`**.

```bash
agent-detective validate-config --config-root ~/agent-detective
```

Supports `--json` and `--verbose`.

| Command | Config schema | Agent on PATH | Plugins import | Repos on disk | Port / credentials |
|---------|---------------|---------------|----------------|---------------|-------------------|
| **validate-config** | yes | no | no | no | no |
| **doctor** | yes | yes | yes | yes | yes |

---

## See also

- [Get started](get-started.md) — five-minute npm path
- [Golden path](golden-path.md) — first real Jira webhook
- [Deployment](deployment.md) — systemd; run `doctor` before enabling the service
- [Configuration hub](../config/configuration-hub.md) — env vars for Jira/Linear secrets
