# CLI Commands — TaskForge

## Purpose

Command handlers implement every `taskforge` CLI subcommand. Each file in this directory is a standalone command handler that delegates to core modules and returns a `CommandResult`. The `deps/` subdirectory contains dependency management commands.

## Ownership

| Command | File | Responsibility |
|---|---|---|
| `ac-check` | `ac-check.ts` | Verify acceptance criteria completeness |
| `agents` | `agents.ts` | Agent registry management |
| `audit` | `audit.ts` | Show audit log |
| `block` | `block.ts` | Mark task as blocked |
| `claim` | `claim.ts` | Claim a task for work |
| `cleanup` | `cleanup-cmd.ts` | Clean up stale worktrees/branches |
| `config-validate` | `config-validate.ts` | Validate config |
| `doctor` | `doctor.ts` | Diagnostics and recovery |
| `done` | `done.ts` | Complete a task |
| `gates` | `gates.ts` | Run verification gates |
| `git-facade` | `git-facade.ts` | TaskForge-aware git operations |
| `guard-cmd` | `guard-cmd.ts` | Mutation guard management |
| `heartbeat` | `heartbeat.ts` | Agent lease refresh |
| `init` | `init.ts` | Initialize TaskForge in a repo |
| `inspect` | `inspect.ts` | Inspect a task |
| `list` | `list.ts` | List tasks |
| `mcp` | `mcp.ts` | MCP server mode |
| `new` | `new.ts` | Create a new task |
| `next` | `next.ts` | Get next task to work on |
| `promote` | `promote.ts` | Promote task status |
| `prompt` | `prompt.ts` | Show agent prompt |
| `reject` | `reject.ts` | Reject a task |
| `release` | `release.ts` | Release a task claim |
| `report` | `report.ts` | Generate report |
| `resume` | `resume.ts` | Resume work on task |
| `start` | `start.ts` | Start working on a task |
| `status` | `status.ts` | Show project status |
| `summary` | `summary.ts` | Show project summary |
| `sweep` | `sweep.ts` | Sweep stale agents |
| `sync` | `sync.ts` | Sync task state with GitHub |
| `unlock` | `unlock.ts` | Unlock a task |
| `update` | `update.ts` | Update task fields |
| `validate-state` | `validate-state.ts` | Validate task state |

### Subdirectory: `deps/`

| Command | File | Responsibility |
|---|---|---|
| `audit-cmd` | `deps/audit-cmd.ts` | Dependency audit command |
| `audit` | `deps/audit.ts` | Security audit logic |
| `create-tasks` | `deps/create-tasks.ts` | Create tasks from audit results |
| `deprecated-cmd` | `deps/deprecated-cmd.ts` | Deprecated package check |
| `deprecated` | `deps/deprecated.ts` | Deprecated package logic |
| `outdated-cmd` | `deps/outdated-cmd.ts` | Outdated package command |
| `outdated` | `deps/outdated.ts` | Outdated package logic |
| `plan` | `deps/plan.ts` | Remediation planning |
| `pr` | `deps/pr.ts` | Automated PR creation |
| `scan` | `deps/scan.ts` | Dependency scanning |
| `summary` | `deps/summary.ts` | Dependency summary |

## Local Contracts

- Every command handler exports a default function that accepts arguments and returns `Promise<CommandResult>`.
- Use `commander` for argument parsing (defined in `src/cli.ts`).
- Delegate business logic to `src/core/` modules — command handlers are thin adapters.
- Return structured `CommandResult` objects, never raw console output.
- Handle errors with `TaskForgeError` subclasses; let the CLI layer catch and format.

## Work Guidance

- One command per file. Keep handlers focused and thin.
- Use `src/util/json-result.ts` for JSON output formatting.
- Follow the existing pattern: parse args → validate → delegate to core → return CommandResult.
- Commands that create/modify state must emit audit events via `src/core/audit.ts`.

## Verification

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsup
```

Relevant tests in `tests/commands/` and `tests/` for each command.

## Child DOX Index

- `deps/` — Dependency management command group. See `deps/` directory for files; no child AGENTS.md.
