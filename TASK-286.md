---
id: TASK-286
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-286: Make checkpoint results atomic with audit log side effects
## Goal
## Goal

Ensure `taskforge checkpoint TASK-ID` does not report success unless all required side effects, including audit/log writes, have completed successfully.

## Acceptance Criteria

- [ ] `taskforge checkpoint TASK-ID` returns failure when post-commit audit or log writes fail, instead of printing a success result first.
- [ ] If the commit succeeds but later side effects fail, the command reports the partial state explicitly and provides a deterministic recovery path.
- [ ] Add regression coverage for the log-write failure mode observed during TASK-284 repair work.
- [ ] The command leaves the worktree in a clear, inspectable state after partial failure.
- [ ] Typecheck and focused checkpoint/audit tests pass.

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
