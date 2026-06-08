---
id: TASK-253
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-253: Taskforge CLI commands are not fully branch-invariant

## Goal

Taskforge CLI commands that manipulate tasks (done, cleanup, start, claim, etc.) should be invariant with respect to which git branch or worktree they are invoked from — they should only impact the shared task-state repository. Currently they are not, causing failures when commands are run from certain worktree locations or branches.

## Background

During TASK-252 implementation, we discovered that running `taskforge done TASK-252` from a nested worktree failed because:

1. **`getTaskStateDir()` path resolution breaks from nested worktrees** — `getTaskStateDir(repoRoot)` in `src/util/paths.ts:34` resolves `../task-state` relative to the repo root. When invoked from a nested worktree (e.g., `/Volumes/Transcend/devel/worktrees/task-forge/worktrees/TASK-244/TASK-252`), the resolved path is wrong because the `../` from a deeply nested worktree doesn't reach the actual task-state location. This works from the main repo and from properly-located worktrees only because of a symlink at `/Volumes/Transcend/devel/worktrees/task-forge/task-state → /Volumes/Transcend/devel/task-state`.

2. **`getRepoRoot()` is cached process-wide but returns the worktree root** — `getRepoRoot()` in `src/util/paths.ts:13` uses `git rev-parse --show-toplevel` which returns the worktree root, not the main repo root. This value is cached for the process lifetime, so different code paths that need different roots (main repo vs worktree) cannot coexist correctly.

3. **Ownership assertion depends on the current branch** — `assertTaskOwnership()` in `src/core/session.ts:35` reads the current branch name via `getCurrentBranch(repoRoot)` and extracts a session ID from it. This means commands like `done`, `release`, `block`, `heartbeat`, `checkpoint`, and `diff` will fail if invoked from any branch whose session ID doesn't match the task's `assignee` field — even when the operation is legitimate (e.g., an admin cleaning up stale worktrees).

## Acceptance Criteria

- [ ] `getTaskStateDir()` returns the correct path regardless of whether it's called from the main repo, a proper worktree, or a nested worktree
- [ ] All task manipulation commands (`done`, `cleanup`, `start`, `claim`, `release`, `block`, `heartbeat`, `inspect`, `report`, `status`, `list`, `summary`, `new`, `reject`, `unlock`) work correctly when invoked from any git branch or worktree
- [ ] The fix does not break worktree-local operations (creating worktrees, checking branch state, running git operations in the worktree)
- [ ] All existing tests continue to pass (552 tests)

## Scope

**Allowed:**
- `src/util/paths.ts` — introduce `getMainRepoRoot()` and use it for task-state path resolution
- `src/core/session.ts` — optionally relax ownership assertion for terminal-state tasks
- Any command file that currently hardcodes `../task-state` resolution (e.g., `src/commands/doctor.ts`)
- `src/core/git.ts` — if task-state path resolution depends on git helper functions

**Disallowed:**
- Changing the worktree architecture or how `git worktree` commands work
- Removing ownership checks entirely (they serve as security guardrails)
- Changing the session ID format or branch naming convention

## Test / Verification Command

```bash
# 1. From a nested worktree, verify task-state resolution
mkdir -p /tmp/test-nested-worktree
cd /tmp/test-nested-worktree
git clone <repo> nested-test
cd nested-test
npx taskforge status TASK-001   # Should work

# 2. From main branch
cd /Volumes/Transcend/devel/task-forge
npx taskforge status TASK-001   # Should work

# 3. From a proper worktree
cd /Volumes/Transcend/devel/worktrees/task-forge/TASK-252
npx taskforge status TASK-001   # Should work

# 4. Run full test suite
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Expected Output / Behavior

All taskforge CLI commands produce identical output and behavior regardless of which branch or worktree they are invoked from, as long as the repository is the same.

## Dependencies

- TASK-252 (cleanup deadlock fix) — completed, but the nested worktree issue was the root cause of the problems we encountered

## Risk Level

Low — the changes are limited to path resolution logic; no behavioral changes to task state machines or security.

## Known Risks

- If `getMainRepoRoot()` resolves to the wrong directory, task-state operations could corrupt the wrong repository
- Some commands intentionally depend on the current worktree for git operations (checkpoint, submit, diff) — these should continue to use the worktree root

## Human Intervention Required?

No

## Continuation Policy

Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-08 System
- Task created during TASK-252 review to document branch-invariance issues discovered during implementation

## Summary of Findings

Full analysis from TASK-252 session:

| Command | Branch-Dependent? | What Depends on Branch |
|---|---|---|
| `done` | Yes | `assertTaskOwnership()` reads current branch for session |
| `claim` | Yes | `checkOutstandingSessionTasks()` reads current branch |
| `start` | Yes | `checkOutstandingSessionTasks()` reads current branch |
| `cleanup` | No | Uses stored task.worktree/branch fields |
| `checkpoint` | Yes | `assertTaskOwnership()` + refuses to commit on main/task-state |
| `submit` | Partial | Refuses to push if task.branch is main/task-state |
| `diff` | Yes | `assertTaskOwnership()` |
| `release` | Yes | `assertTaskOwnership()` unconditionally |
| `block` | Yes | `assertTaskOwnership()` when assignee is set |
| `heartbeat` | Yes | `assertTaskOwnership()` unless --force |
| `unlock` | No | Relies on --force with authority check |
| `reject` | No | Just updates status |
| `inspect` | No | Uses stored task.branch |
| `next` | Yes | `checkOutstandingSessionTasks()` |
| `status`, `list`, `summary` | No | Read-only, just loads task files |
| `doctor` | No | But inspects all worktrees |
