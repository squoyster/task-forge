---
id: TASK-142
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-141
---
# Make Gates Emit Fix-Current-Task Next Action on Test Failure

## Goal

Tell agents to fix local failures before moving on.

## Background

When a gate fails because of the current task, the agent should repair the issue and rerun gates.

## Acceptance Criteria

- [ ] `taskforge gates --json` emits `nextAction.kind = "FIX_CURRENT_TASK"` when any configured gate fails and no upstream-failure override is supplied.

## Agent Notes
