---
id: TASK-140
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn:
  - TASK-139
---
# Add Validate-State Rule for Invalid Done Tasks

## Goal

Make invalid completion fail validation, not just doctor diagnostics.

## Background

`validate-state` should be the stricter state integrity gate used by agents and CI.

## Acceptance Criteria

- [ ] `taskforge validate-state` exits nonzero when any `Done` task has missing, blank, or unchecked acceptance criteria.

## Agent Notes
