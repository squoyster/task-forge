---
id: TASK-223
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 8a295a3bff60e1c4
---

# TASK-223: Wire structured nextActions to all command JSON and human-readable outputs

## Goal

## Goal

Every TaskForge command must return explicit valid next actions in both JSON and human-readable output, matching the spec's required output contract.

## Context

Per `taskforge-control-plane-closure-spec.md` §1.2 Gap D, §5, and §7 Agent Prompt 3.

## Current State

`src/util/json-result.ts` has:
- `nextActions?: string[]` — just an array of command strings, not the spec's structured `NextAction[]`
- `guidance?: string` — freeform text
- No `safety`, `preferred`, or `stateTransition` fields
- Human-readable output uses ad-hoc `logInfo("Next actions:")` with `logSub()` bullets

Some commands (block, done, gates, new, resume, release, reject) already have basic next-actions guidance added, but they use the old `string[]` shape.

## Required JSON Shape

```ts
export interface CommandResult {
  ok: boolean;
  command: string;
  task?: JsonTask;
  workspace?: JsonWorkspace;
  state?: Record<string, unknown>;
  nextActions: NextAction[];
  error?: CommandError;
}

export interface NextAction {
  command: string;
  reason: string;
  safety: "safe" | "requires_human" | "doctor_only" | "blocked";
  preferred: boolean;
  stateTransition?: { from: string; to: string };
}

export interface CommandError {
  code: string;
  message: string;
  handled: boolean;
  createTaskCommand?: string;
}
```

## Required Human Output

Every command must end with:
```
Valid next actions:
1. taskforge ...
   Reason: ...
   Safety: safe | requires_human | doctor_only | blocked
```

## Required Changes

1. Update `src/util/json-result.ts` with spec-compliant types
2. Add `printNextActions(actions: NextAction[])` to `src/util/logging.ts`
3. Update ALL command files to use structured `NextAction[]` in both JSON and human output
4. Ensure error outputs include `error.code`, `error.handled`, and `nextActions`
5. For `start` success: preferred action should be `cd <worktree>`
6. For force-required cases: never recommend `--force` to agents

## Affected Commands (all 33+)

`init`, `next`, `start`, `status`, `summary`, `gates`, `block`, `done`, `sync`, `list`, `unlock`, `sweep`, `heartbeat`, `inspect`, `claim`, `report`, `cleanup`, `new`, `prompt`, `resume`, `doctor`, `config-validate`, `release`, `reject`, `validate-state`, `audit`, `transcript`, `timeline`, `ac-check`, `diff`, `checkpoint`, `submit`, `pr`

## Note

This task overlaps with TASK-215 and TASK-218. Those should be rejected or merged into this task.

## Acceptance Criteria

- [ ] `json-result.ts` types match spec shape (`NextAction` with `safety`, `preferred`, `stateTransition`)
- [ ] `CommandError` interface defined with `code`, `message`, `handled`, `createTaskCommand?`
- [ ] `next --json` includes structured `nextActions`
- [ ] `start --json` includes structured `nextActions`
- [ ] `claim --json` includes structured `nextActions`
- [ ] `done --json` includes structured `nextActions`
- [ ] `block --json` includes structured `nextActions`
- [ ] `gates --json` includes structured `nextActions`
- [ ] All error JSON includes `nextActions` with recovery guidance
- [ ] Human-readable output ends with "Valid next actions:" section for all commands
- [ ] No output suggests normal-agent use of `--force`
- [ ] Tests cover representative success and failure paths for at least 10 commands

## Acceptance Criteria

- [ ]

## Agent Notes
