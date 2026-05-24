---
id: TASK-135
type: Bug
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
assignee: a013ebccc5
claimed_at: '2026-05-24 00:20:22'
context_hash: f3613895c8a77f2e
---
# Reject Done Transition When AC Section Is Missing

## Goal

Prevent `taskforge done` from marking a task complete if the task file has no `## Acceptance Criteria` section.

## Background

Several tasks are currently marked `Done` without meaningful ACs. This invalidates task-state reliability and makes agentic completion untrustworthy.

## Implementation Notes

- Add parsing support for detecting the AC section.
- Enforce this in `done` transition logic.
- The failure output must be explicit and actionable.

## Acceptance Criteria

- [ ] `taskforge done TASK-ID` refuses to complete a task whose Markdown file lacks a `## Acceptance Criteria` section and emits a next action telling the agent to add or request ACs before completion.

## Agent Notes

### 2026-05-24 System
- Task claimed via taskforge start TASK-135
- Session: a013ebccc5
- Branch: agent/TASK-135-task-135--a013ebccc5

### 2026-05-24 System
- Task claimed via taskforge start TASK-135
- Session: a013ebccc5
- Branch: agent/TASK-135-task-135--a013ebccc5
