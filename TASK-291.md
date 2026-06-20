---
id: TASK-291
type: Bug
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 24c64b5cba799406
spec_hash: dcef5fe2dd3c70ad
branch: agent/TASK-291-fix-false-force-push-rejection-on-task-b--b6b4e89a30
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-291
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

### 2026-06-20T00:00:00Z System
- Task rejected: Recalibration - pre-306 task pool retired, superseded by 306+ frontier.

### 2026-06-11T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present
- AC has blank items

### 2026-06-11T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-291

### 2026-06-11T00:00:00Z System
- Task claimed via taskforge start TASK-291
- Session: b6b4e89a30
- Branch: agent/TASK-291-fix-false-force-push-rejection-on-task-b--b6b4e89a30
