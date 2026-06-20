---
id: TASK-308
type: Task
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-308: Slimming Refactor 02: Gate stamp + _hook internals
## Goal
Implement the gate-stamp mechanism and a taskforge _hook internals command so hook enforcement logic lives in testable TS.

## Background
See specs/taskforge-slimming-refactor.md §Gate Stamp Design and §Hook Contract. Pre-push needs a stamp to verify gates ran on the exact commit being pushed.

## Scope
- Add clean-tree requirement to gates.ts (git status --porcelain must be empty; error if dirty).- On all-pass, write .taskforge/gate-stamp.json: {commit_sha: HEAD, gates:{...passed}, timestamp, runner_session}.- Add taskforge _hook <name> internals command (hidden) that runs pre-commit/pre-push logic in TS.- Add .taskforge/gate-stamp.json to .gitignore.- Pre-commit rule: block staged edits to gate-stamp.json.

## Acceptance Criteria
- gates.ts requires clean tree before running.- gate-stamp.json written on pass with correct commit_sha.- Dirty tree produces clear error.- taskforge _hook command exists and dispatches by name.- gate-stamp.json is gitignored.

## Test / Verification Command
npm test -- --run tests/gates (or equivalent); npm run typecheck; npm run build

## Expected Output / Behavior
Gates stamp the exact HEAD; _hook dispatches correctly.

## Dependencies
TF-SLIM-01 (clean starting point)

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
