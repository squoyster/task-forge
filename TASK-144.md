---
id: TASK-144
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn:
  - TASK-141
---
# Add Block-for-Human Next Action

## Goal

Give agents a clear stop condition for ambiguous, unsafe, or human-decision-required cases.

## Acceptance Criteria

- [ ] Any command that detects a required human decision emits `nextAction.kind = "BLOCK_FOR_HUMAN"` and `nextAction.stop = true` in JSON output.

## Agent Notes
