---
id: TASK-312
type: Task
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-312: Slimming Refactor 06: Remove git facade commands
## Goal
Remove the diff/checkpoint/submit/pr facade commands and their dead state-machine code; move sync and deps behind a flag.

## Background
See specs/taskforge-slimming-refactor.md §Target Command Surface. This is the core slimming action.

## Scope
- Delete src/commands/git-facade.ts.- Remove diff/checkpoint/submit/pr from src/cli.ts registration.- Remove submitStateMachine, prCreationFailed, branch-behind conditions in command-states.ts (dead code).- Move sync and deps/* behind --with-deps/config flag (stop default registration); keep compiling.

## Acceptance Criteria
- taskforge diff/checkpoint/submit/pr no longer exist (command-not-found).- git-facade.ts deleted.- command-states.ts has no submit/pr dead code.- sync/deps load only behind flag.- npm run build clean.

## Test / Verification Command
npm run typecheck; npm run build; npm test -- --run

## Expected Output / Behavior
Facade commands gone; build clean.

## Dependencies
TF-SLIM-05 (Done captures SHA before submit removed)

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
