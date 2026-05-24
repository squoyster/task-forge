---
id: TASK-139
type: Bug
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
dependsOn:
  - TASK-135
  - TASK-136
  - TASK-137
---
# Report Invalid Done Tasks in Doctor

## Goal

Make existing invalid completions visible.

## Background

The repository already contains `Done` tasks with empty ACs and forced completion notes. `doctor` must flag these.

## Implementation Notes

- Reuse the AC validator from `done`.
- Report per-task diagnostics.
- JSON output must include machine-readable issue codes.

## Acceptance Criteria

- [ ] `taskforge doctor --json` reports every `Done` task that has missing, blank, or unchecked acceptance criteria using a stable machine-readable diagnostic code.

## Agent Notes
