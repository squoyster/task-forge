---
id: TASK-253
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-253: Task-state path resolution breaks from nested worktrees

## Goal

Fix `getTaskStateDir()` to resolve the task-state repository path correctly regardless of which git working directory the command is invoked from (main repo, proper worktree, or nested worktree). Currently the path breaks from nested worktree locations, making all task manipulation commands fail.

## Background

### Design context: ownership assertion is a mutex, not security

TaskForge is designed for multiple agents on different systems. Ground truth is the **task-state branch** (GitHub), updated transactionally with retry/conflict resolution. The ownership assertion in `assertTaskOwnership()` is a **distributed mutex lock** — not a security guardrail:

1. Agent claims a task → gets a unique session ID (`abc123`)
2. Branch is named `agent/TASK-NNN-desc--abc123` — the session ID in the branch name IS the lock identifier
3. `assertTaskOwnership()` verifies "do I (this branch) hold the lock?" by comparing the current branch's embedded session ID against `task.assignee`
4. This prevents two agents on different machines from concurrently modifying the same task

This mutex mechanism is correct and should be preserved. The session ID is embedded in the branch name because branches are local to each agent's clone — no shared state needed for the lock.

### The real bug: path resolution from nested worktrees

During TASK-252 implementation, running `taskforge done TASK-252` from a nested worktree failed not because of the mutex, but because **the command couldn't even find the task-state repo** to check the lock:

1. **`getTaskStateDir()` path resolution breaks from nested worktrees** — `getTaskStateDir(repoRoot)` in `src/util/paths.ts:34` resolves `../task-state` relative to the repo root. When invoked from a nested worktree (e.g., `/Volumes/Transcend/devel/worktrees/task-forge/worktrees/TASK-244/TASK-252`), the resolved path is wrong because `../` from a deeply nested worktree doesn't reach the actual task-state location. It works from the main repo and from properly-located worktrees only because of a symlink at `/Volumes/Transcend/devel/worktrees/task-forge/task-state → /Volumes/Transcend/devel/task-state`.

2. **`getRepoRoot()` is cached process-wide but returns the worktree root** — `getRepoRoot()` in `src/util/paths.ts:13` uses `git rev-parse --show-toplevel` which returns the worktree root, not the main repo root. This value is cached for the process lifetime, so different code paths that need different roots (main repo vs worktree) cannot coexist correctly.

### What NOT to fix

The ownership assertion (`assertTaskOwnership`) is **intentionally** branch-dependent — that's how the mutex works. The session ID in the branch name is the lock key. This must not be changed:

- `done` should still verify the caller holds the lock by checking the current branch
- `start`/`claim` should still check for outstanding sessions via `checkOutstandingSessionTasks()`
- `checkpoint`, `submit`, `diff` should still assert ownership before modifying task work

The only change we already made in TASK-252 (relaxing ownership for cleanup of terminal-state tasks) is compatible with the mutex design because cleanup of a Done task is not a conflicting write — the task is already terminal.

## Acceptance Criteria

- [ ] `getTaskStateDir()` returns the correct path regardless of whether it's called from the main repo, a proper worktree, or a nested worktree
- [ ] All task manipulation commands (`done`, `cleanup`, `start`, `claim`, `release`, `block`, `heartbeat`, `inspect`, `report`, `status`, `list`, `summary`, `new`, `reject`, `unlock`) work correctly when invoked from any git working directory in the same repository
- [ ] The fix does not break worktree-local operations (creating worktrees, checking branch state, running git operations in the worktree)
- [ ] The ownership mutex mechanism continues to work: commands that mutate active tasks still verify the caller's branch session ID matches `task.assignee`
- [ ] All existing tests continue to pass (552 tests)

## Scope

**Allowed:**
- `src/util/paths.ts` — introduce `getMainRepoRoot()` that returns the main repository root (not the worktree root), and use it for task-state path resolution
- `src/util/paths.ts` — decouple task-state path resolution from worktree-dependent `getRepoRoot()`
- Any command file that currently hardcodes `../task-state` resolution (e.g., `src/commands/doctor.ts`)
- `src/core/git.ts` — if task-state path resolution depends on git helper functions

**Disallowed:**
- Changing the ownership mutex mechanism (`assertTaskOwnership`, `checkOutstandingSessionTasks`, session ID format, branch naming convention)
- Changing how `git worktree` commands work
- Any behavioral changes to task state machines or command semantics

## Test / Verification Command

```bash
# 1. Verify from main repo
cd /Volumes/Transcend/devel/task-forge
npx taskforge status TASK-252   # Should find the task

# 2. Verify from a proper worktree
cd /Volumes/Transcend/devel/worktrees/task-forge/TASK-252
npx taskforge status TASK-252   # Should find the task

# 3. Verify from a nested worktree (this currently breaks)
# Create a nested worktree to reproduce the bug
git worktree add ../nested-worktree-test agent/TASK-252-normal-agents-cannot-clean-up-done-task--31be71bad1
cd ../nested-worktree-test
npm install --silent
npx taskforge status TASK-252   # Should find the task (currently fails)

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

Full analysis from TASK-252 session. Commands marked "intentional mutex" are branch-dependent by design — the session ID in the branch name is the distributed lock key. These should NOT be changed.

| Command | Branch-Dependent? | Intentional? | What Depends on Branch |
|---|---|---|---|
| `done` | Yes | ✅ Intentional mutex | `assertTaskOwnership()` verifies caller holds the lock |
| `claim` | Yes | ✅ Intentional mutex | `checkOutstandingSessionTasks()` prevents double-claim |
| `start` | Yes | ✅ Intentional mutex | `checkOutstandingSessionTasks()` prevents double-claim |
| `cleanup` | No | N/A | Uses stored task.worktree/branch fields (already branch-invariant) |
| `checkpoint` | Yes | ✅ Intentional mutex | `assertTaskOwnership()` + refuses to commit on main/task-state |
| `submit` | Partial | ✅ Intentional | Refuses to push if task.branch is main/task-state |
| `diff` | Yes | ✅ Intentional mutex | `assertTaskOwnership()` |
| `release` | Yes | ✅ Intentional mutex | `assertTaskOwnership()` unconditionally |
| `block` | Yes | ✅ Intentional mutex | `assertTaskOwnership()` when assignee is set |
| `heartbeat` | Yes | ✅ Intentional mutex | `assertTaskOwnership()` unless --force |
| `unlock` | No | N/A | Relies on --force with authority check |
| `reject` | No | N/A | Just updates status (no lock needed) |
| `inspect` | No | N/A | Uses stored task.branch (read-only) |
| `next` | Yes | ✅ Intentional mutex | `checkOutstandingSessionTasks()` prevents ghost claims |
| `status`, `list`, `summary` | No | N/A | Read-only, just loads task files |
| `doctor` | No | N/A | But inspects all worktrees |
