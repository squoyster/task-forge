---
id: TASK-219
type: Documentation
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 9ee05952d2d2a685
spec_hash: f3bbc1fd8e435091
---

# TASK-219: Document command invariants and state machine in docs/architecture/

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

- [x] `docs/architecture/command-state-machine-and-invariants.md` exists with all 14 sections — `docs/architecture/command-state-machine-and-invariants.md` created with 290 lines, sections 1–14
- [x] Documentation explicitly states agents must not use raw `git` to bypass TaskForge — Section 1: "Agents must not use raw git to bypass TaskForge"
- [x] Documentation explicitly states agents must never use `--force` — Sections 9 & 14: "Normal agents may never use --force"
- [x] Documentation defines valid next actions for every CLI command registered in `src/cli.ts` — CLI Command Registry lists all 42 commands with state machine tables
- [x] Documentation defines error closure behavior for known and unknown errors — Section 13: 27 known error codes with source and recovery + unknown error policy
- [x] README command table matches implemented CLI commands (including `ac-check`) — README.md verified with all 41 commands listed
- [x] TASKFORGE.md command lists match implemented CLI commands — TASKFORGE.md verified with all commands listed
- [x] `doctor --fix` mismatch is noted and cross-referenced to implementation task — Section 8: explicit mismatch note + TASK-226 reference in Related Tasks


## Agent Notes

### 2026-05-28 System
- Cleanup: worktree and branch removed

### 2026-05-28 System
- Task marked Done

### 2026-05-28 System
- Report generated — task moved to Review
- Changed files: README.md, docs/architecture/command-state-machine-and-invariants.md
- Commits: acef9bd TASK-219: Document command invariants and state machine
- AC section: present
- AC has unchecked items

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-219

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-219

### 2026-05-28 System
- Task claimed via taskforge start TASK-219
- Session: a2a33eac3d
- Branch: agent/TASK-219-document-command-invariants-and-state-ma--a2a33eac3d
