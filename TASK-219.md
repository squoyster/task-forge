---
id: TASK-219
type: Documentation
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-219: Document command invariants and state machine in docs/architecture/

## Goal

## Goal

Create authoritative documentation at `docs/architecture/command-state-machine-and-invariants.md` that defines the complete command-state contract for TaskForge as the mandatory control plane.

## Context

Per `taskforge-control-plane-closure-spec.md` §1.2 Gap A and §7 Agent Prompt 1. The `docs/architecture/` directory does not yet exist (referenced in README but absent).

## Required Content

1. TaskForge-only control-plane rule — agents must not use raw git to bypass TaskForge
2. Dedicated task-state source-of-truth rule (G1)
3. One-active-owned-task-per-session rule (G2)
4. Worktree isolation rule (G3)
5. Branch/task/session consistency rule (G4)
6. Valid status transitions table (G5)
7. Done evidence requirements (G7)
8. Doctor lock semantics (G8)
9. `--force` is human/doctor-only (Gap B)
10. Every command must emit `nextActions` (G9)
11. Unknown states must create closure tasks (G10)
12. Command-level state machines for all 33+ CLI commands
13. Error closure policy — known error codes mapped to recovery, unknown errors create tasks
14. Force restrictions — list every force path and mark as human/doctor-only

## Also Update

- `TASKFORGE.md` — ensure command lists match implemented CLI
- `README.md` — add missing `ac-check` to command table, verify all commands listed

## Acceptance Criteria

- [ ] `docs/architecture/command-state-machine-and-invariants.md` exists with all 14 sections
- [ ] Documentation explicitly states agents must not use raw `git` to bypass TaskForge
- [ ] Documentation explicitly states agents must never use `--force`
- [ ] Documentation defines valid next actions for every CLI command registered in `src/cli.ts`
- [ ] Documentation defines error closure behavior for known and unknown errors
- [ ] README command table matches implemented CLI commands (including `ac-check`)
- [ ] TASKFORGE.md command lists match implemented CLI commands
- [ ] `doctor --fix` mismatch is noted and cross-referenced to implementation task

## Acceptance Criteria

- [ ]

## Agent Notes
