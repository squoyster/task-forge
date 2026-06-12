---
id: TASK-222
type: Feature
status: Submitted
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: d3b07f8a4b
claimed_at: '2026-06-11 23:30:40'
context_hash: 6cd5541d1cdfd05c
branch: agent/TASK-222-refactor-command-state-machine-registry--d3b07f8a4b
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-222
---

# TASK-222: Refactor command-state-machine registry to spec shape with full command coverage

## Goal

## Goal

Refactor the existing `src/core/command-states.ts` to match the spec's required shape and ensure coverage for all 33+ CLI commands.

## Context

Per `taskforge-control-plane-closure-spec.md` §1.2 Gap E, §4, and §7 Agent Prompt 2.

## Current State

`src/core/command-states.ts` (774 lines) exists with 8 state machines:
- `nextStateMachine`, `claimStateMachine`, `startStateMachine`, `checkpointStateMachine`
- `gatesStateMachine`, `submitStateMachine`, `doneStateMachine`, `newStateMachine`

Each returns a `CommandResult` with: `ok`, `state`, `nextAction` (single string from 16-value union), `guidance`, `errorCode?`, `context?`.

## Gap Analysis

The existing shape does NOT match the spec:

| Spec Requires | Current Has |
|---|---|
| `nextActions: NextAction[]` (array) | `nextAction: NextAction` (single string) |
| `NextAction.safety: Safety` | Not present |
| `NextAction.preferred: boolean` | Not present |
| `NextAction.stateTransition?: {from, to}` | Not present |
| `CommandStateRule` with preconditions | Not present |
| `getErrorGuidance(command, code, ctx)` | Not present |
| Coverage for all 33+ commands | Only 8 commands covered |

## Required Design

1. Update `NextAction` type to match spec:
```ts
export type Safety = "safe" | "requires_human" | "doctor_only" | "blocked";
export interface NextAction {
  command: string;
  reason: string;
  safety: Safety;
  preferred: boolean;
  stateTransition?: { from: string; to: string };
}
```

2. Add `CommandStateRule` interface:
```ts
export interface CommandStateRule {
  command: string;
  allowedStatuses?: string[];
  forbiddenStatuses?: string[];
  requiresTask?: boolean;
  requiresWorktree?: boolean;
  requiresNoDoctorLock?: boolean;
  forbidsAgentForce?: boolean;
  nextActions: NextAction[];
  errorActions: Record<string, NextAction[]>;
}
```

3. Add registry functions:
```ts
export function getNextActions(commandName: string, context: object): NextAction[];
export function getErrorGuidance(commandName: string, errorCode: string, context: object): NextAction[];
```

4. Add entries for ALL commands: `init`, `next`, `start`, `status`, `summary`, `gates`, `block`, `done`, `sync`, `list`, `unlock`, `sweep`, `heartbeat`, `inspect`, `claim`, `report`, `cleanup`, `new`, `prompt`, `resume`, `doctor`, `config-validate`, `release`, `reject`, `validate-state`, `audit`, `transcript`, `timeline`, `ac-check`, `diff`, `checkpoint`, `submit`, `pr`, `deps *`

5. Mark all force paths as `doctor_only` or `requires_human`

## Note

This task overlaps with TASK-216. TASK-216 should be rejected or merged into this task.

## Acceptance Criteria

- [ ] `NextAction` type matches spec shape with `safety`, `preferred`, `stateTransition`
- [ ] `CommandStateRule` interface defined with all precondition fields
- [ ] `getNextActions(commandName, context)` function implemented
- [ ] `getErrorGuidance(commandName, errorCode, context)` function implemented
- [ ] Registry covers every CLI command registered in `src/cli.ts` (33+ commands)
- [ ] All force paths marked as `doctor_only` or `requires_human`
- [ ] Known error codes mapped to valid next actions
- [ ] Unknown error returns a `taskforge new ...` closure task command
- [ ] Tests fail if a CLI command exists with no registry entry
- [ ] Existing 8 state machines migrated to new shape without losing coverage

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-11T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present
- AC has unchecked items

### 2026-06-11T00:00:00Z System
- Heartbeat: lease renewed (reset from 2026-06-11 23:14:01)

### 2026-06-11T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-222

### 2026-06-11T00:00:00Z System
- Task claimed via taskforge start TASK-222
- Session: d3b07f8a4b
- Branch: agent/TASK-222-refactor-command-state-machine-registry--d3b07f8a4b
