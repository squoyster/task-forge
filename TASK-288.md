---
id: TASK-288
type: Bug
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 454d025409
claimed_at: '2026-06-10 23:13:41'
context_hash: 24c64b5cba799406
spec_hash: ec2e09ca4dea5d08
branch: agent/TASK-288-normalize-malformed-task-files-created-b--454d025409
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-288
---
# TASK-288: Normalize malformed task files created by legacy new template bug
## Goal
Repair existing task files that were created with duplicated section blocks by the legacy `taskforge new` markdown assembly path.

## Background
Recent task files created during anomaly follow-up work retained duplicated structural sections such as repeated `## Goal` and repeated `## Acceptance Criteria` blocks.

## Scope
Allowed files/directories:
- task-state markdown normalization
- task parsing and validation
- focused task-store and validate-state tests

Disallowed files/directories:
- unrelated lifecycle changes

## Acceptance Criteria
- [ ] Detect task files with duplicated structural sections such as repeated `## Goal` or `## Acceptance Criteria` blocks caused by the pre-TASK-284 template bug.
- [ ] Normalize affected task files into the canonical task markdown layout without losing task intent or workflow metadata.
- [ ] Add a regression or validation check that prevents newly created malformed task files of this shape from going unnoticed.
- [ ] Document or emit repair guidance for already-existing malformed task files.
- [ ] Typecheck and focused task-store and validate-state tests pass.

## Test / Verification Command
```bash
npm run typecheck
npm test -- --run tests/task-store.test.ts tests/validate-state.test.ts tests/ac-check.test.ts
```

## Expected Output / Behavior
Malformed task files are repaired and duplicate structural sections are surfaced by validation.

## Dependencies
None

## Risks
Over-aggressive normalization could erase useful freeform task notes if the section parser is too naive.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-10T00:00:00Z System
- Task updated via taskforge update
- title set to "Normalize malformed task files created by legacy new template bug"
- type set to "Bug"
- priority set to "P2"
- agentRole set to "Implementer"
- riskLevel set to "Low"
- humanInterventionRequired set to "false"
- section goal updated (129 chars)
- section background updated (168 chars)
- section scope updated (199 chars)
- section acceptanceCriteria updated (567 chars)
- section testCommand updated (124 chars)
- section expectedOutput updated (95 chars)
- section dependencies updated (4 chars)
- section risks updated (104 chars)
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
