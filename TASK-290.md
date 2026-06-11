---
id: TASK-290
type: Bug
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 717dcfc105
claimed_at: '2026-06-11 02:28:59'
context_hash: 24c64b5cba799406
branch: agent/TASK-290-clear-terminal-state-ownership-metadata--717dcfc105
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-290
---

# TASK-290: Clear terminal-state ownership metadata

## Goal

Goal: Clear active ownership metadata when tasks enter terminal states like Done or Rejected.

Background: Terminal tasks currently retain assignee and claimed_at, which makes closed work look actively owned and confuses workflow state.

Scope:
- terminal state transition logic
- focused lifecycle tests
- no unrelated workflow refactors

Acceptance Criteria:
- Terminal transitions clear assignee and claimed_at.
- Terminal transitions preserve or clear branch/worktree according to current policy, but ownership fields are not left behind.
- Add regression coverage for Done and Rejected terminal transitions.
- typecheck, lint, and focused lifecycle tests pass.

Test / Verification Command:
```bash
npm run typecheck
npm run lint
```

Expected Output / Behavior: Tasks in Done or Rejected no longer appear actively claimed.

Dependencies: None

Risks: Over-clearing historical context if cleanup reaches beyond ownership fields.

Continuation Policy: Auto-continue unless a stopping condition occurs.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-11T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-290

### 2026-06-11T00:00:00Z System
- Task claimed via taskforge start TASK-290
- Session: 717dcfc105
- Branch: agent/TASK-290-clear-terminal-state-ownership-metadata--717dcfc105
