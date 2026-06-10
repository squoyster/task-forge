---
id: TASK-283
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-283: Fix done command handling for control-file drift

## Goal

## Goal

Make `taskforge done` handle control-file drift and completion-state transitions in a way that is explicit, actionable, and consistent with the task state machine.

## Acceptance Criteria

- [ ] `taskforge done TASK-ID` does not fail with an ambiguous control-file-drift result when the task has otherwise completed and the repo state is valid.
- [ ] The command returns a distinct, actionable recovery path when control files changed since task start.
- [ ] Add regression coverage for the state-machine path that failed during TASK-280 completion.
- [ ] The task passes `typecheck`, `lint`, and the focused done/state-machine tests.

## Acceptance Criteria

- [ ]

## Agent Notes
