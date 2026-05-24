---
id: TASK-137
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-135
---
# Reject Done Transition When AC Items Are Unchecked

## Goal

Prevent incomplete ACs from being bypassed.

## Background

A task cannot be considered complete while one or more explicit acceptance criteria remain unchecked.

## Implementation Notes

- Detect Markdown checkboxes under `## Acceptance Criteria`.
- Require all nonblank criteria to be checked before `Done`.

## Acceptance Criteria

- [ ] `taskforge done TASK-ID` refuses to complete a task when any nonblank acceptance criterion under `## Acceptance Criteria` remains unchecked.

## Agent Notes
