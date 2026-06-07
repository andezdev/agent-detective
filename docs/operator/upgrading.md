---
title: "Staying up to date"
description: Upgrade runbooks for the npm CLI, git clones, and published npm packages.
sidebar:
  order: 7
---

# Staying up to date

Use this page when you deploy with the **`agent-detective` npm CLI**, track **main** in git, or consume **published npm packages** from this monorepo. It ties together GitHub Releases and [migration.md](../development/migration.md).

**Other operator hubs:** [installation.mdx](installation.mdx) (deploy paths) · [configuration-hub.md](../config/configuration-hub.md) (config load order and keys).

## How to learn about changes

| Channel | Use for |
|---------|---------|
| **GitHub Releases** | Version notes when the release-please Release PR merges ([workflow](../../.github/workflows/release-please.yml)) |
| **[migration.md](../development/migration.md)** | Config moves and conventions (not a full version history) |
| **Watching the repository** | GitHub **Watch** for releases or commits |

There is no separate mailing list; subscribe via GitHub.

## Upgrading the npm CLI

1. Read GitHub Release notes since the version you run (and [migration.md](../development/migration.md) if linked).
2. Update `config` if new or changed keys are required — see [configuration-hub.md](../config/configuration-hub.md) and [configuration.md](../config/configuration.md).
3. Upgrade the global package:

   ```bash
   npm i -g agent-detective@latest
   ```

4. Restart the process (systemd, or your supervisor).
5. Run **`agent-detective doctor`** and **`agent-detective smoke`** (server running) or **`GET /api/health`**.

Keep **secrets in env** ([configuration.md](../config/configuration.md)); do not bake tokens into world-readable install trees.

Layout and systemd: [deployment.md](deployment.md).

## Upgrading from a git clone

For operators who run **`pnpm start`** from a built tree:

```bash title="Pull and rebuild from source"
git fetch origin
git checkout <branch-or-tag>   # e.g. main or a release tag
pnpm install --frozen-lockfile
pnpm run build
pnpm run build:app
```

1. Same as above: release notes + **migration** + **config** review.
2. If you change bundled plugin Zod schemas in a fork, run **`pnpm docs:plugins`** and commit [generated/plugin-options.md](../reference/generated/plugin-options.md) if you track it.
3. Run tests in CI or locally: `pnpm test`, `pnpm run typecheck` (as in [development.md](../development/development.md)).

## Published npm packages (`@agent-detective/*`)

Workspace packages may be published per [publishing.md](../plugins/publishing.md). When you depend on them in another project:

- Follow **semver** in that package’s version.
- Read the monorepo **CHANGELOG** when upgrading the app or library — types and plugin options can change together.

## Summary

:::tip[Key takeaways]
- **npm CLI:** `npm i -g agent-detective@latest`, then `doctor` and restart the service.
- **Config:** merge [configuration-hub.md](../config/configuration-hub.md) rules; watch **CHANGELOG** for breaking keys.
- **Source:** pull, install, build, then deploy; keep `config/local.json` and env out of git.
:::

## See also

- [configuration-hub.md](../config/configuration-hub.md) — where settings live
- [installation.mdx](installation.mdx) — deployment paths
- [releasing.md](releasing.md) — maintainers: create a new tag/release
- [publishing.md](../plugins/publishing.md) — npm publish mechanics (maintainers)
