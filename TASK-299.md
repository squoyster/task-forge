---
id: TASK-299
type: Feature
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 734b281ec6b0b1e5
---

# TASK-299: Add taskforge state publish recovery command

## Goal

Problem: when task-state publication fails, agents have no first-class TaskForge command to safely publish pending task-state changes and are forced toward raw git recovery.

Goal: add a constrained `taskforge state publish` command that publishes pending TaskForge-managed task-state changes without exposing general git operations.

Source: specs/taskforge-codex-session-remediation-tasks.md TASK-NEW-003.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Backlog cleared to focus queue on TaskForge Slimming Refactor (TASK-307..315). Superseded, descoped, or obsoleted by refactor per specs/taskforge-slimming-refactor.md. Task record retained as historical reference; re-evaluate post-refactor.

### 2026-06-12T00:00:00Z System
- Field(s) updated via taskforge update: acceptanceCriteria
