---
id: TASK-268
type: Feature
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: b516925ba8cef30c
---

# TASK-268: Add TASK_FORGE_ACTIVE warning to guard:status

## Goal

Make it easy for users to discover when the mutation boundary is inactive because TASK_FORGE_ACTIVE is not set.

## Problem

The mutation boundary (guard plugin + git hooks) is installed, but the env var `TASK_FORGE_ACTIVE` must be set to `"true"` for the guard plugin to enforce restrictions. Currently, if a user forgets to configure this, the guard is silently inactive - no error, no warning.

## Task Description

Enhance `taskforge guard:status` to detect and warn when `TASK_FORGE_ACTIVE` is not set. The guard plugin already has a one-time `console.warn`, but the CLI command should also surface this prominently.

## Acceptance Criteria

1. `taskforge guard:status` shows a clear warning if `TASK_FORGE_ACTIVE` is not set to `"true"`.
2. The warning includes instructions for how to set it (opencode.json agent config, or shell env).
3. JSON output includes a `managed` boolean field (already present) and a `warnings` array if the env var is unset.
4. `taskforge guard:status` exits with code 0 regardless (informational, not error).
5. Tests verify the warning appears in text and JSON mode.

## Required Tests

- guard:status shows warning when TASK_FORGE_ACTIVE unset (text mode)
- guard:status shows warning when TASK_FORGE_ACTIVE unset (JSON mode)
- guard:status shows no warning when TASK_FORGE_ACTIVE=true
- guard:status JSON output contains warnings array

## Completion Evidence

- Updated guard-cmd.ts with env var check
- Tests passing
- Manual verification: run `taskforge guard:status` with and without the env var

## Agent Notes

### 2026-06-08T00:00:00Z System
- Cleanup: worktree and branch removed

### 2026-06-08T00:00:00Z System
- Task marked Done

### 2026-06-08T00:00:00Z System
- Task marked Done

### 2026-06-08T00:00:00Z System
- Task released by session "a08bb87d9d"

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-268

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-268
- Session: a08bb87d9d
- Branch: agent/TASK-268-add-taskforgeactive-warning-to-guardstat--a08bb87d9d
