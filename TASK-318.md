---
id: TASK-318
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
completed_at: 2026-06-27T14:03:13Z
dependsOn:
  - TASK-317
spec_hash: 7b2256d79f9b52d6
---
# TASK-318: TF-SIMP-02: Collapse to one task status graph
## Goal
Make the canonical ten-status graph the only runtime workflow model while safely loading existing legacy task files. `TaskStatus`, `createStatusSchema`, transition validation, completion policy, commands, and docs currently disagree; three git/PR transport phases leaked into durable task state and duplicate `Review`/`Verify` semantics.

## Background
Source: TaskForge Simplification Task Pack 2026-06-27 (TF-SIMP-02). Canonical graph: `Inbox -> Needs Spec -> Ready -> In Progress -> Review -> Verify -> Done`, with `Blocked` reachable from `Ready`/`In Progress`, `Deferred -> Ready`, and `Rejected` terminal. Legacy normalization on read/write: `Implementation Complete -> Review`, `Submitted -> Review`, `Merge Ready -> Verify`. Git/PR transport facts must remain metadata (`submitted_sha`, `pr`, `pr_merged`), never re-encoded as a status.

## Scope
Allowed files/directories:
- `src/util/status-constants.ts`
- `src/core/task.ts`
- `src/core/status-transition.ts`
- `src/core/state-validator.ts`
- `src/core/completion-policy.ts`
- `src/core/command-states.ts`
- `src/commands/promote.ts`
- `src/commands/report.ts`
- `src/integrations/github/types.ts`
- `tests/task.test.ts`
- `tests/status-transition.test.ts`
- `tests/validate-state.test.ts`
- `tests/completion-policy.test.ts`
- `tests/command-states.test.ts`
- `tests/promote.test.ts`
- `tests/report.test.ts`
- `docs/workflow.md`
- `docs/architecture/command-state-machine-and-invariants.md`
- `src/core/AGENTS.md`
- `src/commands/AGENTS.md`
- `tests/AGENTS.md`

Forbidden files/directories:
- `src/core/task-store.ts`, `src/core/task-state-transaction.ts`
- `src/core/audit.ts`, `src/core/event-log.ts`, `src/core/doctor-lock.ts`
- `src/core/git.ts`, `src/core/hooks.ts`, `src/commands/hook.ts`
- `src/util/paths.ts`, `src/core/config.ts`, `.taskforge/config.json`
- `src/cli.ts`, `opencode.json`, `dist/**`

## Acceptance Criteria
- [x] `STATUS`, `TaskStatus`, `ALL_STATUSES`, `ACTIVE_STATUSES`, and `TERMINAL_STATUSES` describe one graph.
- [x] Legacy statuses parse using the exact mapping in this pack and serialize canonically on the next write.
- [x] `promote`, `report --complete`, validation, completion suggestions, and command guidance use only canonical statuses.
- [x] Git/PR facts remain metadata such as `submitted_sha`, `pr`, and `pr_merged`; no replacement transport status is added.
- [x] Tests cover every canonical transition, every forbidden transition, and all three legacy mappings.
- [x] The workflow and state-machine docs match executable behavior.

## Test / Verification Command
```bash
rg -n 'Implementation Complete|Submitted|Merge Ready|IMPLEMENTATION_COMPLETE|MERGE_READY|STATUS\.SUBMITTED' src tests docs/workflow.md docs/architecture/command-state-machine-and-invariants.md
npm test -- --run tests/task.test.ts tests/status-transition.test.ts tests/completion-policy.test.ts tests/promote.test.ts tests/report.test.ts tests/validate-state.test.ts
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## Expected Output / Behavior
Legacy status tokens absent from active/terminal sets, transition maps, guidance, GitHub label maps, and completion suggestions. `report --complete` enters `Review`. All gates pass.

## Dependencies
TF-SIMP-01 (TASK-317).

## Risks
Risk: High. Changes durable input normalization. The migration must be read-compatible and idempotent.

## Continuation Policy
Auto-continue unless gates fail or a forbidden file must be touched. Stop if a forbidden transition appears load-bearing.

## Agent Notes

### 2026-06-27T00:00:00Z System
- Task updated via taskforge update
- riskLevel set to "High"
- dependsOn set to [TASK-317]

## Result
Collapsed to a single canonical 10-status graph. Removed the three transport statuses (Implementation Complete, Submitted, Merge Ready) from every active/terminal set, transition map, completion suggestion, command guidance, and GitHub label/color map.

Legacy values normalize at the schema boundary via `normalizeStatus`/`createStatusSchema` preprocess: Implementation Complete & Submitted -> Review, Merge Ready -> Verify. Existing task files load and the next write persists a canonical value (idempotent, read-compatible).

`report --complete` now enters Review (was Implementation Complete). The main forward path is In Progress -> Review -> Verify -> Done; Review/Verify may step back (rework/verify-failure), block, or defer. Transport facts (submitted_sha, pr, pr_merged) remain metadata — no replacement transport status was added.

13 files changed (9 src + 1 doc + 3 tests + 1 transition-table doc), +150/-159. Gates: typecheck 0 errors, lint 0 errors, build success, 878 tests pass (added legacy-mapping + rejection tests; rewrote promote chain + completion/report expectations to the canonical model). Scope respected — no forbidden files touched.

## Links
- Issue:
- Project Item:
- PR: https://github.com/squoyster/task-forge/pull/new/agent/TASK-318-collapse-status-graph
- Branch: agent/TASK-318-collapse-status-graph
- Worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-318
- CI:
- Test Log:

## DOX Rules
```dox
R-02-001: parse | legacy_status -> normalize(canonical_status) ∧ F reject_existing_file.
R-02-002: write | task.status -> M canonical_status.
R-02-003: transition | from→to -> M allowed(canonical_graph).
R-02-004: transport_state | git_or_pr_fact -> store(metadata) ∧ F encode_as(status).
```

## Agent Prompt
Replace the active status model with the canonical graph in this pack. Normalize legacy values at the schema boundary using the specified mapping, so old files load and the next write persists a canonical value. Remove legacy constants from active/terminal sets, transition maps, command guidance, GitHub label maps, and completion suggestions. Change `report --complete` to enter `Review`; keep reporting optional and do not invent a replacement phase.
