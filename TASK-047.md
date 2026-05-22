---
id: TASK-047
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-045
---

# TASK-047: Make `start` Two-Phase — Durable Claim Before Worktree Creation

## Goal

Refactor `taskforge start` so it durably claims the task (pushes to remote) BEFORE creating the worktree/branch. Current flow creates the worktree before claim push confirmation, which can leave orphan worktrees on failure.

## Two-Phase Flow

**Phase 1 — Claim:** Pull → sweep → check doctor lock → load task → validate → claim → PUSH. If push fails, abort — no worktree created.

**Phase 2 — Workspace:** Only after claim push succeeds → create worktree/branch → record metadata → push metadata.

## Acceptance Criteria

- [ ] `start` does not create a worktree before durable claim success
- [ ] Failed claim push leaves no orphan worktree
- [ ] Worktree metadata persisted only after workspace creation
- [ ] Failure modes clear in human and JSON output
- [ ] All existing tests pass

## Dependencies

TASK-045.

## Risk Level

Medium.
