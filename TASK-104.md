---
id: TASK-104
type: Feature
status: Done
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 8c607774d14d0be5
spec_hash: dd1842ebee3eae35
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-104
---

# TASK-104: Add explicit CLI next-action guidance model

## Goal

## Rationalization Roadmap: TASK-RAT-005

### Objective
Every agent-facing command must return explicit guidance about what to do next. Both human-readable and machine-readable.

### Required model
- NextAction interface: code, priority (must/should/may), actor (agent/human/system), command, reason, blocksContinuation
- CommandResult interface: ok, command, data, error, nextActions, auditEventIds

### Required next-action codes
RUN_NEXT_TASK, READ_TASK_SPEC, ENTER_WORKTREE, RUN_GATES, FIX_IMPLEMENTATION_AND_RERUN_GATES, CREATE_BUG_FOR_UPSTREAM_FAILURE, BLOCK_FOR_HUMAN_DECISION, BLOCK_FOR_MISSING_SECRET, RESOLVE_MERGE_CONFLICT, PULL_REBASE_AND_RETRY, RELEASE_TASK_AND_SELECT_NEXT, ATTACH_TRANSCRIPT, CREATE_COMPLETION_REPORT, SUBMIT_FOR_REVIEW, STOP_FOR_HUMAN_REVIEW, CLEANUP_WORKTREE

### Acceptance Criteria
- next/start/claim/gates/block/done/release/sweep/cleanup/report/sync/deps emit next-action guidance
- JSON output has stable nextActions array
- Human output has stable Next: section
- Tests cover success, test failure, push conflict, blocked task, missing provider scenarios

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-104

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-104

### 2026-05-23 System
- Task claimed via taskforge start TASK-104
- Session: 41dd8d4126
- Branch: agent/TASK-104-add-explicit-cli-next-action-guidance-mo--41dd8d4126

### 2026-05-23 System
- Task claimed via taskforge start TASK-104
- Session: 41dd8d4126
- Branch: agent/TASK-104-add-explicit-cli-next-action-guidance-mo--41dd8d4126
