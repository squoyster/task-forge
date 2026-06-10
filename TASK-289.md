---
id: TASK-289
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 655dcb7fce27dee5
---

# TASK-289: Archive terminal audit history into task-state and ignore live audit logs
## Goal
## Goal

Move durable task audit history into task-state at terminal lifecycle transitions and keep live audit log files out of source-control dirt for active task worktrees.

## Acceptance Criteria

- [ ] Terminal lifecycle operations such as `done`, `reject`, and equivalent terminal transitions append relevant audit history or summarized command history into the task record in task-state.
- [ ] Live audit log files that continue to mutate during normal CLI usage no longer keep active task worktrees dirty by default.
- [ ] If live audit logs remain on disk, they are ignored from source control or otherwise excluded from task cleanliness gates.
- [ ] The completion path preserves enough audit detail for humans and agents to reconstruct task history after terminalization.
- [ ] Add regression coverage for the TASK-284 blocker where `checkpoint` and `submit` dirtied tracked audit logs and blocked starting the next task.
- [ ] Typecheck and focused lifecycle/audit tests pass.

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
