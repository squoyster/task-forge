---
id: TASK-248
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-248: Fix session-ownership mismatch after sweep: branch embodies stale session ID

## Goal

When the Sweeper Protocol resets a stale task claim, a new agent can re-claim the task but the existing branch name still embeds the old session ID (e.g., `agent/TASK-247-...--oldSessionId`). The `done` command's `assertTaskOwnership()` parses the session ID from the branch name and compares it to the task's `assignee` frontmatter. Since the branch still carries the old session, ownership assertion fails and `done` is blocked.

## Acceptance Criteria

- [ ] When a task is claimed after being swept (or the assignee changes), the branch name's embedded session ID is updated to match the new assignee
- [ ] OR: The `assertTaskOwnership` check uses the task frontmatter's `assignee` field directly instead of parsing it from the branch name
- [ ] A swept-then-re-claimed task can be marked Done without manual intervention to sync session IDs
- [ ] Existing tests for ownership assertion, sweeper, and done continue to pass

## Agent Notes
