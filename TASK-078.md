---
id: TASK-078
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 8c607774d14d0be5
spec_hash: 1fbfddd1851bd08f
---

# TASK-078: Add host launcher for containerized TaskForge execution

## Goal

Provide host-side launcher (scripts/taskforge-container) that wraps container execution. Detect git root, mount parent to /workspace, forward SSH agent/GITHUB_TOKEN, support Docker/Podman, handle spaces/symlinks/macOS/UID. Install via scripts/install-taskforge-launcher.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.
- Failed to remove worktree: Command failed with exit code 128: git worktree remove /Volumes/Transcend/devel/worktrees/task-forge/TASK-078

fatal: '/Volumes/Transcend/devel/worktrees/task-forge/TASK-078' contains modified or untracked files, use --force to delete it
- Worktree and branch fields cleared from task frontmatter.

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-078

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-078

### 2026-05-23 System
- Task claimed via taskforge start TASK-078
- Session: 355598eba2
- Branch: agent/TASK-078-add-host-launcher-for-containerized-task--355598eba2

### 2026-05-23 System
- Task claimed via taskforge start TASK-078
- Session: 355598eba2
- Branch: agent/TASK-078-add-host-launcher-for-containerized-task--355598eba2
