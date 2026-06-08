---
id: TASK-244
type: Task
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 87da9585c90be1d7
branch: agent/TASK-244-wire-all-35-cli-commands-to-taskforgecom--a34e9e4c25
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-244
---

# TASK-244: Wire all 35+ CLI commands to TaskForgeCommandResult schema (TASK-241 follow-up)

## Goal

## Goal

Wire all existing taskforge CLI commands to use the TaskForgeCommandResult schema defined in TASK-241.

## Context

TASK-241 created the core infrastructure:
- TaskForgeCommandResult interface and Zod schema
- Result builder helpers (success, blocked, failed, noop, humanRequired, doctorRequired)
- Command-specific validNextCommands maps for 35+ commands
- Markdown and JSON renderers
- validate-state audit check

What remains is migrating each command to use the builders and renderers.

## Commands to Wire

All commands in src/commands/:
- init, next, start, status, summary, gates, block, done, sync, list
- unlock, sweep, heartbeat, inspect, claim, report, cleanup, new
- prompt, resume, doctor, config-validate, release, reject
- validate-state, audit, transcript, timeline, ac-check
- diff, checkpoint, submit, pr
- agents
- deps (scan, audit, outdated, deprecated, plan, create-tasks, pr, summary)

## Migration Pattern

1. Import builders: `import { successResult, failedResult } from "../core/result-builder.js";`
2. Import next commands: `import { getValidNextCommands } from "../core/next-command-maps.js";`
3. Import renderers: `import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";`
4. Replace ad-hoc output with builder result
5. Add --json flag handling with renderResultJson()
6. Add Markdown output with renderResultMarkdown()

## Acceptance Criteria

- [ ] All 35+ commands use result builders instead of ad-hoc output
- [ ] All commands support --json flag with authoritative JSON output
- [ ] All commands produce Markdown output via renderResultMarkdown()
- [ ] Test: every CLI command returns ok/status/validNextCommands/todoMerge/contextCleanup/prohibitedActions
- [ ] Test: no normal-agent validNextCommands include --force
- [ ] All verification gates pass

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-08T00:00:00Z System
- Task swept by Sweeper Protocol — reset to Ready. Claim by "cfbcd1d849" was 90.9h old (threshold: 4h).

### 2026-06-04T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-244

### 2026-06-04T00:00:00Z System
- Task claimed via taskforge start TASK-244
- Session: cfbcd1d849
- Branch: agent/TASK-244-wire-all-35-cli-commands-to-taskforgecom--a34e9e4c25

### 2026-06-04T00:00:00Z System
- Task swept by Sweeper Protocol — reset to Ready. Claim by "5aa5bf71aa" was 145.9h old (threshold: 4h).

### 2026-05-29T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-244

### 2026-05-29T00:00:00Z System
- Task claimed via taskforge start TASK-244
- Session: 5aa5bf71aa
- Branch: agent/TASK-244-wire-all-35-cli-commands-to-taskforgecom--a34e9e4c25

### 2026-05-28 System
- Task released by session "a34e9e4c25" — reset to Ready

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-244

### 2026-05-28 System
- Task claimed via taskforge start TASK-244
- Session: a34e9e4c25
- Branch: agent/TASK-244-wire-all-35-cli-commands-to-taskforgecom--a34e9e4c25

### 2026-05-29 implementer
- Migrated 9 of 28 commands to result-builder system: status, gates, init, summary, block, next, list, inspect, validate-state
- All 552 tests passing
- Fixed issues with JSON output format and markdown logging in conditional blocks
- Gates command now returns successResult even when gates fail (ok: true, allPassed: false)
- Summary and status commands merge data at top level (not nested) for JSON output
- List command maintains backward compatibility with flat array JSON format

### 2026-05-29 implementer (continue)
- Migrated 11 of 28 commands: +doctor, +unlock (total: status, gates, init, summary, block, next, list, inspect, validate-state, doctor, unlock)
- Doctor maintains exact JSON format with ok, issues, repairs, checks, counts fields
- Unlock maintains JSON for all paths: not found, not claimed, needs force, force requires human, success
- All 552 tests passing after each migration
- Pushed 2 commits to branch: agent/TASK-244-wire-all-35-cli-commands-to-taskforgecom--a34e9e4c25
- Remaining: 17 of 28 commands in src/commands/ + 11 in src/commands/deps/
