---
id: TASK-145
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
---
# Remove Direct Task Markdown Mutation from Start Before Transaction

## Goal

Make `start` comply with transactional task-state mutation.

## Background

`cmdStart` currently performs direct task mutation before the transaction boundary. That undermines durable claim semantics.

## Acceptance Criteria

- [ ] `cmdStart` no longer calls direct mutation helpers such as `updateTaskLock`, `updateTaskStatus`, `writeTaskFile`, or `appendAgentNote` before successful transactional claim completion.

## Agent Notes
