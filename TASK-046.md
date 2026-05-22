---
id: TASK-046
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
dependsOn:
  - TASK-045
---

# TASK-046: Add State Invariant Validator and CI/Doctor Gate

## Goal

Add a centralized invariant validator for task-state and expose it through CLI (`taskforge validate-state`) and doctor checks. Detect logically impossible or suspicious task states before they are committed, pushed, or accepted by CI.

## Required Invariants

- `Done`/`Ready`/`Rejected`/`Deferred` must not have `assignee` or `claimed_at`
- `In Progress` should have `assignee` and `claimed_at`
- `Blocked` must have `blocked_reason`, should have `blocked_since`/`blocked_by`
- Task filename must match frontmatter `id`
- Task IDs must be unique
- `dependsOn` must reference existing IDs, no self-dependency
- Circular dependencies detected
- `.doctor-lock` consistency validated

## Acceptance Criteria

- [ ] Validator module in `src/core/state-validator.ts`
- [ ] CLI command `taskforge validate-state` with `--json` and `--strict`
- [ ] Doctor calls validator and includes issues in report
- [ ] Unambiguous fixes auto-applied by `doctor --fix` (Done+claim → clear)
- [ ] Tests for all invariants above
- [ ] All existing tests pass

## Dependencies

TASK-045 (transaction layer for commit-time validation).

## Risk Level

High.
