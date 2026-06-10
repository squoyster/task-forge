---
id: TASK-285
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-285: Add mergeability preflight to submit against origin/main
## Goal
## Goal

Make `taskforge submit TASK-ID` verify that the task branch can merge cleanly with the current `origin/main` before reporting success.

## Acceptance Criteria

- [ ] `taskforge submit TASK-ID` fetches or compares against the current `origin/main` merge base before returning success.
- [ ] If the branch has a real merge conflict with `origin/main`, submit returns a failure or blocked result with explicit guidance instead of a misleading success/no-op.
- [ ] Add regression coverage for the add/add conflict case observed in `src/commands/update.ts` during TASK-284.
- [ ] The command output clearly distinguishes `submitted`, `already submitted`, and `submitted but not mergeable` states.
- [ ] Typecheck and focused submit/mergeability tests pass.

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
