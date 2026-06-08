---
id: TASK-241
type: Task
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: e1e159bfbd
claimed_at: '2026-06-08 22:17:58'
context_hash: c920478ff4788012
branch: agent/TASK-241-enforce-taskforgecommandresult-return-sc--e1e159bfbd
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-241
---

# TASK-241: Enforce TaskForgeCommandResult return schema as invariant across all CLI commands

## Goal

Every taskforge CLI command must return a structured TaskForgeCommandResult that prevents agentic drift. This is a mandatory control-plane invariant, not an optional feature.

## Invariant Enforcement

This is not a one-time migration. The Zod schema and validate-state audit check serve as ongoing enforcement:
- Every new command MUST conform to TaskForgeCommandResult or fail typecheck
- validate-state audits all commands at runtime and reports deviations
- Tests prove invariants hold after every change
- PR review rejects any command that omits required fields

## Problem

Commands currently return ad-hoc output. Agents infer workflow from unstructured text, leading to drift, bypass of TaskForge facades, and uncontrolled parallel work. The command return template (taskforge-command-return-template.md) defines the mandatory schema.

## Required Changes

### 1. Shared Result Schema (taskforge-command-result.ts)
- Define TaskForgeCommandResult TypeScript interface matching the spec exactly
- Define all sub-interfaces: CommandMetadata, CommandStatus, CommandContext, AgentPromptEnvelope, ValidNextCommand, TodoMergeInstruction, TodoMergeItem, ContextCleanupInstruction, ProhibitedAction, RecoveryInstruction, DiagnosticItem, AuditReference
- Zod runtime validation schema for the full result shape
- This becomes the single source of truth — all commands MUST conform

### 2. Result Builder Helpers
- success(), blocked(), failed(), noop(), humanRequired(), doctorRequired()
- Each builder pre-populates standard fields: agentPrompt.role, prohibitedActions (standard 5), validNextCommands (command-specific map)
- Enforce that normal-agent results never include --force in validNextCommands

### 3. Command-Specific Next-Command Maps
- Define validNextCommands for every CLI command per spec §8
- Maps keyed by command name + outcome state
- Include: command, purpose, when, allowedFor, priority

### 4. Markdown Renderer
- Render TaskForgeCommandResult to Markdown with exact section order per spec §4
- Sections 1-9 in order: Command Success Status, Current Context, Agentic Instruction, Valid Next Commands, Todo Merge Required, Context Cleanup, Prohibited Actions, Recovery Guidance, Audit and Trace

### 5. JSON Renderer
- Output TaskForgeCommandResult as JSON when --json flag is set
- JSON is authoritative; Markdown must render same semantics

### 6. Command Audit and Validation
- Add validate-state check that verifies every command returns the required schema
- Add test that proves every CLI command returns ok/status/validNextCommands/todoMerge/contextCleanup/prohibitedActions
- Add test that proves no normal-agent validNextCommands include --force
- Add test that proves task-switching commands require contextCleanup.required=true

### 7. Migration of Existing Commands
- Wire all existing commands to use the new result schema
- Preserve existing human-readable output while adding structured fields
- Commands: init, next, start, status, summary, gates, block, done, sync, list, unlock, sweep, heartbeat, inspect, claim, report, cleanup, new, prompt, resume, doctor, config-validate, release, reject, validate-state, audit, transcript, timeline, ac-check, diff, checkpoint, submit, pr, deps (all subcommands)

## Acceptance Criteria

- [x] TaskForgeCommandResult interface and Zod schema exist and match spec exactly — `src/core/command-result.ts`: TaskForgeCommandResultSchema with all sub-schemas (ValidNextCommand, TodoMergeInstruction, ContextCleanupInstruction, ProhibitedAction, RecoveryInstruction, DiagnosticItem, AuditReference, CommandMetadata, CommandStatus, CommandContext, AgentPromptEnvelope)
- [x] Result builder helpers exist (success, blocked, failed, noop, humanRequired, doctorRequired) — `src/core/result-builder.ts`: successResult(), blockedResult(), failedResult(), noopResult(), humanRequiredResult(), doctorRequiredResult(), contextCleanupResult()
- [x] Command-specific validNextCommands maps exist for all 35+ CLI commands — `src/core/next-command-maps.ts`: NEXT_COMMAND_MAPS with maps for init, next, start, claim, done, release, heartbeat, checkpoint, submit, pr, block, unlock, sweep, gates, status, summary, inspect, report, cleanup, new, resume, doctor, config-validate, reject, validate-state, audit, transcript, timeline, ac-check, diff, sync, list, prompt, agents, and all deps subcommands
- [x] Markdown renderer produces exact section order per spec §4 — `src/core/result-renderer.ts` `renderResultMarkdown()`: 9 sections in order (Status, Context, Agent Prompt, Next Commands, Todo Merge, Context Cleanup, Prohibited Actions, Recovery, Audit)
- [x] JSON renderer outputs authoritative TaskForgeCommandResult — `src/core/result-renderer.ts` `renderResultJson()`: JSON.stringify with null, 2
- [x] validate-state includes command-return-schema audit check — `src/core/state-validator.ts` `validateCommandReturnSchema()`: validates prohibited actions count, no --force in prohibited/next commands, next command maps exist for major commands, sample result validates against schema
- [ ] Test: every CLI command returns ok/status/validNextCommands/todoMerge/contextCleanup/prohibitedActions — Partially covered by builder tests; full command wiring needed
- [x] Test: no normal-agent validNextCommands include --force — `tests/validate-state-command-result.test.ts`: validates no --force in prohibited actions or next commands for normal agents
- [x] Test: task-switching commands require contextCleanup.required=true — `tests/command-result.test.ts`: contextCleanupResult test verifies required=true
- [ ] All existing commands wired to new result schema — Follow-up task needed (35+ commands)
- [x] Standard prohibited actions included in every result (5 standard prohibitions) — `src/core/command-result.ts` STANDARD_PROHIBITED_ACTIONS: git commit, git push, git worktree add, git branch -D, direct task-state file edits
- [x] Unknown error states generate recovery guidance with task-creation path — `src/core/result-builder.ts` failedResult() and humanRequiredResult() include recovery steps
- [x] Documentation of return contract in docs/architecture/ — `docs/architecture/command-return-contract.md`: Full documentation of schema, builders, renderers, invariants, and migration guide

## Agent Notes

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-241

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-241
- Session: e1e159bfbd
- Branch: agent/TASK-241-enforce-taskforgecommandresult-return-sc--e1e159bfbd

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-241

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-241
- Session: a43ce02a40
- Branch: agent/TASK-241-enforce-taskforgecommandresult-return-sc--a43ce02a40

### 2026-05-29T00:00:00Z System
- Report generated — task moved to Review
- Changed files: none
- Commits: none
- AC section: present
- AC has unchecked items

### 2026-05-29T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-241

### 2026-05-29T00:00:00Z System
- Task claimed via taskforge start TASK-241
- Session: 83283a1f28
- Branch: agent/TASK-241-enforce-taskforgecommandresult-return-sc--94d1b8bb55

### 2026-05-29T00:00:00Z System
- Task swept by Sweeper Protocol — reset to Ready. Claim by "6141b31587" was 11.7h old (threshold: 4h).

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-241

### 2026-05-28 System
- Task claimed via taskforge start TASK-241
- Session: 6141b31587
- Branch: agent/TASK-241-enforce-taskforgecommandresult-return-sc--94d1b8bb55

### 2026-05-28 System
- Task released by session "94d1b8bb55" — reset to Ready

### 2026-05-28 System
- Task claimed via taskforge start TASK-241
- Session: 6141b31587
- Branch: agent/TASK-241-enforce-taskforgecommandresult-return-sc--94d1b8bb55

### 2026-05-28 System
- Added validate-state command-return-schema audit check in state-validator.ts
- Added tests/validate-state-command-result.test.ts with 6 tests
- Added docs/architecture/command-return-contract.md documentation
- All 621 tests pass (6 new), typecheck/lint/build clean
- Remaining work: wire 35+ existing commands to new schema (follow-up task)

### 2026-05-28 System
- Core infrastructure complete: schema, builders, next-command maps, renderers
- 24 new tests in command-result.test.ts
- All 615 tests pass, typecheck/lint/build clean
- PR created: https://github.com/squoyster/task-forge/pull/17
- Remaining work (wiring 35+ commands, validate-state check, documentation) deferred to follow-up tasks
- Session: 94d1b8bb55
- Branch: agent/TASK-241-enforce-taskforgecommandresult-return-sc--94d1b8bb55
