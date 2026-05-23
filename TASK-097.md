---
id: TASK-097
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-097: Include diagnostic context in JSON error responses

## Goal

## Background

JSON error responses consistently provide less diagnostic information than their text-mode counterparts:

```
resume.ts:19   → JSON: "Task is not In Progress"
                 Text: "Task X is not In Progress (current: Y). Use 'taskforge start' to begin a new task."

start.ts:162   → JSON: "Failed to push claim for X."
                 Text: "Failed to push claim for X. The task may have been claimed by another agent."

done.ts:48     → JSON: "Run 'taskforge done --force' to override."
                 Text: (same, already problematic — see TASK-094)

claim.ts:60    → JSON: "System is in doctor recovery mode: X"
                 Text: (same — missing pause context, see TASK-096)
```

Scripts parsing JSON error output cannot get the full context (what to do next, why it happened, what the current state actually is). This makes programmatic consumers less capable than interactive users.

## Fix

Add a `details` field to JSON error responses that includes the explanatory text currently only present in text mode. For each affected command, add relevant context fields (current status, session ID, suggested next action).

## Scope

- `src/commands/resume.ts` (~line 19) — add current status and suggested action to JSON error
- `src/commands/start.ts` (~line 162) — add probable cause explanation to JSON error
- Any other commands where JSON mode loses context vs text mode

## Acceptance Criteria

- [ ] JSON error responses include a `details` field with explanatory context
- [ ] JSON errors include current state information (task status, session ID, etc.) where text mode does
- [ ] JSON errors suggest next actions where text mode does
- [ ] No change to text-mode output"

## Acceptance Criteria

- [ ]

## Agent Notes
