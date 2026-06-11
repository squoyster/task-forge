---
id: TASK-287
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---
# TASK-287: Fix checkpoint and submit ownership resolution outside task worktrees
## Goal
Make task-addressed lifecycle commands resolve task ownership and session context from the target task branch/worktree rather than the caller's current checkout branch.

## Background
Running `checkpoint TASK-ID` from `main` failed with `OWNERSHIP_UNKNOWN` because the command inferred ownership from the current branch instead of the task branch.

## Scope
Allowed files/directories:
- lifecycle ownership resolution
- session and branch context lookup
- focused lifecycle and ownership tests

Disallowed files/directories:
- unrelated session model redesign

## Acceptance Criteria
- [ ] `taskforge checkpoint TASK-ID` works when invoked from a non-task checkout such as `main`, as long as the target task is owned by the current session and has a valid worktree.
- [ ] `taskforge submit TASK-ID` and adjacent lifecycle commands use the target task context for ownership checks rather than the caller's current branch name.
- [ ] The `OWNERSHIP_UNKNOWN` failure seen from branch `main` is covered by a regression test.
- [ ] The command result explains target-task context when ownership resolution fails.
- [ ] Typecheck and focused lifecycle/ownership tests pass.

## Test / Verification Command
```bash
npm run typecheck
npm run lint
```

## Expected Output / Behavior
Task-addressed lifecycle commands behave consistently regardless of the caller's current checkout branch.

## Dependencies
None

## Risks
Context resolution changes can break task ownership checks if branch and worktree inference are not aligned.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-10T00:00:00Z System
- Task updated via taskforge update
- title set to "Fix checkpoint and submit ownership resolution outside task worktrees"
- type set to "Bug"
- priority set to "P1"
- agentRole set to "Implementer"
- riskLevel set to "Low"
- humanInterventionRequired set to "false"
- section goal updated (168 chars)
- section background updated (163 chars)
- section scope updated (201 chars)
- section acceptanceCriteria updated (583 chars)
- section testCommand updated (42 chars)
- section expectedOutput updated (105 chars)
- section dependencies updated (4 chars)
- section risks updated (108 chars)
- section continuationPolicy updated (49 chars)
- section agentNotes updated (0 chars)
- section result updated (0 chars)
- section links updated (70 chars)

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
