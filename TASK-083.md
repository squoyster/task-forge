---
id: TASK-083
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 8c607774d14d0be5
---

# TASK-083: Add container-aware path mapping utilities

## Goal

Centralize host/container path mapping in src/core/runtime-paths.ts. Detect git root, project parent, map to /workspace/<project>. Support native and container modes. Handle nested dirs, spaces, symlinks. Existing path logic unchanged in native mode.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.
- Failed to remove worktree: Command failed with exit code 128: git worktree remove /Volumes/Transcend/devel/worktrees/task-forge/TASK-083

fatal: '/Volumes/Transcend/devel/worktrees/task-forge/TASK-083' contains modified or untracked files, use --force to delete it
- Worktree and branch fields cleared from task frontmatter.

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-083

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-083

### 2026-05-23 System
- Task claimed via taskforge start TASK-083
- Session: 5b380b7b2e
- Branch: agent/TASK-083-add-container-aware-path-mapping-utiliti--5b380b7b2e

### 2026-05-23 System
- Task claimed via taskforge start TASK-083
- Session: 5b380b7b2e
- Branch: agent/TASK-083-add-container-aware-path-mapping-utiliti--5b380b7b2e
