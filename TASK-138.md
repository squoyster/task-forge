---
id: TASK-138
type: Feature
status: Done
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-135
  - TASK-136
  - TASK-137
context_hash: 2586a35be56df0c8
spec_hash: a06f329f75095fce
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-138
---
# Add Structured Override Metadata for Forced Completion

## Goal

Make exceptional completion explicit, auditable, and non-normal.

## Background

Current task notes show `Task marked Done (forced)` and `Completed despite gate failures — forced.` This is too loose for agentic governance.

## Implementation Notes

- Add a distinct override path rather than overloading normal `Done`.
- Record override reason, actor, timestamp, and failed checks/gates when known.
- Human override should be visible in task frontmatter or structured task metadata.

## Acceptance Criteria

- [x] A forced completion requires a nonempty override reason and records structured override metadata including actor, timestamp, reason, and failed gate names if present. — `src/commands/done.ts` `cmdDone(~L152-173)`: validates `reason` when `force` is true; calls `getCurrentBranch()` and `parseSessionIdFromBranch()` to get actor; filters `gateResults` for failed names; writes `override_reason`, `override_actor`, `override_timestamp`, `override_failed_gates` to task frontmatter via `writeTaskFile()`.

## Agent Notes

### 2026-05-24 System
- Task marked Done (forced)
- Completed despite gate failures — forced.

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-138

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-138

### 2026-05-24 System
- Task claimed via taskforge start TASK-138
- Session: 8bb53bcb17
- Branch: agent/TASK-138-task-138--8bb53bcb17

### 2026-05-24 System
- Task claimed via taskforge start TASK-138
- Session: 8bb53bcb17
- Branch: agent/TASK-138-task-138--8bb53bcb17
