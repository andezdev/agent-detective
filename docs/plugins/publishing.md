---
title: "Publishing Guide"
description: Publish the agent-detective npm CLI and workspace packages with release-please.
sidebar:
  order: 5
---

# Publishing Guide

This monorepo publishes **`agent-detective`** (operator CLI) and **`@agent-detective/*`** workspace packages to npm using **[release-please](https://github.com/googleapis/release-please)** and **Conventional Commits**.

## Package overview

| Package | npm name | Role |
|---------|----------|------|
| Root app | `agent-detective` | Operator CLI (`npm i -g agent-detective`) |
| `packages/types` | `@agent-detective/types` | Host-internal types (re-exported via SDK) |
| `packages/sdk` | `@agent-detective/sdk` | Plugin-author SDK |
| `packages/observability` | `@agent-detective/observability` | Logging, metrics, health |
| `packages/process-utils` | `@agent-detective/process-utils` | Process helpers |
| `packages/local-repos-plugin` | `@agent-detective/local-repos-plugin` | Local repos plugin |
| `packages/jira-adapter` | `@agent-detective/jira-adapter` | Jira adapter |
| `packages/linear-adapter` | `@agent-detective/linear-adapter` | Linear adapter |
| `packages/pr-pipeline` | `@agent-detective/pr-pipeline` | PR pipeline plugin |

Apps under `apps/*` are **private** and are not published.

All publishable packages share one **linked version** (see `release-please-config.json`).

## Prerequisites

1. **npm account** with publish access to `agent-detective` and `@agent-detective/*`
2. **2FA** on npm (recommended)
3. **npm Trusted Publishing (OIDC)** configured for this GitHub repo (see [.github/workflows/release-please.yml](../../.github/workflows/release-please.yml) — `id-token: write`, `--provenance`)
4. Commits on `main` follow **[Conventional Commits](https://www.conventionalcommits.org/)** (husky + commitlint)

## Day-to-day workflow (maintainers)

1. Merge feature PRs to `main` using Conventional Commit messages, for example:
   - `feat(jira): add OAuth refresh retry`
   - `fix(cli): init refuses invalid agent id`
   - `chore: update turbo`
2. **release-please** opens or updates a **Release PR** (`chore: release X.Y.Z`) with version bumps, changelogs, and lockfile updates.
3. **Merge the Release PR** when ready to ship.
4. On merge, [.github/workflows/release-please.yml](../../.github/workflows/release-please.yml):
   - Creates the GitHub Release + tag
   - Runs lint, typecheck, test, build
   - Runs `pnpm publish -r --access public --provenance`

Manual trigger: **Actions → release-please → Run workflow** (same publish path when a release is created).

## Configuration files

| File | Purpose |
|------|---------|
| [release-please-config.json](../../release-please-config.json) | Release types, linked-versions group, `node-workspace` plugin |
| [.release-please-manifest.json](../../.release-please-manifest.json) | Current version per package path |
| [commitlint.config.js](../../commitlint.config.js) | Conventional Commit rules |
| [.husky/commit-msg](../../.husky/commit-msg) | Runs commitlint on each commit |

`src/version.ts` includes an `// x-release-please-version` marker so the root CLI version stays in sync.

## Pre-release checklist (manual smoke)

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build && pnpm run build:app
npm pack   # optional: inspect tarball at repo root
```

## For external plugin developers

Wiring a published package into a running app is covered in **[extending-with-plugins.md](extending-with-plugins.md)**.

### Installing the SDK

```bash
npm install @agent-detective/sdk
# or
pnpm add @agent-detective/sdk
```

## Workspace vs published versions

Inside the monorepo, dependencies use `workspace:*`. On publish, pnpm replaces those with concrete semver versions.

## Troubleshooting

### Publish failed in GitHub Actions

- Confirm **Trusted Publishers** on npm match this repo and workflow.
- First publish of scope `@agent-detective/*` may require `access: public` (already set via `publishConfig`).
- Check the workflow log for `pnpm publish` errors (missing `dist/`, auth, or duplicate version).

### Release PR did not open

- Commits since the last release must use Conventional Commit types (`feat`, `fix`, `chore`, …) that release-please recognizes.
- Check the **release-please** Action log on `main`.

### commitlint rejected my commit

Use messages like `type(scope): subject` — e.g. `docs: fix installation link`.

## Operators

End users install **`npm i -g agent-detective`**. See [installation.mdx](../operator/installation.mdx) and [releasing.md](../operator/releasing.md).
