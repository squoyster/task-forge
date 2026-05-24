---
id: TASK-136
type: Bug
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-135
assignee: 1711b15b37
claimed_at: '2026-05-24 00:32:56'
context_hash: 3bbf09c32badaf02
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

### 2026-05-24 System
- Task claimed via taskforge start TASK-136
- Session: 1711b15b37
- Branch: agent/TASK-136-task-136--1711b15b37

### 2026-05-24 System
- Task claimed via taskforge start TASK-136
- Session: 1711b15b37
- Branch: agent/TASK-136-task-136--1711b15b37
