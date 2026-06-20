# Tests — TaskForge

## Purpose

Test suite for all TaskForge modules. Tests cover core engine, CLI commands, agent frameworks, integrations, and utilities.

## Ownership

| Area | Test files | Covers |
|---|---|---|
| Core Engine | `task.test.ts`, `task-store.test.ts`, `task-state-transaction.test.ts`, `task-document.test.ts`, `command-states.test.ts`, `command-result.test.ts`, `status-transition.test.ts`, `state-validator.test.ts`, `validate-state.test.ts`, `validate-state-command-result.test.ts`, `config.test.ts`, `git-facade.test.ts`, `event-log.test.ts`, `hooks.test.ts`, `scheduler.test.ts`, `sweep.test.ts`, `session.test.ts`, `session-state.test.ts`, `continuation.test.ts`, `completion-policy.test.ts`, `agent-registry.test.ts`, `agent-files.test.ts`, `agents-md.test.ts`, `audit.test.ts`, `audit-schema.test.ts`, `cli-audit.test.ts`, `authority.test.ts`, `errors.test.ts`, `opencode-config.test.ts`, `mutation-guard.test.ts`, `guard-status.test.ts`, `templates.test.ts`, `plugins.test.ts`, `closure-task.test.ts`, `promote.test.ts`, `mcp.test.ts`, `pending-publish.test.ts` | Core engine modules in `src/core/` |
| CLI Commands | `commands/block.test.ts`, `commands/done.test.ts`, `commands/init.test.ts`, `commands/list.test.ts`, `commands/new.test.ts`, `commands/next.test.ts`, `commands/start.test.ts`, `commands/status.test.ts`, `commands/summary.test.ts`, `commands/sync.test.ts`, `inspect.test.ts`, `claim.test.ts`, `cleanup.test.ts`, `done.test.ts`, `report.test.ts`, `unlock.test.ts`, `gates.test.ts`, `heartbeat.test.ts`, `status.test.ts`, `summary.test.ts` | CLI command handlers |
| Agent Frameworks | `agent-frameworks.test.ts`, `agent-framework-adapter.test.ts` | Framework adapters |
| Init | `init.test.ts`, `init-opencode.test.ts` | TaskForge initialization |
| Integrations | `integrations/github/projects.test.ts` | GitHub integration |
| Utilities | `exec.test.ts`, `paths.test.ts` | Utility modules |
| Other | `jittered-push.test.ts`, `timeline.test.ts`, `ac-check.test.ts` | Specialized tests |

## Local Contracts

- **Test runner**: Vitest (configured in `package.json` script `"test": "vitest"`).
- **Test pattern**: `tests/**/*.test.ts` — mirrors the `src/` directory structure.
- **Imports**: Use `import { describe, it, expect } from "vitest"`. ESM `.js` extensions for source imports.
- **Naming**: `describe("ModuleName")` and `it("does something specific")`.
- **Coverage**: Every core module + every command handler should have tests.

## Work Guidance

- Write tests before or alongside implementation.
- Use `safeParse` from Zod for schema validation tests.
- Test both happy path and error/edge cases.
- For command tests, test the handler function directly (unit tests).
- Do not write integration tests that require real git/worktrees — mock as needed.
- Mock external services (GitHub API, git) where needed.
- Keep tests independent — no shared mutable state between test files.

## Verification

```bash
npm test -- --run    # Run all tests once (no watch)
```

Run before submitting to ensure no regressions.

## Child DOX Index

- `commands/` — Command handler tests. See `tests/commands/` directory; follows same patterns as parent.
- `integrations/` — Integration tests. See `tests/integrations/` directory; may require GitHub mocking.
