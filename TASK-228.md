---
id: TASK-228
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 1ae14fe502
claimed_at: '2026-06-15 18:30:19'
context_hash: 86c2d0ddbd80d3ed
spec_hash: b10668fe7d0a9af3
branch: agent/TASK-228-register-done-force-in-cli-and-implement--1ae14fe502
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-228
---

# TASK-228: Register done --force in CLI and implement gate bypass with authority check

## Goal

## Goal

`done --force` is referenced in guidance and error messages but is NOT registered in `src/cli.ts` and NOT implemented in `cmdDone()`. This creates a gap where agents are told to use a command that does not exist.

## Context

Discovered during exploration for control-plane closure spec. `done.ts:65` and `command-states.ts:545` both reference `done --force` as a recovery action for failed gates, but Commander does not recognize the flag.

## Current State

- `src/cli.ts` registers `done` with: `--cleanup`, `--delete-branch`, `--json` — NO `--force`
- `src/commands/done.ts` does not check for or handle a `force` option
- Error messages in `done.ts` and `command-states.ts` tell agents to use `done --force`
- This is a dead-end: agents follow the guidance and hit an unrecognized option

## Required Changes

1. Register `--force` in `src/cli.ts` for the `done` command
2. Add `force?: boolean` to `DoneOptions` interface in `done.ts`
3. When `--force` is used and gates fail:
   - Check authority via `assertCanForce(authority)` (from TASK-221)
   - If authorized, bypass gate check but record override in agent notes
   - Set `override_reason`, `override_actor`, `override_timestamp`, `override_failed_gates` in frontmatter
4. Update error messages to only reference `done --force` when authority is human/doctor
5. For agent authority: error message should say "Gates failed. Fix and re-run, or block for human."

## Acceptance Criteria

- [ ] `--force` option registered in `src/cli.ts` for `done` command
- [ ] `done --force` bypasses gate check when authority is human/doctor
- [ ] `done --force` rejected for agent authority with structured error
- [ ] Override metadata recorded in task frontmatter (`override_reason`, `override_actor`, `override_timestamp`, `override_failed_gates`)
- [ ] Agent notes record the force override
- [ ] Error messages do not reference `--force` to agent authority
- [ ] Tests cover `done --force` with passing gates, failing gates, and all authority levels

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-15T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: src/cli.ts, src/commands/done.ts, src/core/command-states.ts, tests/commands/done.test.ts
- Commits: 0d10cf0 TASK-228: Register done --force in CLI and implement gate bypass with authority check
- AC section: present
- AC has unchecked items

### 2026-06-15T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-228

### 2026-06-15T00:00:00Z System
- Task claimed via taskforge start TASK-228
- Session: 1ae14fe502
- Branch: agent/TASK-228-register-done-force-in-cli-and-implement--1ae14fe502
