---
id: TASK-215
type: Task
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 5c980e7f58
claimed_at: '2026-05-28 00:04:03'
context_hash: 59fb9e1c3f61b3b7
branch: agent/TASK-215-comprehensive-error-handling-and-actiona--5c980e7f58
---

# TASK-215: Comprehensive error handling and actionable guidance for all commands

## Goal

**Bugs to fix:**
1. `taskforge new` silently swallows push errors via `commitAndPushTaskState()` — task exists locally but not on remote
2. `taskforge start` and `taskforge claim` write to local task-state files BEFORE transaction push, causing inconsistent state if push fails

**Feature: Uncommitted-worktree detection**
When an agent invokes `taskforge next` or `taskforge start` with uncommitted changes in their worktree:
- If current task is NOT blocked → tell agent to complete current task first
- If current task IS blocked → tell agent to commit changes, then accept next task that resolves block; if no resolving task, continue with next available task

**Feature: Comprehensive guidance model**
Every command must return appropriate, specific guidance for both success and failure paths:
- Happy path: clear next steps
- Known error cases: actionable recovery guidance
- Unhandled error cases: direct agent to create new task for the case, asking for human input if correct action cannot be cleanly inferred

**Implementation:**
- Add `checkUncommittedChanges()` utility that scans worktrees for dirty state
- Wire into `next`, `start`, `claim` commands
- Migrate `new` to use `withTaskStateTransaction` instead of `commitAndPushTaskState`
- Fix `start` and `claim` to move all file writes inside transaction
- Add structured error codes and guidance messages for all non-happy-path conditions
- Add tests for all new error paths

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-28 System
- Task claimed via taskforge start TASK-215
- Session: 5c980e7f58
- Branch: agent/TASK-215-comprehensive-error-handling-and-actiona--5c980e7f58
