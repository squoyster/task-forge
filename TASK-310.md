---
id: TASK-310
type: Task
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-310: Slimming Refactor 04: Sweeper stale-claim reclaim + config flags
## Goal
Strengthen sweeper.ts to reclaim stale-claimed tasks and add sweep config flags so abandoned tasks become re-claimable.

## Background
See specs/taskforge-slimming-refactor.md §Abandonment & Collision Model. Auto-reclaim ON by default; 15m threshold.

## Scope
- sweeper.ts: task re-claimable when claimed_at older than sweep.staleThresholdMinutes (default 15).- Add taskforge sweep --reclaim to auto-release stale-claimed tasks back to Ready/re-assignable.- sweep.autoReclaim (default true) runs reclaim transparently within claim.- Config: sweep.staleThresholdMinutes, sweep.autoReclaim.

## Acceptance Criteria
- Stale-claimed task (>threshold) is reclaimed by sweep --reclaim.- claim runs auto-reclaim when enabled.- Config defaults: 15m, auto on.- Re-claimed agent gets fresh session-scoped branch.

## Test / Verification Command
npm test -- --run (sweeper tests); npm run typecheck

## Expected Output / Behavior
Abandoned tasks auto-release for re-claim.

## Dependencies
TF-SLIM-01

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
