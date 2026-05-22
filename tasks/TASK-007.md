---
id: TASK-007
type: Task
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-007: Add --force flag to init command for re-initialization

## Goal

Add a `--force` flag to `taskforge init` that recreates missing configuration files and templates in an existing repository without overwriting user content.

## Background

`taskforge init` currently skips existing files. If a user deletes TASKFORGE.md, config.json, or templates, there's no built-in way to restore them. A `--force` flag recreates only what's missing.

## Scope

Allowed files/directories:
- src/commands/init.ts
- tests/

Disallowed files/directories:
- .git/**
- package.json

## Acceptance Criteria

- [ ] `taskforge init` (no flag) preserves existing files (current behavior)
- [ ] `taskforge init --force` recreates TASKFORGE.md if deleted
- [ ] `taskforge init --force` recreates config.json if deleted (preserves existing config if present)
- [ ] `taskforge init --force` recreates task templates (README.md, TEMPLATE.md) if deleted
- [ ] `taskforge init --force` recreates missing directories
- [ ] Existing task files are never overwritten, even with --force
- [ ] Unit tests cover force mode with various missing file combinations

## Test / Verification Command

```bash
npm run build && npm test -- --run
```

## Expected Output / Behavior

- Each (re)created file gets a log line: "Created TASKFORGE.md"
- Existing files are logged as "Already exists" (same as current behavior)
- Directories are created if missing, skipped silently if present
- Config preserves existing values and only adds missing keys

## Dependencies

None

## Risk Level

Low

## Continuation Policy

Auto-continue unless a stopping condition occurs.
