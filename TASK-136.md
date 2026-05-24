---
id: TASK-136
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-135
---
# Reject Done Transition When AC Items Are Blank

## Goal

Prevent tasks with placeholder AC entries from being marked `Done`.

## Background

Many task files contain only `- [ ]` under ACs. That is not a verifiable acceptance condition.

## Implementation Notes

- Treat blank checkbox text as invalid.
- Include line/section context in the error where practical.

## Acceptance Criteria

- [ ] `taskforge done TASK-ID` refuses to complete a task containing any blank acceptance criterion checkbox such as `- [ ]` or `- [x]` with no criterion text.

## Agent Notes
