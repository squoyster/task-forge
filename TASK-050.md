---
id: TASK-050
type: Security
status: Done
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-045
  - TASK-046
context_hash: 27705145f76d1ff7
spec_hash: 734ca9f57268b6e4
issue: 110
---

# TASK-050: Split Generic `--force` Into Explicit Privileged Override Modes

## Goal

Replace broad, ambiguous `--force` behavior with explicit override modes: `--force-ownership`, `--force-transition`, `--force-gates`, `--force-cleanup`, `--doctor-recovery`, `--admin`. Each dangerous override must be explicit and auditable.

## Commands to Audit

`start`, `claim`, `done`, `block`, `unlock`, `heartbeat`, `sweep`, `doctor`, `cleanup`

## Backward Compatibility

Keep `--force` temporarily with deprecation warning. Eventually reject `--force` on high-risk commands.

## Acceptance Criteria

- [ ] Generic `--force` is not the only control for unrelated override types
- [ ] Dangerous overrides require explicit named flags
- [ ] Override use is event-logged
- [ ] Normal agent path remains simple
- [ ] Tests cover new override behavior
- [ ] All existing tests pass

## Dependencies

TASK-045, TASK-046.

## Risk Level

Medium.

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)
- Completed despite gate failures — forced.
- Worktree removed: /Volumes/Transcend/devel/worktrees/task-forge/TASK-050
- Worktree and branch fields cleared from task frontmatter.

### 2026-05-22 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-050

### 2026-05-22 System
- Task claimed via taskforge start TASK-050
- Session: 6b6f55b314
- Branch: agent/TASK-050-split-generic-force-into-explicit-privil--6b6f55b314
