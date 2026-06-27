# Core Engine — TaskForge

## Purpose

The core engine implements the TaskForge state machine, task lifecycle, git operations, audit trail, hooks system, configuration, agent registry, and session management. It is the heart of TaskForge — all CLI commands delegate to core modules.

## Ownership

| Module | File(s) | Responsibility |
|---|---|---|
| State Machine | `command-states.ts`, `status-transition.ts` | Task lifecycle state machine, CommandResult type, next-action guidance |
| Task Model | `task.ts`, `task-store.ts`, `task-state-transaction.ts` | Task schema (Zod), CRUD, state transitions with invariants |
| Task Documents | `task-document.ts` | Markdown task file parsing and generation |
| Git | `git.ts` | Worktree creation, branch management, commits, pushes, diff |
| Audit | `audit.ts`, `audit-schema.ts`, `audit-plugin.ts`, `cli-audit.ts`, `init-audit.ts` | Event logging, audit trail schema, CLI audit |
| Hooks | `hooks.ts` | Pre/post command hooks |
| Agent Registry | `agent-registry.ts`, `agent-files.ts` | Agent identity, heartbeat, stale detection |
| Config | `config.ts` | TaskForge configuration loading and validation |
| Agent Framework Adapter | `agent-framework-adapter.ts`, `guidance-adapter.ts` | OpenCode/generic framework integration |
| Agent Metadata | `agents-md.ts` | AGENTS.md file management |
| Doctor Lock | `doctor-lock.ts` | Exclusive doctor recovery lock |
| State Validation | `state-validator.ts` | Validate entire task state for consistency |
| Session | `session.ts`, `session-state.ts` | Per-agent session tracking |
| Result Builder/Renderer | `result-builder.ts`, `result-renderer.ts` | Build and format CommandResult for CLI output |
| Next Command Maps | `next-command-maps.ts` | Map current state to valid next commands |
| Continuation | `continuation.ts`, `completion-policy.ts` | Auto-continuation policy enforcement |
| Control Files | `control-files.ts` | Runtime control file management |
| Scheduler | `scheduler.ts` | Task scheduling logic |
| Sweeper | `sweeper.ts` | Stale agent/worktree cleanup |
| Guard Plugin | `guard-plugin.ts`, `mutation-guard.ts` | Mutation protection and override management |
| PR Verifier | `pr-verifier.ts` | Pull request verification |
| Pending Publish | `pending-publish.ts` | Track un-pushed task creations for recovery |
| Templates | `templates.ts` | Task template rendering |
| OpenCode Config | `opencode-config.ts` | OpenCode configuration sync |
| Errors | `errors.ts` | TaskForgeError hierarchy |
| Event Log | `event-log.ts` | Structured event logging |
| Closure Task | `closure-task.ts` | Auto-create tasks for error states |
| Authority | `authority.ts` | Agent authorization |
| Init Audit | `init-audit.ts` | Initialization audit |

## Local Contracts

- **CommandResult** (`command-states.ts`): Every command returns `{ ok, state, nextAction, guidance, errorCode?, context? }`. The `nextAction` drives agent behavior.
- **Task Schema** (`task.ts`): All tasks validated with Zod. Status transitions follow the state machine in `command-states.ts`.
- **Git Operations** (`git.ts`): All git mutations go through this module. No direct git commands outside this file.
- **Audit Trail** (`audit.ts`): Every state change, command, and lifecycle event is logged.
- **Error Handling** (`errors.ts`): Use structured `TaskForgeError` subclasses. Never throw raw `Error`.
- **Config** (`config.ts`): Configuration loaded from `.taskforge/config.json`.
- **Agent Registry** (`agent-registry.ts`): Agents must heartbeat to maintain lease. Stale agents are swept.

## Work Guidance

- All core modules are ESM with `.js` extensions in imports.
- Zod for all runtime validation.
- No `any` — use `unknown` with narrowing.
- State transitions must go through `task-state-transaction.ts`.
- Audit events before mutating state.
- New core features must add tests in `tests/`.

## Verification

```bash
npm run typecheck   # tsc --noEmit
npm run build       # tsup
```

All core modules have corresponding tests in `tests/`. See `tests/AGENTS.md` for testing standards.

## Child DOX Index

No children — this is a leaf directory.
