---
id: TASK-245
type: Task
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-245: Display all timestamps with UTC designator or map to current timezone

## Goal

## Goal\nAll timestamps displayed by TaskForge CLI commands should clearly indicate their timezone. Currently, timestamps are displayed in UTC but without a 'Z' suffix or timezone indicator, causing user confusion about whether times are local or UTC.\n\n## Acceptance Criteria\n- [ ] Identify all locations in the codebase where timestamps are displayed to users (Markdown output and JSON output)\n- [ ] All timestamps in Markdown output should include 'Z' suffix for UTC times OR be converted to local timezone with explicit timezone indicator\n- [ ] All timestamps in JSON output should use ISO 8601 format with timezone designator (e.g., '2024-01-01T00:00:00Z' for UTC)\n- [ ] Update task display commands (status, summary, next, etc.) to show timezone-aware timestamps\n- [ ] Update agent notes and session timestamps to include timezone indicators\n- [ ] Add tests verifying timestamp format includes timezone designator\n- [ ] All existing tests pass after changes\n\n## Current Behavior\nTimestamps like '2024-01-01T00:00:00' are displayed without timezone indicator, leading users to assume local time when they are actually UTC.\n\n## Expected Behavior\nTimestamps should be displayed as '2024-01-01T00:00:00Z' (UTC) or converted to local time with explicit timezone like '2024-01-01T00:00:00+05:30'.

## Acceptance Criteria

- [ ]

## Agent Notes
