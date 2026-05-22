---
id: TASK-050
type: Security
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-045
  - TASK-046
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
