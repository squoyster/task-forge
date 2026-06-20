---
id: TASK-310
type: Task
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
completed_at: '2026-06-20 09:50:00'
spec_hash: f4cdefdbd995fb76
branch: agent/TASK-310-sweeper-stale-reclaim
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-310
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

Done. Abandoned tasks are now auto-reclaimable; threshold configurable.

- `config.ts`: add `sweep.{staleThresholdMinutes (default 15), autoReclaim (default true)}`.
- `sweeper.ts`: threshold config-driven (was hard-coded 4h); new `reclaim` option forces stale-claimed tasks to Ready (re-assignable), skipping review classification; log messages use the configured threshold.
- `commands/sweep.ts` + `cli.ts`: `taskforge sweep --reclaim` (release stale claims to Ready); description updated to 15m default.
- `commands/claim.ts`: transparent pre-claim sweep gated on `sweep.autoReclaim`.

Tests: `tests/sweeper.test.ts` (reclaim→Ready, fresh not reclaimed, 15m boundary, --reclaim skips review, threshold override, non-In-Progress ignored) + config defaults; updated `tests/sweep.test.ts` fixtures for the 15m default. 880 tests pass; typecheck/lint/build clean. Branch stacked on TASK-309 (rebases onto main once 309 merges).

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
