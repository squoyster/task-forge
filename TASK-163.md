---
id: TASK-163
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-162
---
# Implement Doctor Fix Mode

## Goal

Make `--fix` perform repairs rather than being a no-op.

## Acceptance Criteria

- [ ] `taskforge doctor --fix` repairs at least one missing or stale managed agent-framework artifact and reports the repair in both human and JSON output.

## Agent Notes
