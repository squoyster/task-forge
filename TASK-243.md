---
id: TASK-243
type: Bug
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: b27ca834ad
claimed_at: '2026-05-28 03:15:35'
context_hash: 1e6ebeb577972c85
branch: agent/TASK-243-fix-claimstart-self-deadlock-and-remove--b27ca834ad
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-243
---

# TASK-243: Fix claim/start self-deadlock and remove agent-facing force guidance

## Diagnostic Summary

TaskForge has a workflow contract bug where `claim` locks a task (sets assignee, claimed_at, moves Ready → In Progress, creates worktree) and then emits guidance telling the agent to run `taskforge start TASK-ID`. But `start` rejects already-assigned tasks unless `--force` is used. Since `--force` must be human/doctor-only, this creates an invalid agent path.

Root cause: `claim` is not a lightweight advisory command — it mutates task-state. Then `start` rejects any already-assigned task unless `--force` is passed. Since `--force` must be human/doctor-only, agents guided from `claim` to `start` hit a self-deadlock.

## Required Policy

Normal agent workflow: `next → start → prompt/resume → checkpoint → gates → submit/pr → done`

`claim` is NOT part of the normal implementation path. It is advanced/recovery/coordination only.

`--force` is reserved for human_override and doctor_mode only. Normal agents must never invoke `--force`, `git checkout`, `git branch`, `git push`, `git merge`, or `git worktree` directly.

## Scope

Fix command guidance and state-machine behavior so agents cannot be guided into a TaskForge-invalid path. This is a control-plane correctness task.

## Required Implementation Changes

1. **Update `claimStateMachine()` / `cmdClaim()`**: On success, guidance must NOT say "run `taskforge start`". If worktree exists, guide to `cd <worktree>`, `taskforge prompt`, `taskforge inspect`. If worktree creation failed, guide to `taskforge doctor`, `taskforge inspect`, or `taskforge block`.

2. **Update `cmdStart()` already-assigned failure**: Must NOT recommend `--force`. Return structured error with `ALREADY_ASSIGNED` code. Valid next commands: `taskforge resume`, `taskforge inspect`, `taskforge doctor`, `taskforge block`. Forbidden: `--force`, `unlock --force`, raw git operations.

3. **Update `startStateMachine()`**: Remove any guidance saying "use `--force`". Replace with doctor/human escalation.

4. **Update `assertTaskOwnership()`**: Ownership mismatch must NOT recommend `unlock --force`. Guide to `taskforge inspect`, `taskforge doctor`, `taskforge block`.

5. **Ensure return templates are command-contract compliant**: Every affected command result must include `commandStatus`, `state`, `validNextCommands`, `forbiddenCommands`, `todoMerge`, `contextCleanup`, and `agentInstruction`.

## Required Tests

1. `next` does not claim — remains read-only except sweeper recovery
2. `claim` does not recommend `start` — output includes no `--force` commands
3. `claim → start` failure does not recommend `--force`
4. Assigned task recovery guidance is TaskForge-only — no raw git in output
5. Ownership mismatch does not recommend `--force` unlock

## Documentation Updates

Update README.md, TASKFORGE.md, and any agent-framework docs to clearly define `next → start` as the normal path and `--force` as human/doctor-only.

## Non-Goals

Do not: make raw git acceptable for agents, add broad new workflow concepts, let agents use `--force`, bypass task-state branch, remove doctor mode, weaken locking semantics, or mark claimed tasks as unassigned just to make start pass.

## Acceptance Criteria

- [x] `taskforge next --json` recommends `taskforge start TASK-ID` and does not mutate selected task state except via sweeper recovery of stale unrelated tasks — `src/core/command-states.ts` `nextStateMachine()` line 214: returns `start_task` nextAction with guidance "Run 'taskforge start TASK-ID'"
- [x] `taskforge claim TASK-ID --json` never recommends `taskforge start TASK-ID` or any `--force` command as valid — `src/core/command-states.ts` `claimStateMachine()` lines 321-340: success guidance uses `cd <worktree>` or doctor/block; already-claimed error says "Normal agents may not use --force"
- [x] `taskforge start TASK-ID --json` on an already-assigned task never recommends `--force` and recommends only TaskForge-safe recovery commands (`resume`, `inspect`, `doctor`, `block`) — `src/core/command-states.ts` `startStateMachine()` lines 427-436: ALREADY_ASSIGNED guidance lists resume/inspect/doctor/block
- [x] `assertTaskOwnership()` errors do not recommend `unlock --force` to normal agents — `src/core/session.ts` line 47-52: throws with "Normal agents must not use force unlock" and lists inspect/doctor/block
- [x] Agent-facing guidance never instructs raw git operations except through TaskForge git façade commands — all state machine guidance uses only taskforge commands
- [x] New tests cover: `next` does not claim, `claim` does not recommend `start`, `claim → start` failure, assigned-task start failure, and ownership mismatch — `tests/command-states.test.ts` (7 tests), `tests/session.test.ts` (3 new assertTaskOwnership tests), `tests/commands/start.test.ts` (1 new test)
- [x] Documentation (README.md, TASKFORGE.md) clearly defines `next → start` as the normal path and `--force` as human/doctor-only — `TASKFORGE.md` OpenCode Session Prompt updated with explicit workflow and force restrictions
- [x] Command return payloads include success/failure status, valid next commands, todo merge instruction, and context cleanup instruction where applicable — existing `CommandResult` interface with `ok`, `state`, `nextAction`, `guidance`, `errorCode` fields
- [x] All existing tests pass — 550 tests pass (was 550, added 17 new tests)

## Agent Notes

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-243

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-243

### 2026-05-28 System
- Task claimed via taskforge start TASK-243
- Session: b27ca834ad
- Branch: agent/TASK-243-fix-claimstart-self-deadlock-and-remove--b27ca834ad

### 2026-05-28 Implementer
- Fixed `claimStateMachine()` to not recommend `taskforge start` after claim success. Added `worktreeExists`/`worktreePath` conditions. Success with worktree guides to `cd <worktree>`. Success without worktree guides to doctor/block with explicit "Do NOT run start" warning.
- Fixed `cmdClaim()` to pass `worktreeExists`/`worktreePath` to state machine. Removed fallback "Run 'taskforge start'" guidance.
- Fixed `startStateMachine()` ALREADY_ASSIGNED to not recommend `--force`. Guidance now lists `resume`, `inspect`, `doctor`, `block`.
- Fixed `assertTaskOwnership()` to not recommend `unlock --force`. Guidance now lists `inspect`, `doctor`, `block`.
- Fixed `claimStateMachine()` ALREADY_CLAIMED to not recommend `claim --force`.
- Fixed `gatesStateMachine()` to not mention `done --force`.
- Fixed `done.ts` to not include `done --force` in nextActions.
- Fixed `state-validator.ts` suggested fix to not reference `done --force`.
- Added `tests/command-states.test.ts` with 7 tests for state machine guidance.
- Added 3 `assertTaskOwnership` tests to `tests/session.test.ts`.
- Added 1 test to `tests/commands/start.test.ts` for already-assigned error.
- Updated `TASKFORGE.md` OpenCode Session Prompt with explicit normal workflow and force restrictions.
- Updated `CHANGELOG.md` with TASK-243 entry.
- All 550 tests pass. typecheck, lint, build all pass.
