---
title: "Maintainer: releasing"
description: How release-please creates GitHub Releases and publishes the npm CLI.
sidebar:
  order: 8
---

# Maintainer: releasing

Releases are automated with **[release-please](https://github.com/googleapis/release-please)** — the same model as [andezdev/tokenlite-mysql-mcp](https://github.com/andezdev/tokenlite-mysql-mcp).

## What happens automatically

On every push to **`main`**, [.github/workflows/release-please.yml](../../.github/workflows/release-please.yml):

1. Opens or updates a **Release PR** with version bumps, changelogs, and manifest updates.
2. When that PR is **merged**, creates a **GitHub Release** + git tag and publishes to npm:
   - `agent-detective` (CLI)
   - All `@agent-detective/*` packages (linked to the same version)

## Maintainer steps

1. Land changes on `main` using **Conventional Commits** (`feat:`, `fix:`, `chore:`, …).
2. Review the **Release PR** created by release-please.
3. Merge the Release PR when CI is green and the changelog looks correct.
4. Confirm the **release-please** workflow published to npm and created the GitHub Release.

Optional smoke after publish:

```bash
npm i -g agent-detective@X.Y.Z
agent-detective init
agent-detective doctor
```

## Secrets and permissions

| Item | Purpose |
|------|---------|
| `GITHUB_TOKEN` | Release PR + GitHub Release (default) |
| `NPM_TOKEN` | `pnpm publish -r` in the workflow |

## Configuration

- [release-please-config.json](../../release-please-config.json)
- [.release-please-manifest.json](../../.release-please-manifest.json)
- Full publish guide: [publishing.md](../plugins/publishing.md)

## See also

- [installation.mdx](installation.mdx) — operator install paths
- [upgrading.md](upgrading.md) — how operators upgrade the npm CLI
