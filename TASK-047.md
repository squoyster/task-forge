---
id: TASK-047
type: Bug
status: Done
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-045
context_hash: 27705145f76d1ff7
spec_hash: b507e3477c7ff243
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

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)

### 2026-05-22 System
- Task started via taskforge start TASK-047
- Session: 3428c352ed
- Branch: agent/TASK-047-make-start-two-phase-durable-claim-befor--3428c352ed
- Worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-047
