# Agent Detective — documentation

AI-powered code analysis (Jira, webhooks, PR pipeline, local repos, and more). The root [README.md](../README.md) has a quick start; this page maps **`docs/`** so you can jump to the right guide.

## Operators (start here)

| Doc | For |
|-----|-----|
| [get started](operator/get-started.md) | Five-minute npm install, init, mock **`smoke`** |
| [CLI reference](operator/cli.md) | **init**, **doctor**, **smoke**, **validate-config** |
| [golden path](operator/golden-path.md) | Local smoke → real Jira webhook |
| [installation](operator/installation.mdx) | npm vs from-source vs bare metal |
| [deployment](operator/deployment.md) | systemd, nginx, health checks |
| [configuration hub](config/configuration-hub.md) | Load order, env whitelist |
| [upgrading](operator/upgrading.md) | npm and git upgrade runbooks |

## Other areas

| Area | Path | For |
|------|------|-----|
| **Configuration (full)** | [config/](config/) | Env tables, plugin narratives |
| **Plugins** | [plugins/](plugins/) | Authoring, extending, publishing |
| **Contribute** | [development/](development/) | pnpm, Turbo, agent harness, golden rules |
| **Design** | [architecture/](architecture/) | System view, [ADR](architecture/adr/) |
| **Manual E2E** | [e2e/](e2e/) | Jira/Linear tunnel walkthroughs (after get started) |
| **Generated reference** | [reference/generated/](reference/generated/) | Zod schemas for app + plugin options |
| **Tool refs** | [references/](references/) | pnpm, Turbo, ESM (low-token) |

**Published site:** `pnpm run docs:site` → [apps/docs/README.md](../apps/docs/README.md). Source syncs to Starlight on build; home page **`apps/docs/src/content/docs/index.mdx`** is hand-edited.
