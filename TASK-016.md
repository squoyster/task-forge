---
id: TASK-016
type: Enhancement
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-016: Normalize Task Status Values

## Goal

Enforce one canonical internal enum for task status values. Currently, the status `"In Progress"` (Title Case with space) is used throughout the codebase. The analysis recommends moving to lowercase, machine-safe values internally, with human labels rendered separately in CLI output.

## Background

The architecture gap analysis identified that status casing can be fragile:

```yaml
# Current (mixed casing, YAML needs quoting)
status: "In Progress"
status: "Needs Spec"

# Recommended canonical machine values
status: ready
status: in_progress
status: blocked
status: review
status: verify
status: done
status: needs_spec
status: rejected
status: deferred
```

YAML values with spaces (like `"In Progress"`) require quoting, which is error-prone. Lowercase snake_case values are YAML-safe without quotes and are the conventional machine enum format.

## Scope

### Schema changes

- `src/core/task.ts` — update `TaskSchema.status` enum to lowercase values
- `src/core/status-transition.ts` — update transition map keys

### CLI rendering layer

- `src/commands/status.ts` — render human labels from canonical values
- `src/commands/summary.ts` — render human labels
- `src/commands/list.ts` — accept both input formats, normalize
- `src/util/status-labels.ts` — NEW: mapping canonical → human labels

### Command changes

- `src/commands/start.ts`, `done.ts`, `block.ts`, `sweep.ts` — update literal status comparisons
- `src/core/scheduler.ts` — update status scoring keys
- `src/integrations/github/types.ts` — update mapping

### Test changes

- All tests with status literals need updating
- NEW: tests for normalization layer

## Acceptance Criteria

- [ ] Status schema has canonical lowercase internal values (`ready`, `in_progress`, `blocked`, etc.)
- [ ] `src/util/status-labels.ts` provides `canonicalToHuman()` and `humanToCanonical()` mapping functions
- [ ] CLI renders human labels (`Ready`, `In Progress`) in user-facing output
- [ ] CLI accepts both human and canonical input in `--status` filters
- [ ] All writes emit canonical values
- [ ] Tests cover old and new format parsing
- [ ] All existing tests pass with updated status values

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-015 (jittered retries) — should be merged first to avoid merge conflicts.

## Risk Level

Medium — touches many files with a value-level change. Tests catch most issues.

## Continuation Policy

Auto-continue unless a stopping condition occurs.
