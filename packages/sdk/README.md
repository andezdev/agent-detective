# @agent-detective/sdk

**Single dependency for agent-detective plugin authors.**

Runtime helpers, service constants, and every plugin-facing type from `@agent-detective/types` — use this package only; do not depend on `@agent-detective/types` directly.

## Install

```bash
npm install @agent-detective/sdk zod
```

Match the major version to your `agent-detective` host release when possible (linked versions in the monorepo).

## Quick start

```typescript
import {
  definePlugin,
  defineRoute,
  registerRoutes,
  zodToPluginSchema,
  REPO_MATCHER_SERVICE,
  type Plugin,
  type PluginContext,
} from '@agent-detective/sdk';
```

## Documentation

- [Extending with plugins](https://agent-detective.chapascript.dev/docs/plugins/extending-with-plugins/) — install and wire plugins
- [Plugin development guide](https://agent-detective.chapascript.dev/docs/plugins/plugins/) — full API and patterns
- [Repository](https://github.com/andezdev/agent-detective)

## License

MIT
