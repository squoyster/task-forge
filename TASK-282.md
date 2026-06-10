---
id: TASK-282
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 10a89007d70accfe
---

# TASK-282: Fix symlinked taskforge launcher path resolution

## Goal

## Goal

Ensure the repo-local `scripts/taskforge` launcher works when installed as a symlink in a global PATH location such as `~/.local/bin`.

## Acceptance Criteria

- [ ] Running `taskforge --help` from a symlinked install resolves the repository root correctly.
- [ ] The launcher finds `src/cli.ts` relative to the real checkout rather than the symlink location.
- [ ] Add a regression test or equivalent validation for symlinked launcher execution.
- [ ] The task passes `typecheck`, `lint`, and the launcher smoke check.

## Acceptance Criteria

- [ ]

## Agent Notes
