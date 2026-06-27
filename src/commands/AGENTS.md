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
| `claim` | `claim.ts` | Claim a task for work (atomic state-only; worktree is direct-git) |
| `config-validate` | `config-validate.ts` | Validate config |
| `doctor` | `doctor.ts` | Diagnostics and recovery |
| `done` | `done.ts` | Complete a task (state transition only; no worktree/branch deletion) |
| `gates` | `gates.ts` | Run verification gates |
| `guard-cmd` | `guard-cmd.ts` | Mutation guard management |
| `heartbeat` | `heartbeat.ts` | Agent lease refresh |
| `init` | `init.ts` | Initialize TaskForge in a repo |
| `inspect` | `inspect.ts` | Inspect a task |
| `list` | `list.ts` | List tasks |
| `mcp` | `mcp.ts` | Typed task/state MCP server: 7 tools + 2 read-only resources; no shell/git/proxy. OFF unless `TASKFORGE_WITH_MCP=1` |
| `new` | `new.ts` | Create a new task |
| `next` | `next.ts` | Get next task to work on |
| `promote` | `promote.ts` | Promote task status |
| `prompt` | `prompt.ts` | Show agent prompt |
| `reject` | `reject.ts` | Reject a task |
| `release` | `release.ts` | Release a task claim |
| `report` | `report.ts` | Generate report |
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
- **CLI surface classification** (TF-SIMP-05): default `--help` exposes only entry commands (`init`, `next`, `prompt`, `inspect`, `list`, `new`, `update`, `gates`, `validate-state`, `doctor`). All others are registered with `{ hidden: true }` (callable, not advertised) — see `VISIBLE_COMMANDS` / `HIDDEN_COMMANDS` in `cli.ts`. `sync`/`deps` gate on `TASKFORGE_WITH_DEPS`; `mcp` gates on `TASKFORGE_WITH_MCP`. `next --json` is the discovery entry point for hidden commands.
- Delegate business logic to `src/core/` modules — command handlers are thin adapters.
- Return structured `CommandResult` objects, never raw console output.
- **MCP command** (`mcp.ts`, TF-EMBED-02): exposes exactly 7 typed tools (`next`, `get_task`, `claim`, `block`, `complete`, `gates`, `validate_state`) returning `structuredContent` (a `TaskForgeCommandResult`, passthrough schema). Mutations reuse the CLI command core via `runCommandForResult` (`src/core/mcp-contract.ts`) — no mutation logic is duplicated, no shell/git/worktree/branch/push proxies exist. Two resources: `taskforge://workflow` and `taskforge://task/{taskId}` (read-only). `taskId` is an opaque token; path traversal is rejected.
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
