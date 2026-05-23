---
id: TASK-069
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-069: Add OpenCode guard plugin generation

## Goal

Generate .opencode/plugins/taskforge-guard.ts as runtime backstop. Block/warn on: git* by non-doctor agents, direct shell writes to ../task-state, edits under ../task-state/**, edits under tasks/**, any command while .doctor-lock exists, force push. Policy behavior varies by profile: managed=block normal, allow doctor; permissive=warn; locked-down=hard block all.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.
