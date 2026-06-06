# Changelog

## [1.0.1](https://github.com/andezdev/agent-detective/compare/agent-detective-v1.0.0...agent-detective-v1.0.1) (2026-06-06)


### Bug Fixes

* **cli:** skip dev postinstall hooks in published npm package ([6f27107](https://github.com/andezdev/agent-detective/commit/6f27107142cdb1d661d84a7d39e2dcacd6474ee9))
* **sdk:** add README to the published npm package ([9117a85](https://github.com/andezdev/agent-detective/commit/9117a856a74e9bb9824c11547e490bc7e3943e8c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @agent-detective/jira-adapter bumped to 1.0.1
    * @agent-detective/linear-adapter bumped to 1.0.1
    * @agent-detective/local-repos-plugin bumped to 1.0.1
    * @agent-detective/observability bumped to 1.0.1
    * @agent-detective/pr-pipeline bumped to 1.0.1
    * @agent-detective/process-utils bumped to 1.0.1
    * @agent-detective/sdk bumped to 1.0.1
    * @agent-detective/types bumped to 1.0.1

## [1.0.0](https://github.com/andezdev/agent-detective/compare/agent-detective-v0.1.0...agent-detective-v1.0.0) (2026-06-06)


### ⚠ BREAKING CHANGES

* **sdk:** createTagDescription are no longer exported (host-internal).

### Features

* add option to enable or disable jira-adapter plugin ([eba9573](https://github.com/andezdev/agent-detective/commit/eba9573ffab53e01d34ebf63f6296a9e6322f005))
* **config:** whitelist TASKS_* and RUN_RECORDS_PATH env vars ([d23a499](https://github.com/andezdev/agent-detective/commit/d23a49931acab27974fb3178f628b44562f38616))
* **core-api:** add /api/plugins plugin-system diagnostics ([64375d2](https://github.com/andezdev/agent-detective/commit/64375d282bafec703d493e5295f41a6e6ea7de08))
* graceful shutdown, AgentOutput with threadId/usage, PR summary & analytics ([f6d7902](https://github.com/andezdev/agent-detective/commit/f6d7902300698bacd63dffe9745144611dcfc9cc))
* **jira:** add OAuth 2.0 (3LO) auth flow and docs ([f471cb1](https://github.com/andezdev/agent-detective/commit/f471cb1970a6c0c6d8bf98c236f8c2299ac5693e))
* **jira:** add OAuth 2.0 (3LO) auth flow and docs ([c64ba65](https://github.com/andezdev/agent-detective/commit/c64ba6579593f0850cdfcf896f07853c9408d278))
* **linear-adapter:** OAuth refresh grant, bootstrap, and graph token rotation ([5182781](https://github.com/andezdev/agent-detective/commit/5182781beac2111c5765079417a74814c065c078))
* **linear-adapter:** route webhooks to analyze/PR and post TASK_COMPLETED ([338e019](https://github.com/andezdev/agent-detective/commit/338e0190e2ad51907f4a3ffb2a0a3a2786fb1714))
* **linear-adapter:** wire OAuth routes and complete PR fan-out context ([cef71e2](https://github.com/andezdev/agent-detective/commit/cef71e2bf7dcdcdbfc9dc80f63c5ee0317dc5708))
* **linear:** adapter scaffold, tracker port, signed webhooks ([15a2bf7](https://github.com/andezdev/agent-detective/commit/15a2bf7c50a8315b855947f732c0d5f0521783c3))
* npm-first CLI with init, release-please, and operator docs ([5bcf1b3](https://github.com/andezdev/agent-detective/commit/5bcf1b3d225cf81d5b0391b52dc94c0a79e34521))
* npm-first CLI with init, release-please, and operator docs ([85905bf](https://github.com/andezdev/agent-detective/commit/85905bf4a73913a9b9e51df80c1c2ce1878c6adb))
* **plugin-system:** add capability-backed services with provider selection ([ee91301](https://github.com/andezdev/agent-detective/commit/ee91301de60aa1073b2244d70dd9f2ec7a65eabf))
* **plugin-system:** enforce strict plugin contracts, deps, and option validation ([7df69b4](https://github.com/andezdev/agent-detective/commit/7df69b41fe0906c71dbab1953b9e9e812a31e754))
* **release:** add SEA native binaries with bundled plugins, doctor, … ([f0501b2](https://github.com/andezdev/agent-detective/commit/f0501b23f7172ddcfd3464dd3c7c77f52488f58e))
* **release:** add SEA native binaries with bundled plugins, doctor, and signed SBOM ([1cea41e](https://github.com/andezdev/agent-detective/commit/1cea41e8cedce54265809ed0d4a966c3a2a5f173))
* simplify docs and code and configs ([3dff8d2](https://github.com/andezdev/agent-detective/commit/3dff8d2d52758fa2a7828bba5065f629c3919c62))
* triage step, image attachments, comment threading & fixes for pr-pipeline ([1e0ddf8](https://github.com/andezdev/agent-detective/commit/1e0ddf8135f4b5c8f1623c394a5b56e2872d9bd0))


### Bug Fixes

* **build:** externalize jira.js for ESM dist; unblock CI smoke ([6baad1d](https://github.com/andezdev/agent-detective/commit/6baad1dad0cf4f6b9b761820f350235a9c7677e9))
* **build:** externalize jira.js for ESM dist; unblock CI smoke ([793af1f](https://github.com/andezdev/agent-detective/commit/793af1f65d82b5e93e5457c35954f72aaacbd06a))
* **docker:** add production dependencies and verify working build ([5c52313](https://github.com/andezdev/agent-detective/commit/5c52313560bd6ed31b2cccaf371142721304934e))
* **docker:** fix dev stage user/permissions and use production target in CI ([57eacdf](https://github.com/andezdev/agent-detective/commit/57eacdf4956caa03e1dc96aac769819c1ed71e33))
* **docker:** include pnpm-lock.yaml and fix Node 20 deprecation warning ([3ebeda7](https://github.com/andezdev/agent-detective/commit/3ebeda7ed986a7641440962e81719f6e82364a73))
* **docker:** resolve circular dependency and update to Node 24 ([fb0caa2](https://github.com/andezdev/agent-detective/commit/fb0caa2ff362b8cab39e0e6b9b07cdb35bddce62))
* **docker:** resolve corepack permission denied and Node 20 deprecation ([9668d9c](https://github.com/andezdev/agent-detective/commit/9668d9cc6e0228bc4226e0630ae8bccde5782a88))
* **docker:** use npm for pnpm instead of corepack, add wget ([cc3b57a](https://github.com/andezdev/agent-detective/commit/cc3b57a10061cf5a86848eb9cdf1c546a4670c3f))
* **docs:** single operator/installation page (mdx only) ([01f21e0](https://github.com/andezdev/agent-detective/commit/01f21e058d8b7eae8300453c4e9d8d1697e3914b))
* **jira-adapter:** Jira  threaded analyze replies ([e5359dd](https://github.com/andezdev/agent-detective/commit/e5359dd2c5c24116000473bfb5a6337d09ef71b2))
* **jira-adapter:** Jira  threaded analyze replies ([df7fb14](https://github.com/andezdev/agent-detective/commit/df7fb1478cae33da49d82b284b65332ad8fd8ace))
* **KAN-18:** Best pr-pipeline workflow ([b9b4ccf](https://github.com/andezdev/agent-detective/commit/b9b4ccf70a5fa63cbdfa0392d7cc6d49e1297a32))


### Code Refactoring

* **sdk:** split @agent-detective/core into @agent-detective/sdk + types ([8cb5025](https://github.com/andezdev/agent-detective/commit/8cb5025ba57b23ef730334c53824c43486280525))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @agent-detective/jira-adapter bumped to 1.0.0
    * @agent-detective/linear-adapter bumped to 1.0.0
    * @agent-detective/local-repos-plugin bumped to 1.0.0
    * @agent-detective/observability bumped to 1.0.0
    * @agent-detective/pr-pipeline bumped to 1.0.0
    * @agent-detective/process-utils bumped to 1.0.0
    * @agent-detective/sdk bumped to 1.0.0
    * @agent-detective/types bumped to 1.0.0
