---
id: TASK-244
type: Task
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 5aa5bf71aa
claimed_at: '2026-05-29 03:19:17'
context_hash: 021bc40dc10bc3c5
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
