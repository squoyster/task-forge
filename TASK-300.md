---
id: TASK-300
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 4f4ce29fe2858127
---

# TASK-300: Fix closure-task auto-create gating

## Goal

Problem: `maybeAutoCreateClosureTask()` appears intended to auto-create only when `TASKFORGE_AUTO_CREATE_CLOSURE_TASKS=1`, but the implementation path needs explicit opt-in enforcement.

Goal: require explicit opt-in before any automatic closure-task creation can spawn `taskforge new`, while preserving recursion and `new` command guards.

Source: specs/taskforge-codex-session-remediation-tasks.md TASK-NEW-004.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-12T00:00:00Z System
- Field(s) updated via taskforge update: acceptanceCriteria
