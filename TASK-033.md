---
id: TASK-033
type: Feature
status: Done
priority: P3
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 04fef95005
claimed_at: '2026-05-22 07:30:24'
---

# TASK-033: Add `config validate` Command

## Goal

Add `taskforge config validate` that reads `.taskforge/config.json`, validates it against the expected schema, and reports any issues — enabling agents to catch configuration errors before they cause runtime failures.

## Background

Configuration errors (malformed JSON, missing required keys, invalid gate commands) currently surface as opaque runtime errors in unrelated commands. A dedicated validation command gives early feedback.

## Usage

```bash
taskforge config validate                # Validate and report
taskforge config validate --json          # Structured validation result
taskforge config validate --fix           # Apply defaults for missing optional keys
```

## Acceptance Criteria

- [ ] Validates config.json is valid JSON
- [ ] Validates all known schema fields (gates, github, etc.)
- [ ] Reports unknown/unrecognized keys as warnings
- [ ] Validates gate commands are non-empty strings
- [ ] `--json` output includes validation errors with paths
- [ ] `--fix` adds missing optional keys with defaults (preserving existing values)
- [ ] Tests cover: valid config, invalid JSON, missing fields, unknown keys

## Dependencies

TASK-018 (gates config schema)

## Risk Level

Low — read-only validation (--fix is opt-in and conservative).

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-033
- Session: 04fef95005
- Branch: agent/TASK-033-add-config-validate-command--04fef95005
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-033
