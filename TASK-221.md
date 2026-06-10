---
id: TASK-221
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: c920478ff4788012
---

# TASK-221: Implement authority model and restrict --force to human/doctor mode

## Goal

## Goal

Create an authority model that prevents normal agents from using `--force`. Force must be available only to human operators or doctor-mode recovery.

## Context

Per `taskforge-control-plane-closure-spec.md` §1.2 Gap B, §2.2, and §7 Agent Prompt 4.

## Current State

- No `src/core/authority.ts` exists
- No role-based access control exists for CLI commands
- 7 commands have `--force` registered: `init`, `start`, `unlock`, `sweep`, `heartbeat`, `claim`, `cleanup`
- `done --force` is referenced in guidance messages but NOT registered in CLI (separate bug)

## Required Design

Create `src/core/authority.ts`:

```ts
export type ActorAuthority = "agent" | "human" | "doctor";

export function resolveAuthority(env: NodeJS.ProcessEnv, options: { force?: boolean }): ActorAuthority;
export function assertCanForce(authority: ActorAuthority): void;
```

Authority resolution policy:
- Default: `agent`
- `TASKFORGE_ACTOR=human` env var → `human`
- `TASKFORGE_ACTOR=doctor` env var → `doctor`
- Interactive terminal confirmation → `human` (future)

## Required Behavior

Every command with `--force` must call `assertCanForce(authority)` before acting. If rejected:

```json
{
  "ok": false,
  "error": { "code": "FORCE_REQUIRES_HUMAN_OR_DOCTOR", "message": "Normal agents may not use --force." },
  "nextActions": [
    { "command": "taskforge doctor --json", "reason": "Diagnose whether a recovery path exists.", "safety": "safe", "preferred": true },
    { "command": "taskforge block TASK-ID \"Force operation requires human or doctor-mode authorization\" --category unsafe_operation --blocked-by human", "reason": "Escalate unsafe operation.", "safety": "requires_human", "preferred": false }
  ]
}
```

## Affected Commands

- `init --force`
- `start --force`
- `unlock --force`
- `sweep --force`
- `heartbeat --force`
- `claim --force`
- `cleanup --force`

## Acceptance Criteria

- [ ] `src/core/authority.ts` exists with `ActorAuthority`, `resolveAuthority()`, `assertCanForce()`
- [ ] All 7 force commands check authority before acting
- [ ] Agent authority is rejected with structured error including `nextActions`
- [ ] Human authority (via env var) can perform force operations
- [ ] Doctor authority (via env var) can perform force operations
- [ ] Rejection error code is `FORCE_REQUIRES_HUMAN_OR_DOCTOR`
- [ ] Tests cover all 7 force commands with agent, human, and doctor authority
- [ ] AGENTS.md updated to state agents must never use `--force`

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-09T00:00:00Z System
- Cleanup: worktree and branch removed (authorized: human)

### 2026-06-09T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-221

### 2026-06-09T00:00:00Z System
- Task claimed via taskforge start TASK-221
- Session: c6fcc30df3
- Branch: agent/TASK-221-implement-authority-model-and-restrict-f--c6fcc30df3
