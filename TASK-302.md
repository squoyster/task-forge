---
id: TASK-302
type: Test
status: Rejected
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: afe2add685450561
---

# TASK-302: Add Codex-style workflow failure regression fixture

## Goal

Problem: the reviewed Codex session exposed a multi-command failure path spanning new, submit, PR creation, task-state publication, and closure-task generation. Isolated helper tests are not enough to prevent recurrence.

Goal: add an integration-style regression fixture that simulates the failure class without requiring a live GitHub remote.

Source: specs/taskforge-codex-session-remediation-tasks.md TASK-NEW-007.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Recalibration: pre-306 task pool retired; superseded by 306+ frontier.

### 2026-06-12T00:00:00Z System
- Field(s) updated via taskforge update: acceptanceCriteria
