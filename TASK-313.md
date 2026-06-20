---
id: TASK-313
type: Task
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
completed_at: '2026-06-20 10:32:00'
spec_hash: 4ef24da9370c556a
branch: agent/TASK-313-config-schema-cleanup
---

# TASK-313: Slimming Refactor 07: Config schema changes
## Goal
Update config.ts Zod schema: add new keys (push.allowedBranches, gates.requireCleanTree, sweep.*, hooks.enforce) and remove deprecated continuation.* keys.

## Background
See specs/taskforge-slimming-refactor.md §Config Changes.

## Scope
- Add: push.allowedBranches (default []), gates.requireCleanTree (default true), sweep.staleThresholdMinutes (default 15), sweep.autoReclaim (default true), hooks.enforce (default true).- Remove/deprecate: continuation.allowPush, continuation.allowCommit, continuation.allowDraftPr.- Keep: autoContinue, maxTaskFixIterations.- Update .taskforge/config.json defaults + config-validate.

## Acceptance Criteria
- Schema accepts new keys with correct defaults.- Schema rejects removed keys with clear error (or migrates).- config-validate passes on fresh config.

## Test / Verification Command
npm test -- --run (config tests); npm run typecheck

## Expected Output / Behavior
Config schema matches new design.

## Dependencies
TF-SLIM-04 (sweep.* keys), TF-SLIM-02 (gates key)

## Risks
Known risks.

## Continuation Policy
Auto-continue unless a stopping condition occurs.

## Agent Notes

## Result

Done. Removed `continuation.{allowPush,allowCommit,allowDraftPr}` (kept autoContinue/maxTaskFixIterations; non-strict Zod strips from existing configs). Added `gates.requireCleanTree` (default true, wired into gates.ts) + `hooks.enforce` (default true). Updated init.ts template + .taskforge/config.json. Tests: new-key defaults + deprecated-key stripping. 866 pass; typecheck/lint/build clean. Pushed `agent/TASK-313-config-schema-cleanup` (PR pending).

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
