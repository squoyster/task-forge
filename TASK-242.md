---
id: TASK-242
type: Task
status: Rejected
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 9a843bb42f77c29e
---

# TASK-242: Add timestamps to AgentNotes for audit duration tracking

## Goal

AgentNotes should include full timestamps (date + time) so agents and humans can audit how long task operations took.

## Problem

AgentNotes currently only record the date (e.g., `### 2026-05-28 System`). Without time information, it's impossible to determine:
- How long between task start and completion
- How long individual operations took
- Whether tasks are progressing or stalled
- Session activity timelines

## Required Changes

### 1. Update AgentNote Format
- Change from `### YYYY-MM-DD Role` to `### YYYY-MM-DD HH:MM:SS Role`
- Use UTC timestamps for consistency across timezones
- Format: `### 2026-05-28 14:32:07 System`

### 2. Update appendAgentNote() Function
- Modify `src/core/task-store.ts` `appendAgentNote()` to include time in the timestamp
- Ensure all callers pass or generate the full timestamp

### 3. Update Task Templates
- Update task file templates to use full timestamp format
- Update any existing documentation that references the date-only format

### 4. Backward Compatibility
- Existing date-only notes should remain valid (no migration required)
- New notes use full timestamps
- Parsing logic should handle both formats

## Acceptance Criteria

- [ ] `appendAgentNote()` generates timestamps with time (YYYY-MM-DD HH:MM:SS)
- [ ] All agent notes in new task files include full timestamps
- [ ] Task templates updated to use full timestamp format
- [ ] Existing date-only notes remain parseable (backward compatible)
- [ ] Test coverage for timestamp generation and parsing
- [ ] Documentation updated (AGENTS.md references if applicable)

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Recalibration - pre-306 task pool retired, superseded by 306+ frontier.
