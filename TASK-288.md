---
id: TASK-288
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-288: Normalize malformed task files created by legacy new template bug
## Goal
## Goal

Repair existing task files that were created with duplicated section blocks by the legacy `taskforge new` markdown assembly path.

## Acceptance Criteria

- [ ] Detect task files with duplicated structural sections such as repeated `## Goal` or `## Acceptance Criteria` blocks caused by the pre-TASK-284 template bug.
- [ ] Normalize affected task files into the canonical TaskDocument layout without losing task intent or workflow metadata.
- [ ] Add a regression or validation check that prevents newly created malformed task files of this shape.
- [ ] Document or emit repair guidance for already-existing malformed task files.
- [ ] Typecheck and focused task-document/task-store validation tests pass.

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
