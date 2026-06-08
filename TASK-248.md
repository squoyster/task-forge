---
id: TASK-248
type: Bug
status: Review
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
assignee: 2012cb0590
claimed_at: '2026-06-08 04:57:41'
branch: agent/TASK-248-fix-session-ownership-mismatch-after-swe--2012cb0590
---

# TASK-248: Fix session-ownership mismatch after sweep: branch embodies stale session ID

## Goal

When the Sweeper Protocol resets a stale task claim, a new agent can re-claim the task but the existing branch name still embeds the old session ID (e.g., `agent/TASK-247-...--oldSessionId`). The `done` command's `assertTaskOwnership()` parses the session ID from the branch name and compares it to the task's `assignee` frontmatter. Since the branch still carries the old session, ownership assertion fails and `done` is blocked.

## Acceptance Criteria

- [x] When a task is claimed after being swept (or the assignee changes), the branch name's embedded session ID is updated to match the new assignee
- [x] A swept-then-re-claimed task can be marked Done without manual intervention to sync session IDs
- [x] Existing tests for ownership assertion, sweeper, and done continue to pass

## Agent Notes

### 2026-06-08T00:00:00Z System
- Report generated — task moved to Review
- Changed files: none
- Commits: none
- AC section: present
- AC has unchecked items

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge claim TASK-248
- Session: 2012cb0590

### 2026-06-08T23:00:00Z Agent
- Root cause: `claim` and `start` commands reused existing branch name without checking if the embedded session ID matched the current session
- Fix: Added `parseSessionIdFromBranch` check in both `claim.ts` and `start.ts` — when a branch exists but contains a stale session ID, a new branch name is generated with the current session
- Files changed: `src/commands/claim.ts`, `src/commands/start.ts`, `tests/commands/start.test.ts`
- All 621 tests pass
