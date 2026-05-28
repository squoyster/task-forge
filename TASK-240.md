---
id: TASK-240
type: Task
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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

- [ ] `withTaskStateTransaction()` auto-commits and auto-pushes to task-state branch
- [ ] No PR is created for task-state-only changes
- [ ] AGENTS.md explicitly forbids direct git operations on task-state
- [ ] All task-state mutations go through CLI facade commands
- [ ] Audit log records every task-state mutation with session ID and command
- [ ] Test coverage for transaction layer push behavior
- [ ] Branch protection or CI allows direct pushes to task-state branch

## Acceptance Criteria

- [ ]

## Agent Notes
