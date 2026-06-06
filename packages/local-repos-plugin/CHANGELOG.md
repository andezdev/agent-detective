# Changelog

## [1.0.1](https://github.com/andezdev/agent-detective/compare/local-repos-plugin-v1.0.0...local-repos-plugin-v1.0.1) (2026-06-06)


### Miscellaneous Chores

* **local-repos-plugin:** Synchronize agent-detective versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @agent-detective/process-utils bumped to 1.0.1
    * @agent-detective/sdk bumped to 1.0.1

## [1.0.0](https://github.com/andezdev/agent-detective/compare/local-repos-plugin-v0.1.0...local-repos-plugin-v1.0.0) (2026-06-06)


### ⚠ BREAKING CHANGES

* **sdk:** createTagDescription are no longer exported (host-internal).

### Features

* graceful shutdown, AgentOutput with threadId/usage, PR summary & analytics ([f6d7902](https://github.com/andezdev/agent-detective/commit/f6d7902300698bacd63dffe9745144611dcfc9cc))
* npm-first CLI with init, release-please, and operator docs ([5bcf1b3](https://github.com/andezdev/agent-detective/commit/5bcf1b3d225cf81d5b0391b52dc94c0a79e34521))
* npm-first CLI with init, release-please, and operator docs ([85905bf](https://github.com/andezdev/agent-detective/commit/85905bf4a73913a9b9e51df80c1c2ce1878c6adb))
* **plugin-system:** add capability-backed services with provider selection ([ee91301](https://github.com/andezdev/agent-detective/commit/ee91301de60aa1073b2244d70dd9f2ec7a65eabf))
* simplify docs and code and configs ([3dff8d2](https://github.com/andezdev/agent-detective/commit/3dff8d2d52758fa2a7828bba5065f629c3919c62))


### Code Refactoring

* **sdk:** split @agent-detective/core into @agent-detective/sdk + types ([8cb5025](https://github.com/andezdev/agent-detective/commit/8cb5025ba57b23ef730334c53824c43486280525))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @agent-detective/process-utils bumped to 1.0.0
    * @agent-detective/sdk bumped to 1.0.0
