---
id: TASK-159
type: Bug
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-152
assignee: 5f3875c365
claimed_at: '2026-05-25 01:29:00'
context_hash: 6293e97a7b29e75c
---
# Stop Silently Swallowing Audit Write Failures

## Goal

Make audit failure visible.

## Acceptance Criteria

- [ ] Audit write failures are reported through a visible diagnostic path unless audit failure suppression is explicitly enabled in config.

## Agent Notes

### 2026-05-25 System
- Task claimed via taskforge start TASK-159
- Session: 5f3875c365
- Branch: agent/TASK-159-task-159--5f3875c365
