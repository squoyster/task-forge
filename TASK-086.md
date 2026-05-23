---
id: TASK-086
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 8c607774d14d0be5
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-086
---

# TASK-086: Add project runtime configuration

## Goal

Extend .taskforge/config.json with runtime section (mode: native|container, image, workspaceMount, credentialMode). Default to container for deployment but don't break native. Doctor commands aware of runtime mode. Tests for config defaulting.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.

### 2026-05-23 02:20 System
- Added runtime section to ConfigSchema (mode, image, workspaceMount, credentialMode)
- Updated doctor command to report runtime mode and check docker for container mode
- Added 7 tests for runtime config defaulting and validation
- Updated CHANGELOG.md
- All 21 config tests pass; full suite: 421/435 pass (14 pre-existing failures unrelated)

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-086

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-086

### 2026-05-23 System
- Task claimed via taskforge start TASK-086
- Session: 642e16732c
- Branch: agent/TASK-086-add-project-runtime-configuration--642e16732c

### 2026-05-23 System
- Task claimed via taskforge start TASK-086
- Session: 642e16732c
- Branch: agent/TASK-086-add-project-runtime-configuration--642e16732c
