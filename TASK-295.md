---
id: TASK-295
type: Bug
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: c21080d87e7f7ffc
---

# TASK-295: Make TaskForge lifecycle audit writes non-fatal or correctly surfaced

## Goal

## Goal
Prevent audit/transcript log write failures from corrupting or misleading lifecycle command results, especially after the primary operation has already succeeded.

## Background
During TASK-224, `taskforge checkpoint` committed changes but exited non-zero after failing to create or write `logs/taskforge/tasks/TASK-224/transcript.jsonl` with `EPERM`. `taskforge gates --json` also reported build/test gate failure until rerun with elevated filesystem permissions, while direct `npm run build` and `npm test` passed.

## Acceptance Criteria
- [ ] Lifecycle commands separate primary operation failures from audit/log persistence failures in structured output.
- [ ] If a checkpoint commit succeeds but audit write fails, the command reports the commit SHA and a warning/recovery path rather than an ambiguous failed command.
- [ ] Gate execution failures are not conflated with TaskForge audit/log write permission failures.
- [ ] Audit/log paths are resolved to a writable local runtime area or gracefully degraded when unavailable.
- [ ] Tests cover checkpoint-after-commit audit write failure, gate audit write failure, and normal successful audit persistence.
- [ ] Command JSON includes diagnostics identifying the exact failed log path and whether the primary operation completed.

## Evidence
Observed in TASK-224: `checkpoint` printed success, then errored with `EPERM: operation not permitted, mkdir/open .../logs/taskforge/tasks/TASK-224/...`; `gates --json` reported build/test failure until rerun with elevated write permissions.

## Acceptance Criteria

- [ ]

## Agent Notes
