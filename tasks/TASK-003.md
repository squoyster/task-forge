---
id: TASK-003
type: Task
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-003: Add --json flag to status command for programmatic output

## Goal

Add a `--json` flag to the `taskforge status` command that outputs the same information in JSON format for programmatic consumption by CI, opencode hooks, and other tools.

## Background

The `status` command currently outputs human-readable colored text. Other tools (CI pipelines, opencode hooks, dashboards) need machine-parseable output. A `--json` flag provides this without breaking existing behavior.

## Scope

Allowed files/directories:
- src/commands/status.ts
- tests/

Disallowed files/directories:
- .git/**
- src/cli.ts (unless absolutely necessary)
- package.json

## Acceptance Criteria

- [ ] `taskforge status --json` outputs valid JSON to stdout
- [ ] JSON output includes: total tasks, counts by status, and for each status group, task id, priority, and title
- [ ] `taskforge status` (without --json) continues to produce human-readable colored output
- [ ] All existing tests continue to pass
- [ ] Unit tests cover the JSON output format

## Test / Verification Command

```bash
npm run build && npm test -- --run && taskforge status --json | jq .
```

## Expected Output / Behavior

- `taskforge status --json` outputs a JSON object with keys: `total`, `byStatus`, `tasks`
- `taskforge status` (no flag) outputs identical human-readable format as before
- JSON output is the only stdout content (no log decorations)

## Dependencies

None

## Risk Level

Low

## Risks

- Must ensure JSON output goes to stdout without any log decorations mixing in

## Human Intervention Required?

No

## Continuation Policy

Auto-continue unless a stopping condition occurs.
