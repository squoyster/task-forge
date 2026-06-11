---
id: TASK-116
type: Documentation
status: Done
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: f3613895c8a77f2e
spec_hash: cf90786233e13d3a
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-116
---

# TASK-116: Document command next-action semantics and state-transition outcomes

## Goal

## Rationalization Roadmap: TASK-RAT-017

### Objective
Document the command-output contract for driving agent behavior. Every agent-facing command should have deterministic next-action guidance.

### Required docs
docs/architecture/next-action-model.md, docs/commands/agent-facing-commands.md, docs/commands/state-transition-matrix.md

### Acceptance Criteria
- Agent authors can determine what to do next solely from command output
- JSON output has stable documented schema
- Each state transition has documented expected next action
- Includes examples for failing tests, broken harness, missing secret, push rejection, dirty worktree, stale claim

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-116

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-116

### 2026-05-23 System
- Task claimed via taskforge start TASK-116
- Session: a1b9b5dc48
- Branch: agent/TASK-116-document-command-next-action-semantics-a--a1b9b5dc48

### 2026-05-23 System
- Task claimed via taskforge start TASK-116
- Session: a1b9b5dc48
- Branch: agent/TASK-116-document-command-next-action-semantics-a--a1b9b5dc48
