---
id: TASK-159
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-152
---
# Stop Silently Swallowing Audit Write Failures

## Goal

Make audit failure visible.

## Acceptance Criteria

- [ ] Audit write failures are reported through a visible diagnostic path unless audit failure suppression is explicitly enabled in config.

## Agent Notes
