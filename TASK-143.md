---
id: TASK-143
type: Feature
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-142
---
# Add Upstream Failure Classification to Gates

## Goal

Support the workflow where a broken test suite or unrelated failure becomes a new bug task.

## Background

Agents need an explicit path when the failing condition is not caused by the current task.

## Implementation Notes

Possible interface:

```bash
taskforge gates --json --classify-upstream "reason text"
```

or a follow-up command:

```bash
taskforge gates classify-upstream TASK-ID --reason "..."
```

Pick the cleanest design consistent with the CLI.

## Acceptance Criteria

- [ ] A gates failure can be explicitly classified as upstream, causing JSON output to emit `nextAction.kind = "CREATE_BUG_TASK_AND_CONTINUE"` with an instruction to create a bug task and continue only if safe.

## Agent Notes
