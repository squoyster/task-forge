---
id: TASK-051
type: Feature
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-045
  - TASK-046
context_hash: 27705145f76d1ff7
spec_hash: 4be9b80cb9c1cb93
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-051
issue: 111
---

# TASK-051: Implement Doctor-Mode Recovery as Privileged Transactional Operation

## Goal

Make the doctor-lock lifecycle a first-class transactional operation: `doctor --fix` creates a lock + recovery task through the transaction layer, only doctor/recovery agents may work the recovery task, completing it removes the lock — all validated, auditable, and event-logged.

## Required Flow

```
doctor --fix
  → validates state
  → detects critical issue
  → creates .doctor-lock (via transaction layer)
  → creates DOCTOR/TASK recovery task (via transaction layer)
  → commits/pushes both atomically
  → all normal agents pause (check .doctor-lock)
  → only doctor/recovery agent may work recovery task
  → completing recovery task (taskforge done) removes .doctor-lock
  → lock removal is validated and event-logged
```

## Key Requirements

- Lock creation and removal use the transaction layer (TASK-045)
- Lock includes `recoveryTaskId` reference
- `done` detects recovery task and removes lock only if task is genuinely Done
- Invariant validator (TASK-046) checks lock consistency
- Event-log entries for lock creation and removal
- TTL prevents deadlock if doctor crashes

## Acceptance Criteria

- [ ] `doctor --fix` creates lock + recovery task via transaction layer
- [ ] `done` auto-removes lock when recovery task completes
- [ ] Only doctor/recovery tasks can operate during lock (normal agents paused)
- [ ] Lock lifecycle is event-logged
- [ ] Invariant validator checks lock consistency
- [ ] Tests cover lock create, recover, remove, TTL expiry
- [ ] All existing tests pass

## Dependencies

TASK-045, TASK-046, TASK-042 (doctor-lock infrastructure).

## Risk Level

Medium.

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)
- Completed despite gate failures — forced.

### 2026-05-22 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-051

### 2026-05-22 System
- Task claimed via taskforge start TASK-051
- Session: da2f6ad842
- Branch: agent/TASK-051-implement-doctor-mode-recovery-as-privil--da2f6ad842
