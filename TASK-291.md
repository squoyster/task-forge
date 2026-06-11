---
id: TASK-291
type: Bug
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: b6b4e89a30
claimed_at: '2026-06-11 11:22:16'
context_hash: 24c64b5cba799406
branch: agent/TASK-291-fix-false-force-push-rejection-on-task-b--b6b4e89a30
---

# TASK-291: Fix false force-push rejection on task branch submit

## Goal

Goal: Stop TaskForge-managed task branches from being rejected as forbidden force pushes when they are performing ordinary forward submissions.

Background: Multiple tasks required internal-bypass pushes even after submit logic was correct, because the push policy or hook path falsely classified normal task branch pushes as force pushes.

Scope:
- hook or push-policy enforcement logic
- task-branch submission path
- focused regression tests

Acceptance Criteria:
- Ordinary forward pushes for TaskForge task branches are allowed.
- Real force pushes remain blocked.
- Submit no longer needs internal bypass for the normal task branch path.
- typecheck, lint, and focused hook/push-policy tests pass.

Test / Verification Command:
```bash
npm run typecheck
npm run lint
```

Expected Output / Behavior: TaskForge submit can push normal task branches without false force-push rejection.

Dependencies: None

Risks: Weakening the protection too far could allow unsafe history rewrites.

Continuation Policy: Auto-continue unless a stopping condition occurs.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-11T00:00:00Z System
- Task claimed via taskforge start TASK-291
- Session: b6b4e89a30
- Branch: agent/TASK-291-fix-false-force-push-rejection-on-task-b--b6b4e89a30
