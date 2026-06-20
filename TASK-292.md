---
id: TASK-292
type: Bug
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 4db1a7cd358d9c86
---
# TASK-292: Refuse task start when local main is behind origin/main
## Goal
Prevent agents from starting new task worktrees from a stale local main branch that is behind origin/main.

## Background
During TASK-223, taskforge start created a worktree from local main while the primary checkout was 16 commits behind origin/main. That stale base did not include the TASK-281 submit fix, causing taskforge submit to report the old misleading "No changes to submit" behavior even though origin/main already contained the fix. Starting work from stale main can reintroduce fixed bugs and create avoidable merge/review churn.

## Scope
Update taskforge start or its worktree creation preflight to detect when the local main ref used as the task base is behind origin/main. Refuse to start, or return a blocked/human-actionable result, until main is updated. Keep behavior provider-agnostic and avoid raw npm/build assumptions.

## Acceptance Criteria
- [ ] taskforge start checks whether the local main branch/ref used for the new task worktree is behind origin/main before creating or reusing a task worktree.
- [ ] If local main is behind origin/main, start fails or blocks before creating the worktree and explains the required recovery action.
- [ ] The failure output is structured for JSON callers and includes a safe next action such as updating/syncing the base before retrying.
- [ ] start does not falsely block when local main is equal to or ahead of origin/main, or when remote state cannot be checked for a clearly reported reason.
- [ ] Regression tests cover stale-main refusal and current-main success paths.

## Test / Verification Command
npm run typecheck && npm run lint && npm test -- tests/commands/start.test.ts

## Expected Output / Behavior
Agents cannot start new implementation work from a local main that is behind origin/main; stale-base detection produces clear structured guidance instead of creating a misleading task worktree.

## Dependencies
None

## Risks
Remote checks can fail offline; implementation should distinguish an unreachable remote from a confirmed stale main and return explicit guidance.

## Continuation Policy
Auto-continue unless remote-state detection semantics require human policy input.

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Backlog cleared to focus queue on TaskForge Slimming Refactor (TASK-307..315). Superseded, descoped, or obsoleted by refactor per specs/taskforge-slimming-refactor.md. Task record retained as historical reference; re-evaluate post-refactor.

### 2026-06-12T00:00:00Z System
- Task updated via taskforge update
- section acceptanceCriteria updated (673 chars)

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
