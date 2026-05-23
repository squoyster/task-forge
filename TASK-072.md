---
id: TASK-072
type: Test
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-072: Integration tests for init-generated OpenCode policy

## Goal

Add tests proving generated OpenCode integration enforces intended policy. Create temp project, run taskforge init --agent-framework opencode --policy managed --install-hooks --audit. Verify all generated files exist and are correct. Test idempotency (run init twice). Test existing config preservation. Tests use temp dirs, no network access, no OpenCode binary required.

## Acceptance Criteria

- [ ]

## Agent Notes
