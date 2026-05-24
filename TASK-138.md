---
id: TASK-138
type: Feature
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-135
  - TASK-136
  - TASK-137
assignee: 8bb53bcb17
claimed_at: '2026-05-24 00:47:55'
context_hash: 2586a35be56df0c8
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

- [ ] A forced completion requires a nonempty override reason and records structured override metadata including actor, timestamp, reason, and failed gate names if present.

## Agent Notes

### 2026-05-24 System
- Task claimed via taskforge start TASK-138
- Session: 8bb53bcb17
- Branch: agent/TASK-138-task-138--8bb53bcb17

### 2026-05-24 System
- Task claimed via taskforge start TASK-138
- Session: 8bb53bcb17
- Branch: agent/TASK-138-task-138--8bb53bcb17
