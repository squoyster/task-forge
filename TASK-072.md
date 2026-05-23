---
id: TASK-072
type: Test
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: b87f788ab6
claimed_at: '2026-05-23 01:05:45'
context_hash: 2d40ee019028e7ff
---

# TASK-072: Integration tests for init-generated OpenCode policy

## Goal

Add tests proving generated OpenCode integration enforces intended policy. Create temp project, run taskforge init --agent-framework opencode --policy managed --install-hooks --audit. Verify all generated files exist and are correct. Test idempotency (run init twice). Test existing config preservation. Tests use temp dirs, no network access, no OpenCode binary required.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Task claimed via taskforge start TASK-072
- Session: b87f788ab6
- Branch: agent/TASK-072-integration-tests-for-init-generated-ope--b87f788ab6

### 2026-05-23 System
- Task claimed via taskforge start TASK-072
- Session: b87f788ab6
- Branch: agent/TASK-072-integration-tests-for-init-generated-ope--b87f788ab6
