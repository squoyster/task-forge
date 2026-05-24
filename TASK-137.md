---
id: TASK-137
type: Bug
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-135
assignee: d796203029
claimed_at: '2026-05-24 00:43:20'
context_hash: e318700d2a0c3978
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

### 2026-05-24 System
- Task claimed via taskforge start TASK-137
- Session: d796203029
- Branch: agent/TASK-137-task-137--d796203029

### 2026-05-24 System
- Task claimed via taskforge start TASK-137
- Session: d796203029
- Branch: agent/TASK-137-task-137--d796203029
