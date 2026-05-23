---
id: TASK-098
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-098: Fix taskforge checkpoint/submit/diff from within agent worktrees

## Goal

## Background

AGENTS.md line 78 mandates that agents use facade commands instead of raw git:
- `taskforge checkpoint` (replaces `git commit`)
- `taskforge submit` (replaces `git push`)
- `taskforge diff` (read-only diff)

But these commands rely on `getRepoRoot()` which returns `process.cwd()`. When run from within an agent worktree (e.g., `../worktrees/task-forge/TASK-NNN/`), `getTaskStateDir()` resolves `../task-state` relative to the worktree path, producing `../worktrees/task-forge/task-state/` instead of the correct `../task-state/`.

This means `loadTaskById()` fails, and the facade commands cannot find the task. Agents are forced to fall back to raw `git commit`, `git push`, and `git worktree remove` — directly violating the rule.

The real root is there are two `task-state` directories needed:
1. Per-project task-state (at `<project-parent>/task-state/`, sibling to main repo)
2. The worktree's own CWD

The `getRepoRoot` function needs to distinguish between running from the main repo vs from a worktree, and resolve paths to the main repo's context.

## Fix

Option A: Make `getRepoRoot()` walk up to find the real repo root by detecting `.taskforge/` directory presence.

Option B: Have the facade commands detect they are in a worktree and resolve to the main repo using `git worktree list` or `git rev-parse --git-common-dir`.

Option C: Store the repo root in the task frontmatter during `start` and have facade commands read it from there.

## Scope

- `src/util/paths.ts` — `getRepoRoot()` should detect and resolve worktree context
- `src/commands/git-facade.ts` — verify all facade commands work from worktrees
- `tests/paths.test.ts` — add worktree-relative path tests
- `tests/git-facade.test.ts` — add worktree-context tests

## Acceptance Criteria

- [ ] `taskforge checkpoint TASK-XXX` works from within the task's worktree directory
- [ ] `taskforge diff TASK-XXX` works from within the task's worktree directory
- [ ] `taskforge submit TASK-XXX` works from within the task's worktree directory
- [ ] `getRepoRoot()` returns the main repo root when called from a worktree subdirectory
- [ ] No regression in path resolution when called from main repo context

## Acceptance Criteria

- [ ]

## Agent Notes
