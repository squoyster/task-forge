---
id: TASK-259
type: Feature
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: c080af5e5dced1dc
---

# TASK-259: PREVENT NESTED WORKTREES AND CROSS-TASK BRANCH ANCESTRY

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Backlog cleared for TaskForge Slimming Refactor focus.


## Problem

Task worktrees were created relative to the current task worktree, producing nested paths and branches based on unrelated task branches. This contaminated pull requests with commits from another task.

## Task Description

Make worktree placement and branch creation independent of the caller\'s current working directory.

TaskForge must derive worktree roots from canonical repository metadata and must create normal task branches from the configured integration branch unless explicit stacked-task mode is selected.

## Agentic Implementation Prompt

> Correct TaskForge worktree and branch-base resolution.
>
> Resolve the canonical repository identity using Git\'s common directory and TaskForge repository configuration, not cwd.
>
> Place every normal task worktree directly beneath the configured repository worktree root:
>
> <configured-worktree-root>/<repository-id>/<task-id>
>
> Before creation, reject targets that are: inside the main worktree, inside another linked worktree, nested beneath another task worktree, outside the configured worktree root, already associated with a different task.
>
> Create normal task branches from the latest configured remote integration branch. Do not use the current task branch as an implicit base.
>
> If stacked tasks are supported, require explicit mode, explicit parent task, and recorded dependency metadata. Stacking must never occur accidentally because the agent ran start from another worktree.

## Scope

**Include:**
- Canonical repository/worktree-root resolution.
- Target-path validation.
- Base branch fetch/resolve policy.
- Recorded base SHA and merge-base provenance.
- Explicit stacked-task mode or explicit rejection if unsupported.

**Exclude:**
- PR lifecycle semantics.
- General cleanup policy.

## Acceptance Criteria

1. Worktree target paths are independent of cwd.
2. A task started from another task worktree is still created at the canonical root.
3. Nested worktree targets are rejected.
4. Normal task branches are based on the configured remote integration branch.
5. Task metadata records: base branch, base SHA, branch creation SHA, repository identity, canonical worktree path.
6. Submission validates that the branch\'s ancestry is consistent with recorded provenance.
7. Unrelated task commits are detected before submission.
8. Stacked-task mode, if supported, requires explicit invocation and parent dependency metadata.
9. Existing nested worktrees are detected by reconciliation.
10. Path behavior works with: main worktree invocation, linked worktree invocation, symlinked path, relative path, multiple repositories with the same directory name.
11. Concurrent starts cannot allocate the same worktree path.
12. Failure leaves no orphan branch or partial worktree.

## Required Tests

- Start from main worktree.
- Start from task worktree.
- Attempt nested target.
- Stale local main versus updated origin/main.
- Duplicate task start.
- Same repository name in different locations.
- Explicit stack mode.
- Unrelated inherited commits.

## Completion Evidence

- Path resolution specification.
- Branch provenance schema.
- Examples proving start behavior is invariant across caller directories.

## Dependencies

TASK-258 (Enforce the TaskForge Mutation Boundary) recommended, not strictly required.

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
