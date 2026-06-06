# Changelog

## [1.0.0](https://github.com/andezdev/agent-detective/compare/pr-pipeline-v0.1.0...pr-pipeline-v1.0.0) (2026-06-06)


### ⚠ BREAKING CHANGES

* **sdk:** createTagDescription are no longer exported (host-internal).

### Features

* add option to enable or disable jira-adapter plugin ([eba9573](https://github.com/andezdev/agent-detective/commit/eba9573ffab53e01d34ebf63f6296a9e6322f005))
* graceful shutdown, AgentOutput with threadId/usage, PR summary & analytics ([f6d7902](https://github.com/andezdev/agent-detective/commit/f6d7902300698bacd63dffe9745144611dcfc9cc))
* **linear:** adapter scaffold, tracker port, signed webhooks ([15a2bf7](https://github.com/andezdev/agent-detective/commit/15a2bf7c50a8315b855947f732c0d5f0521783c3))
* npm-first CLI with init, release-please, and operator docs ([5bcf1b3](https://github.com/andezdev/agent-detective/commit/5bcf1b3d225cf81d5b0391b52dc94c0a79e34521))
* npm-first CLI with init, release-please, and operator docs ([85905bf](https://github.com/andezdev/agent-detective/commit/85905bf4a73913a9b9e51df80c1c2ce1878c6adb))
* triage step, image attachments, comment threading & fixes for pr-pipeline ([1e0ddf8](https://github.com/andezdev/agent-detective/commit/1e0ddf8135f4b5c8f1623c394a5b56e2872d9bd0))


### Bug Fixes

* **KAN-18:** Best pr-pipeline workflow ([b9b4ccf](https://github.com/andezdev/agent-detective/commit/b9b4ccf70a5fa63cbdfa0392d7cc6d49e1297a32))


### Code Refactoring

* **sdk:** split @agent-detective/core into @agent-detective/sdk + types ([8cb5025](https://github.com/andezdev/agent-detective/commit/8cb5025ba57b23ef730334c53824c43486280525))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @agent-detective/process-utils bumped to 1.0.0
    * @agent-detective/sdk bumped to 1.0.0
