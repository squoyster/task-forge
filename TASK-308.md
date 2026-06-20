---
id: TASK-308
type: Task
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
completed_at: '2026-06-20 07:40:00'
spec_hash: 72485983793a5525
branch: agent/TASK-308-gate-stamp-hook-internals
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-308
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

Done. Gate-stamp mechanism + `_hook` internals implemented and verified.

- `src/core/gate-stamp.ts`: GateStamp type, write/read/verify, isCleanTree, headSha. Stamp binds to commit_sha (file-hash redundant per spec).
- `src/commands/gates.ts`: requires clean working tree before running (clear error if dirty); on all-pass writes `.taskforge/gate-stamp.json` ({commit_sha, gates, timestamp, runner_session}).
- `src/core/hook-logic.ts`: TS pre-commit (adds gate-stamp.json block) + pre-push (protected-branch + force-push guard); honors TASKFORGE_INTERNAL/TASKFORGE_DOCTOR bypass.
- `src/commands/hook.ts` + cli.ts: hidden `taskforge _hook <name>` dispatcher (reads push refs on stdin).
- `src/core/hooks.ts`: bash pre-commit gains gate-stamp.json block. `.gitignore` ignores the stamp.

Tests: 10 (gate-stamp) + 8 (hook) + gates tests updated for clean-tree/stamp/dirty-abort. Gates: typecheck clean, lint 0 errors, build success, 816/816 tests pass. Committed (9f9d7dd). Pre-push gate-stamp verification + branch-ownership check deferred to TASK-309.

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:
