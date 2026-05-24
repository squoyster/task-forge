---
id: TASK-152
type: Feature
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-141
assignee: 91f5d427bb
claimed_at: '2026-05-24 03:37:16'
context_hash: 3a03a0322eb9729c
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-152
---
# Add Generic Transcript Provider Interface

## Goal

Decouple per-task agentic audit logs from OpenCode.

## Background

OpenCode is the presumptive target, but transcript capture should be generic.

## Acceptance Criteria

- [x] A generic `TranscriptProvider` or equivalent interface exists for importing or appending session transcript events independent of OpenCode. — `src/core/transcript-provider.ts` `TranscriptProvider` interface: defines `appendEvent(taskId, event)`, `readEvents(taskId)`, and `importEvents(taskId, events)` methods. Tests in `tests/transcript-provider.test.ts` verify interface shape and implementation compatibility.

## Agent Notes

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-152

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-152

### 2026-05-24 System
- Task claimed via taskforge start TASK-152 (forced)
- Session: 91f5d427bb
- Branch: agent/TASK-152-task-152--91f5d427bb

### 2026-05-24 System
- Task claimed via taskforge start TASK-152 (forced)
- Session: 91f5d427bb
- Branch: agent/TASK-152-task-152--91f5d427bb

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-152

### 2026-05-24 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-152

### 2026-05-24 System
- Task claimed via taskforge start TASK-152
- Session: 1f64f5b44e
- Branch: agent/TASK-152-task-152--1f64f5b44e

### 2026-05-24 System
- Task claimed via taskforge start TASK-152
- Session: 1f64f5b44e
- Branch: agent/TASK-152-task-152--1f64f5b44e
