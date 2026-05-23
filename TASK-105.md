---
id: TASK-105
type: Refactor
status: Ready
priority: P0
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
dependsOn:
  - TASK-124
context_hash: 8c607774d14d0be5
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-105
---

# TASK-105: Rewrite task-state mutation to use transactions only

## Goal

## Rationalization Roadmap: TASK-RAT-003

### Objective
Eliminate mixed direct writes and transaction writes. All task-state mutations must go through a single transaction abstraction with optimistic concurrency, jittered retry, dirty tracking, audit events, and clear failure behavior.

### Problem
Current start/claim flows mutate files directly before transaction commit. This can produce duplicated notes, partial local state, and inconsistent retry behavior.

### Implementation
1. Add dirty-task tracking to transaction implementation
2. Ensure only dirty task files are rewritten
3. Make notes part of the same transaction write
4. Make audit event append part of the same command flow
5. Rewrite start/claim/done/block/release/heartbeat/reject/new to use transactions
6. Add tests for duplicate-note prevention, push rejection retry, failed claim leaving no local mutation

### Acceptance Criteria
- No state-changing command mutates task files outside transaction layer
- Failed durable claim does not leave task marked in progress locally
- Duplicate system notes are not produced under retry
- Transaction failure returns explicit next action

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Transaction dirty-tracking added (persistAndCommit now writes only dirty tasks)
- claim.ts refactored to move all mutations into transaction layer
- Blocked pending TASK-124: remaining commands + duplicate-note tests + next-action guidance

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-105

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-105

### 2026-05-23 System
- Task claimed via taskforge start TASK-105
- Session: b5101003ca
- Branch: agent/TASK-105-rewrite-task-state-mutation-to-use-trans--b5101003ca

### 2026-05-23 System
- Task claimed via taskforge start TASK-105
- Session: b5101003ca
- Branch: agent/TASK-105-rewrite-task-state-mutation-to-use-trans--b5101003ca
