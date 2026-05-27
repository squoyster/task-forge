---
id: TASK-204
type: Task
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-204: Fix taskforge new silent push failure and add uncommitted-worktree detection with actionable guidance

## Goal

**Bug**: `taskforge new` calls `commitAndPushTaskState()` which silently swallows all errors (git.ts lines 205-229). When push fails, task file exists locally but not on remote task-state branch. Command always reports success regardless. Agents cannot claim tasks that were never pushed.\n\n**Feature**: Add uncommitted-worktree detection. When an agent has uncommitted changes in their worktree:\n1. If current task is NOT blocked → tell agent to complete the current task before proceeding to next\n2. If current task IS blocked → tell agent to commit current changes, then accept next task that resolves the block; if no resolving task available, continue with next available task\n3. All non-happy-path states must be explicitly returned as structured output (with machine-readable codes)

## Acceptance Criteria

- [ ]

## Agent Notes
