---
id: TASK-013
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
---

# TASK-013: Shared task-state branch for ground-truth task storage

## Goal

Replace the `main` branch's `tasks/` directory with a dedicated `task-state` git branch as the single source of truth for all task files. All task read/write operations target a worktree of this branch (`../task-state/`), and every mutation is auto-committed and auto-pushed.

## Background

Currently, task files live in `tasks/` on the `main` branch. Agent worktrees are snapshots of `main` and can't see task files created after the worktree was created. This means agents can't reliably read the current task state from their worktree.

The fix: a shared `task-state` branch whose worktree (`../task-state/`) is always accessible from any agent context (main repo or agent worktree). Every write to a task file triggers an immediate `git add && git commit && git push` so the state propagates instantly.

## Scope

### Files to create/modify

| File | Change |
|---|---|
| `src/util/paths.ts` | Add `getTaskStateDir()` returning `path.resolve(repoRoot, "..", "task-state")` |
| `src/core/git.ts` | Add `ensureTaskStateBranch()` (create branch + worktree), `commitAndPushTaskState()` (add + commit + push from worktree) |
| `src/core/task-store.ts` | Replace all `getTasksDir()` references with `getTaskStateDir()`; export `getTaskStateDir` for callers |
| `src/commands/init.ts` | After config creation, call `ensureTaskStateBranch()` and seed template files |
| `src/commands/deps/create-tasks.ts` | Use `getTaskStateDir()` for file creation |
| **Every command that writes a task** | Call `commitAndPushTaskState()` after any mutation |
| Tests (many files) | Update `makeTaskFile()` to create files in task-state dir instead of `tasks/` |

### Commands that must call `commitAndPushTaskState()`
- `start.ts` — after writing lock fields
- `done.ts` — after clearing lock + updating status
- `block.ts` — after updating status + clearing lock
- `unlock.ts` — after clearing lock
- `sync.ts` — after GitHub sync writes
- `init.ts` — after seeding initial template files
- `deps/create-tasks.ts` — after creating dependency tasks

## Acceptance Criteria

- [ ] `getTaskStateDir()` returns `../task-state` relative to repo root
- [ ] `ensureTaskStateBranch()` creates the `task-state` branch (orphan, with only initial template files) and a worktree at `../task-state`
- [ ] `ensureTaskStateBranch()` is idempotent — no-op if worktree already exists
- [ ] `commitAndPushTaskState()` commits and pushes all changes from the worktree
- [ ] Every command that mutates a task calls `commitAndPushTaskState()`
- [ ] All existing tests pass (after updating `makeTaskFile` paths)
- [ ] No direct `getTasksDir()` usage remains in production code for task I/O
- [ ] `taskforge init` creates the task-state worktree automatically
- [ ] Task files remain readable by `taskforge next`, `list`, `status`, `summary`, etc. after the migration

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-012 (session-based locking) — must be merged first (already Done).

## Risk Level

High — changes the storage layer for ALL task files. Every read/write path must be updated.

## Continuation Policy

Auto-continue unless a stopping condition occurs.
