---
id: TASK-324
type: Task
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: b0957fcff167c838
---

# TASK-324: TF-EMBED-02: Replace the MCP command mirror with a typed task/state contract
## Goal
Provide an optional MCP server that exposes TaskForge's stable task/state kernel through structured tools and resources without exposing repository mutation. The current MCP captures CLI stdout and mirrors `status`, `start`, and `done`, including worktree cleanup. This is brittle, untyped at the result boundary, and tied to the old lifecycle. A small MCP contract materially improves interoperability for agents that support MCP.

## Background
Source: TaskForge Simplification Task Pack 2026-06-27 (TF-EMBED-02). Replace stdout-capturing MCP wrappers with a typed contract returning `structuredContent` matching existing `CommandResult`/JSON schemas. Expose only: `taskforge_next`, `taskforge_get_task`, `taskforge_claim`, `taskforge_block`, `taskforge_complete`, `taskforge_gates`, `taskforge_validate_state`. Add read-only resources for the compact workflow contract and `taskforge://task/{taskId}`. Mutating tools must invoke the same authority/transaction/doctor-lock/validation/audit paths as CLI; do not duplicate mutation logic. Do not expose shell, git, worktree, branch, push, PR, force, unlock, or generic status-transition tools. Keep the server opt-in.

## Scope
Allowed files/directories:
- `src/commands/mcp.ts`
- `src/core/mcp-contract.ts` — create
- `src/core/command-result.ts`
- `src/commands/next.ts`
- `src/commands/inspect.ts`
- `src/commands/claim.ts`
- `src/commands/block.ts`
- `src/commands/done.ts`
- `src/commands/gates.ts`
- `src/commands/validate-state.ts`
- `tests/mcp.test.ts`
- `tests/mcp-contract.test.ts` — create
- `docs/agent-framework-integration.md`
- `docs/architecture/command-return-contract.md`
- `src/core/AGENTS.md`
- `src/commands/AGENTS.md`
- `tests/AGENTS.md`

Forbidden files/directories:
- `src/core/git.ts`, `src/core/hooks.ts`, `src/commands/hook.ts`
- `src/core/task.ts`, `src/core/task-store.ts`, `src/core/task-state-transaction.ts`
- `src/core/audit.ts`, `src/core/event-log.ts`, `src/core/doctor-lock.ts`
- `src/core/mutation-guard.ts`, `src/core/guard-plugin.ts`
- `src/core/config.ts`, `src/util/paths.ts`
- `src/agent-frameworks/**`, `opencode.json`, `.taskforge/config.json`, `dist/**`

## Acceptance Criteria
- [ ] The server advertises exactly seven tools and no git/worktree/shell proxy.
- [ ] Tool results include typed structured content; human-readable text is optional and derived from the same result.
- [ ] `taskforge_claim`, `taskforge_block`, and `taskforge_complete` preserve CLI authority, transaction, doctor-lock, audit, and validation behavior.
- [ ] MCP task resources never expose unrelated task files or paths outside the configured project/task-state roots.
- [ ] Server instructions put task/state-only scope and safety invariants in the first 512 characters.
- [ ] Protocol-level tests use an MCP client transport and cover success, invalid input, doctor lock, ownership conflict, gate failure, and task-not-found.
- [ ] MCP remains disabled unless explicitly enabled by the embedding adapter/configuration.

## Test / Verification Command
```bash
npm test -- --run tests/mcp.test.ts tests/mcp-contract.test.ts
rg -n 'taskforge_(start|resume|cleanup|push|commit|worktree|shell|transition)' src/commands/mcp.ts src/core/mcp-contract.ts
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## Expected Output / Behavior
Exactly seven typed task/state tools, no repo mutation proxy. Mutating tools share CLI invariants. MCP off unless explicitly enabled. All gates pass.

## Dependencies
TF-SIMP-06 (TASK-322). Independent of TF-EMBED-01.

## Risks
Risk: High. A second mutation implementation would split invariants. MCP handlers must remain adapters over the same core operations used by CLI commands.

## Continuation Policy
Stop if a second mutation implementation appears. Require mutating-tool invariant parity tests.

## Agent Notes

## Result

## Links
- Issue:
- Project Item:
- PR:
- Branch:
- Worktree:
- CI:
- Test Log:

## DOX Rules
```dox
R-E02-001: mcp_result -> M structured(schema=CommandResult) ∧ F parse(ANSI_stdout).
R-E02-002: mcp_mutation -> M reuse(cli_core_path) ∧ M same_invariants.
R-E02-003: mcp_tool -> F repo_mutation ∧ F generic_shell ∧ F generic_transition.
R-E02-004: resource -> read_only ∧ compact ∧ current.
```

## Agent Prompt
Replace stdout-capturing MCP wrappers with a typed contract that returns `structuredContent` matching the existing `CommandResult`/JSON schemas. Expose only: `taskforge_next`, `taskforge_get_task`, `taskforge_claim`, `taskforge_block`, `taskforge_complete`, `taskforge_gates`, and `taskforge_validate_state`. Add read-only resources for the compact workflow contract and `taskforge://task/{taskId}`. Mutating tools must invoke the same authority, transaction, doctor-lock, validation, and audit paths as their CLI equivalents; do not duplicate mutation logic. Do not expose shell, git, worktree, branch, push, PR, force, unlock, or generic status-transition tools. Keep the server opt-in.
