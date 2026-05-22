---
id: TASK-040
type: Feature
status: Inbox
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-040: Agent Capability Levels

## Goal

Define privilege levels for agents so that sensitive operations (raw git access, checkpoint management, task-state mutation) are gated behind an explicit capability model. Normal agents operate exclusively through `taskforge` commands; privileged agents can use raw git during maintenance windows.

## Background

Currently all agents have equal access — any agent can run `git merge`, `git push --force`, or manually edit task-state files. This led to TASK-034 being merged to main via raw git without `taskforge done` being called, leaving the task-state in an inconsistent state.

The fix: capability levels that gates should control which operations are permitted.

## Scope

### New/modified files:

- `src/core/capabilities.ts` — define capability levels and permission checks
- `src/core/session.ts` — add capability to session model
- `src/commands/start.ts` — gate worktree creation and claim on capability
- `src/commands/checkpoint.ts` (NEW) — checkpoint management commands (gated)
- `src/cli.ts` — register checkpoint subcommands
- `src/util/status-constants.ts` — add checkpoint-related status if needed

### Capability levels:

| Level | Permissions |
|-------|------------|
| `normal` | All taskforge commands; no raw git; no checkpoint ops; no task-state direct edits |
| `privileged` | Everything normal can do, plus: raw git access, checkpoint start/release, direct task-state mutation, task creation |

### Enforcement:

- Capability stored in the session (branch name or environment variable)
- `taskforge` commands check capability before executing gated operations
- If a normal agent attempts a privileged operation: error with clear message
- The system does NOT prevent raw git at the OS level — it detects and reports circumvention

## Acceptance Criteria

- [ ] `CapabilityLevel` enum: `normal`, `privileged`
- [ ] `hasCapability(sessionId, level)` function — returns boolean
- [ ] `requireCapability(sessionId, level)` function — throws `TaskForgeError` on insufficient privilege
- [ ] Session model extended with capability level
- [ ] `taskforge checkpoint start` requires privileged capability
- [ ] `taskforge checkpoint release` requires privileged capability
- [ ] `taskforge start` has capability check (currently no-op; future: gate worktree ops)
- [ ] All existing tests pass
- [ ] Tests cover: capability check passes/fails, privileged operations blocked for normal agents

## Dependencies

None — pure model addition, no integration dependencies.

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Risk Level

Medium — introduces a new permission model affecting all commands. Must not break existing workflows for unprivileged sessions.

## Continuation Policy

Auto-continue unless a stopping condition occurs.
