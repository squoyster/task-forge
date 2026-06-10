---
id: TASK-276
type: Feature
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 6d2c4e6935
claimed_at: '2026-06-10 12:49:22'
context_hash: 58d6f9d818aa1c4f
branch: agent/TASK-276-implement-taskforge-update-command-for-t--6d2c4e6935
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-276
---

# TASK-276: Implement taskforge update command for task frontmatter field updates

## Goal

There is no way to update task frontmatter fields through any CLI command. The mutation guard suggests taskforge update as the replacement for direct task-state edits, but this command has never been implemented.

Implement taskforge update <taskId> for setting arbitrary frontmatter fields (--field, --value). Must use withTaskStateTransaction for durability, support JSON output, and reject protected fields.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-10T00:00:00Z System
- Field(s) updated via taskforge update: riskLevel

### 2026-06-10T00:00:00Z System
- Field(s) updated via taskforge update: riskLevel

### 2026-06-10T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-276

### 2026-06-10T00:00:00Z System
- Task claimed via taskforge start TASK-276
- Session: 6d2c4e6935
- Branch: agent/TASK-276-implement-taskforge-update-command-for-t--6d2c4e6935
