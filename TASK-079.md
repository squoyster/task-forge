---
id: TASK-079
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 8c607774d14d0be5
---

# TASK-079: Add system doctor checks for deployment readiness

## Goal

Add taskforge doctor system command. Validate Docker/Podman availability, runtime image pullable, git repo context, git config, SSH agent, GITHUB_TOKEN, mount permissions, container ownership. Support --json and --fix (safe items only).

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.
- Failed to remove worktree: Command failed with exit code 128: git worktree remove /Volumes/Transcend/devel/worktrees/task-forge/TASK-079

fatal: '/Volumes/Transcend/devel/worktrees/task-forge/TASK-079' contains modified or untracked files, use --force to delete it
- Worktree and branch fields cleared from task frontmatter.

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-079

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-079

### 2026-05-23 System
- Task claimed via taskforge start TASK-079
- Session: 37360c22c8
- Branch: agent/TASK-079-add-system-doctor-checks-for-deployment--37360c22c8

### 2026-05-23 System
- Task claimed via taskforge start TASK-079
- Session: 37360c22c8
- Branch: agent/TASK-079-add-system-doctor-checks-for-deployment--37360c22c8
