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
## Goal

Make task-addressed lifecycle commands resolve task ownership and session context from the target task branch/worktree rather than the caller's current checkout branch.

## Acceptance Criteria

- [ ] `taskforge checkpoint TASK-ID` works when invoked from a non-task checkout such as `main`, as long as the target task is owned by the current session and has a valid worktree.
- [ ] `taskforge submit TASK-ID` and adjacent lifecycle commands use the target task context for ownership checks rather than the caller's current branch name.
- [ ] The `OWNERSHIP_UNKNOWN` failure seen from branch `main` is covered by a regression test.
- [ ] The command result explains target-task context when ownership resolution fails.
- [ ] Typecheck and focused lifecycle/ownership tests pass.

## Background
Relevant context, constraints, prior decisions, and links.

## Scope
Allowed files/directories:
-

Disallowed files/directories:
-

## Acceptance Criteria
- [ ]

## Test / Verification Command
```bash
# command here
```

## Expected Output / Behavior
Describe expected result.

## Dependencies
None

## Risks
Known risks.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
