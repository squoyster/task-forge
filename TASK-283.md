---
id: TASK-283
type: Bug
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 815c3f8444
claimed_at: '2026-06-11 12:01:51'
context_hash: 6cd5541d1cdfd05c
spec_hash: d38d63651a60a9bc
branch: agent/TASK-283-fix-done-command-handling-for-control-fi--815c3f8444
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-283
---
# TASK-283: Fix done command handling for control-file drift
## Goal
Make `taskforge done` handle control-file drift and completion-state transitions in a way that is explicit, actionable, and consistent with the task state machine.

## Background
TASK-280 completion exposed an ambiguous failure path when control files drifted during an otherwise valid completion sequence.

## Scope
Allowed files/directories:
- done lifecycle logic
- control-file drift handling
- focused done and state-machine tests

Disallowed files/directories:
- unrelated lifecycle redesign

## Acceptance Criteria
- [ ] `taskforge done TASK-ID` does not fail with an ambiguous control-file-drift result when the task has otherwise completed and the repo state is valid.
- [ ] The command returns a distinct, actionable recovery path when control files changed since task start.
- [ ] Add regression coverage for the state-machine path that failed during TASK-280 completion.
- [ ] The task passes `typecheck`, `lint`, and the focused done/state-machine tests.

## Test / Verification Command
```bash
npm run typecheck
npm run lint
```

## Expected Output / Behavior
Done either completes cleanly or returns a specific recovery path for control-file drift.

## Dependencies
None

## Risks
Completion gating can become more confusing if drift paths are not modeled clearly.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Recalibration - pre-306 task pool retired, superseded by 306+ frontier.

### 2026-06-11T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present
- AC has unchecked items

### 2026-06-11T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-283

### 2026-06-11T00:00:00Z System
- Task claimed via taskforge start TASK-283
- Session: 815c3f8444
- Branch: agent/TASK-283-fix-done-command-handling-for-control-fi--815c3f8444

### 2026-06-10T00:00:00Z System
- Task updated via taskforge update
- title set to "Fix done command handling for control-file drift"
- type set to "Bug"
- priority set to "P1"
- agentRole set to "Implementer"
- riskLevel set to "Low"
- humanInterventionRequired set to "false"
- section goal updated (163 chars)
- section background updated (127 chars)
- section scope updated (180 chars)
- section acceptanceCriteria updated (445 chars)
- section testCommand updated (42 chars)
- section expectedOutput updated (89 chars)
- section dependencies updated (4 chars)
- section risks updated (83 chars)
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
