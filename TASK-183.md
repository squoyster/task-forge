---
id: TASK-183
type: Feature
status: Done
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-183: Enhance timeline command with actionable audit detail

## Goal

The current `taskforge timeline` command only shows event counts and timestamps. It should surface what actually happened during a task's lifecycle: files changed, commands run, status transitions, and key decisions. Make it useful for post-task review and debugging.

## Context

Current output from `cmdTimeline` (`src/commands/audit.ts`):
```
Timeline: TASK-001
Total events: 5
From: 2026-05-25 01:00:00
To:   2026-05-25 02:00:00
Errors: 0

Event breakdown:
task.command.started: 1
task.command.completed: 1
git.commit: 2
git.push: 1
```

This is just a summary — no detail about what each event actually did. The raw events in `transcript.jsonl` have `summary` and `metadata` fields that could provide richer output.

## Scope

### 1. Enrich timeline output

In `src/commands/audit.ts`, update `cmdTimeline` to show per-event detail:
- Timestamp + event type + summary (from `AuditEvent.summary`)
- For `git.commit`: show commit message (from `metadata.message` if available)
- For `task.state.changed`: show old → new status
- For `task.command.completed`: show what was done
- For `tool.execute` / `file.edited`: show the tool or file path
- Group events by phase (start → work → complete) if possible

### 2. Add structured timeline entries

Update `summarizeTaskAudit()` in `src/core/audit.ts` to return a `TimelineEntry[]` alongside the summary:
```typescript
interface TimelineEntry {
  timestamp: string;
  event: string;
  summary: string;
  detail?: string;  // extracted from metadata
}
```

### 3. Human-readable format

Default output should be a chronological list:
```
Timeline: TASK-001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
01:00:00  ▶ task.command.started      Task claimed by session abc123
01:05:00  ┃ git.commit                feat: add validation (abc1234)
01:10:00  ┃ git.push                  Pushed agent/TASK-001 to origin
01:30:00  ┃ file.edited               src/commands/validate.ts (+42 lines)
01:45:00  ✔ task.command.completed    All gates passed, marked Done
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Duration: 45m  |  Events: 5  |  Errors: 0
```

### 4. JSON output

`--json` should return the enriched entries array alongside the summary counts.

## Acceptance Criteria

- [x] `taskforge timeline <taskId>` shows per-event detail including summary text, not just counts — `src/commands/audit.ts` `cmdTimeline`: displays chronological entries with timestamp, event type, summary, and extracted detail
- [x] Event-specific metadata is extracted and displayed (commit messages, file paths, status transitions) — `src/core/audit.ts` `extractEventDetail()`: handles git.commit (message), git.push (branch), task.state.changed (from→to), file.edited (file+lines), tool.execute (tool name)
- [x] Output includes a duration calculation (first event to last event) — `TaskAuditSummary.durationMinutes` computed from first/last timestamps
- [x] `--json` output includes the enriched entries array — `cmdTimeline` with `--json` returns full `TaskAuditSummary` including `entries[]` and `durationMinutes`
- [x] Existing `summarizeTaskAudit()` return type is extended without breaking callers — Added `entries` and `durationMinutes` fields to `TaskAuditSummary` interface; existing fields unchanged
- [x] Tests added for the enriched timeline output — `tests/timeline.test.ts`: 10 tests covering empty entries, detail extraction, duration calculation, enriched output, JSON output, empty state
- [x] All existing tests pass — All 507 tests pass (49 test files)

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

None.

## Risk Level

Low — enhances existing command, does not change audit event generation.

## Agent Notes

### 2026-05-25 Implementer
- Added `TimelineEntry` interface and `entries[]`/`durationMinutes` to `TaskAuditSummary`
- Created `extractEventDetail()` for metadata extraction from 5 event types
- Rewrote `cmdTimeline` output: chronological list with icons (▶ start, ┃ work, ✔ complete, ✘ errors), detail text, duration footer
- Added 10 tests in `tests/timeline.test.ts`
- All 507 tests pass. Typecheck, lint, and build pass.
