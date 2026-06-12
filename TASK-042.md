---
id: TASK-042
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-042: Global Doctor-Lock — Pause All Agents During Recovery

## Goal

Add a `.doctor-lock` mechanism to task-state that, when present, causes all agents to pause before taking action — enabling a dedicated recovery agent to fix global inconsistencies without interference.

## Background

TASK-040 added per-agent guardrails (an agent can't start a new task without closing their current one). But some inconsistencies are global (duplicate task IDs across agents, task-state corruption, broken references) and require a coordinated recovery where ALL agents pause.

The mechanism: a file at `task-state/.doctor-lock` with a timestamp. All agents check for it before `next`/`claim`/`start`. If present and not expired, they print the lock reason and exit. The doctor agent creates the lock, fixes the problem, then removes it. A TTL prevents deadlock if the doctor crashes.

## Implementation

### New: `src/core/doctor-lock.ts`

```typescript
createDoctorLock(reason: string, repoRoot?: string): void
removeDoctorLock(repoRoot?: string): void
isDoctorLocked(repoRoot?: string): { locked: boolean; reason?: string }
```

Lock file format (`task-state/.doctor-lock`):
```json
{"reason":"Duplicate task IDs found: TASK-001","created":"2026-05-22T10:00:00Z","ttl_hours":1}
```

### Wired into:
- `src/commands/next.ts` — check before selection
- `src/commands/claim.ts` — check before claiming
- `src/commands/start.ts` — check before claiming
- `src/commands/done.ts` — auto-remove lock when completing a doctor recovery task
- `src/commands/doctor.ts` — create lock + recovery task when `--fix` finds critical issues

### Lock lifecycle:
1. `taskforge doctor --fix` finds critical inconsistency → creates `.doctor-lock` + recovery task
2. All agents check `.doctor-lock` before acting → pause if present
3. Doctor agent works the recovery task, marks it Done via `taskforge done`
4. `taskforge done` detects the completed task was a doctor recovery → removes `.doctor-lock`
5. All agents pull, see lock removed, resume normal operation

### TTL behavior:
- Default: 1 hour
- After TTL, the lock is considered stale and agents proceed (with warning)
- Prevents permanent deadlock if doctor agent crashes

## Acceptance Criteria

- [ ] `createDoctorLock(reason)` creates `task-state/.doctor-lock` with JSON content
- [ ] `removeDoctorLock()` deletes the lock file
- [ ] `isDoctorLocked()` returns `{ locked: true, reason }` when lock exists and is not expired
- [ ] `isDoctorLocked()` returns `{ locked: false }` when lock is expired (logs warning)
- [ ] `taskforge next` refuses if doctor-locked
- [ ] `taskforge claim` refuses if doctor-locked
- [ ] `taskforge start` refuses if doctor-locked
- [ ] `taskforge doctor` creates lock when `--fix` is passed and issues found
- [ ] `taskforge doctor --unlock` removes the lock
- [ ] JSON error output includes code `DOCTOR_LOCKED`
- [ ] Tests cover: lock creation, TTL expiry, agent refusal, unlock

## Dependencies

TASK-040 (session guardrail), TASK-038 (doctor)

## Risk Level

Medium — blocks all agents when active. TTL prevents permanent deadlock.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)

### 2026-05-22 System
- Task started via taskforge start TASK-042
- Session: 28bf60cee1
- Branch: agent/TASK-042-global-doctor-lock-pause-all-agents-duri--28bf60cee1
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-042
