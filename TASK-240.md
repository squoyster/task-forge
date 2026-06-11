---
id: TASK-240
type: Task
status: Done
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 1e6ebeb577972c85
spec_hash: eea59ec74268aa9e
branch: agent/TASK-240-allow-task-state-updates-via-taskforge-c--f021eeb375
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-240
---

# TASK-240: Allow task-state updates via TaskForge CLI without requiring PR approval

## Goal

Task-state updates should flow through the TaskForge CLI transaction layer without requiring a PR or human approval. Agents must never update task-state directly — only via the TaskForge facade.

## Problem

Currently task-state lives on a dedicated git branch and changes require PRs to merge. This creates friction: agents must wait for human approval for every task-state mutation (status changes, AC updates, agent notes, etc.), which are routine and safe operations.

## Required Changes

### 1. Direct Task-State Push via Transaction Layer
- The `withTaskStateTransaction()` wrapper should auto-commit and auto-push task-state changes to the `task-state` branch on origin
- No PR required — task-state mutations are programmatic, validated, and reversible
- Every mutation goes through the CLI facade, never direct git

### 2. Agent Facade Enforcement
- Agents must use TaskForge CLI commands for ALL task-state changes:
  - `taskforge claim`, `taskforge start`, `taskforge done`, `taskforge block`, `taskforge release`, etc.
  - `taskforge checkpoint` for worktree commits
  - `taskforge submit` for pushing worktree branches
- Direct git operations on task-state are forbidden (document in AGENTS.md)

### 3. Bypass PR Requirement for task-state Branch
- Configure branch protection to allow direct pushes to `task-state` from the CLI
- Or: the transaction layer pushes directly without creating a PR
- PRs remain required for `main` branch changes (agent worktrees)

### 4. Audit Trail
- Every task-state mutation is logged via the audit system
- Transaction log includes: command, timestamp, session ID, task ID, before/after state
- Reversible: each mutation can be undone via the transaction log

## Acceptance Criteria

- [x] `withTaskStateTransaction()` auto-commits and auto-pushes to task-state branch — `src/core/task-state-transaction.ts` lines 146-157: commits then pushes directly via git push origin task-state
- [x] No PR is created for task-state-only changes — transaction layer pushes directly to task-state branch, no PR workflow involved
- [x] AGENTS.md explicitly forbids direct git operations on task-state — AGENTS.md lines 127-155: Git Operations Matrix shows task-state direct git as ❌
- [x] All task-state mutations go through CLI facade commands — documented in AGENTS.md Agent Discipline section 1 and Git Operations Matrix
- [x] Audit log records every task-state mutation with session ID and command — `src/core/event-log.ts` eventLogEvent includes sessionId and command from transaction options; `src/core/task-state-transaction.ts` TransactionImpl passes actor/command to appendEvent
- [x] Test coverage for transaction layer push behavior — `tests/task-state-transaction.test.ts`: 14 tests including push-directly-without-PR and session-ID-in-event-log tests
- [x] Branch protection or CI allows direct pushes to task-state branch — task-state branch currently allows direct pushes (verified by recent commits pushed by transaction layer). GitHub branch protection rules should be configured to allow this permanently.


## Agent Notes

### 2026-05-28 System
- Task marked Done

### 2026-05-28 System
- Report generated — task moved to Review
- Changed files: package-lock.json, src/core/event-log.ts, src/core/task-state-transaction.ts, tests/task-state-transaction.test.ts
- Commits: 3e54314 TASK-240: Enable task-state direct updates via CLI facade
- AC section: present

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-240

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-240

### 2026-05-28 System
- Task claimed via taskforge start TASK-240
- Session: f021eeb375
- Branch: agent/TASK-240-allow-task-state-updates-via-taskforge-c--f021eeb375
