---
id: TASK-138
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-135
  - TASK-136
  - TASK-137
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
