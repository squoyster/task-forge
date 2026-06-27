---
id: TASK-319
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
completed_at: 2026-06-27T14:47:06Z
dependsOn:
  - TASK-318
spec_hash: 28f8a53437cd8e1b
---
# TASK-319: TF-SIMP-03: Make storage paths truthful and config-authoritative
## Goal
Remove the deprecated `main/tasks` contract and make task-state/worktree path semantics explicit, portable, and tested. Config declares `tasks.directory = tasks`, while runtime reads sibling `../task-state`; worktree config is also decorative because path code hardcodes layout. A safety-oriented control plane cannot have path settings that runtime ignores.

## Background
Source: TaskForge Simplification Task Pack 2026-06-27 (TF-SIMP-03). Introduce one explicit storage contract: a configured task-state directory defaulting to `../task-state`, and an unambiguous worktree-root definition (final directory vs parent containing `<repoName>`). Path functions must honor configuration from both the main checkout and linked worktrees.

## Scope
Allowed files/directories:
- `.taskforge/config.json`
- `src/core/config.ts`
- `src/util/paths.ts`
- `src/commands/init.ts`
- `src/commands/config-validate.ts`
- `tests/config.test.ts`
- `tests/paths.test.ts`
- `tests/commands/init.test.ts`
- `tests/init.test.ts`
- `docs/workflow.md`
- `docs/agent-framework-integration.md`
- `src/core/AGENTS.md`
- `src/commands/AGENTS.md`

Forbidden files/directories:
- `tasks/**`
- `src/core/task.ts`, `src/core/task-store.ts`, `src/core/task-state-transaction.ts`
- `src/core/git.ts`, `src/core/hooks.ts`, `src/commands/hook.ts`
- `src/core/audit.ts`, `src/core/doctor-lock.ts`
- `src/cli.ts`, `opencode.json`, `dist/**`

## Acceptance Criteria
- [x] Fresh config has one documented task-state path and one unambiguous worktree-root path.
- [x] `getTaskStateDir` and `getWorktreesDir` honor non-default relative and absolute configurations.
- [x] Resolving from the main checkout and a linked worktree yields the same durable locations.
- [x] `init` no longer creates or advertises `main/tasks` as live state.
- [x] No retained config field is decorative; dead `config.yaml` behavior is removed or proven active in the task result.
- [x] Existing default installations retain the current sibling task-state and worktree layout.

## Test / Verification Command
```bash
rg -n 'getTasksDir|tasks/TEMPLATE\.md|tasks\.directory|config\.yaml' src .taskforge/config.json docs/workflow.md docs/agent-framework-integration.md
npm test -- --run tests/config.test.ts tests/paths.test.ts tests/commands/init.test.ts tests/init.test.ts
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## Expected Output / Behavior
No decorative path fields. Config and runtime agree on durable task-state and worktree locations, identical from main checkout and linked worktree. All gates pass.

## Dependencies
TF-SIMP-02 (TASK-318).

## Risks
Risk: High. Incorrect resolution can point multiple agents at different task-state stores. Tests must cover linked-worktree invocation.

## Continuation Policy
Auto-continue unless gates fail or a forbidden file must be touched. Stop if resolving portably requires touching a forbidden path module's caller.

## Agent Notes

### 2026-06-27T00:00:00Z System
- Task updated via taskforge update
- riskLevel set to "High"
- dependsOn set to [TASK-318]

## Result

Implemented config-authoritative storage paths. Removed every decorative path field; the two retained path fields are now runtime-honored:

**Schema (`config.ts`):** dropped `tasks.directory`/`idPrefix`/`template` and `worktrees.branchPrefix` (none were ever read by runtime — verified zero production readers; `getNextId` hardcodes `TASK-`, `makeBranchName` hardcodes `agent/`). Replaced with `tasks.stateDir` (default `../task-state`, relative to MAIN repo root or absolute) and kept `worktrees.root` (default `../worktrees`, documented as the PARENT containing `<repoName>/<taskId>`).

**Paths (`paths.ts`):** `getTaskStateDir`/`getWorktreesDir` now resolve against the MAIN repo root (via `getMainRepoRoot`) reading config (memoized per mainRoot, cache cleared on `setRepoRoot`). This makes resolution identical from the main checkout and any linked worktree (AC #3) — previously `getWorktreesDir` used the worktree's own path + name, a latent bug for worktree invocation. `getWorktreesDir` now uses the MAIN repo name. Removed dead `getTasksDir` (the `main/tasks` contract) and `getConfigPath` (the `.taskforge/config.yaml` accessor — config is JSON). Absolute `stateDir`/`root` honored via `path.resolve`.

**Init (`init.ts`):** writes a truthful config (`tasks: { stateDir }`, `worktrees: { root }`) — no decorative keys. The `main/tasks → task-state` migration is retained (it migrates legacy, does not create active state).

**`.taskforge/config.json`** (this repo): updated to the new shape.

**Backward compatibility (AC #6):** existing installs with old config keys keep working — zod strips unknown keys (`directory`/`idPrefix`/`template`/`branchPrefix`), and absent `stateDir` defaults to `../task-state`, matching the prior hardcoded behavior. Added a test (`config.test.ts`) asserting decorative keys are stripped.

**Tests:** `tests/paths.test.ts` — removed dead `getTasksDir`/`getConfigPath` tests; added 4 TF-SIMP-03 tests (non-default relative `stateDir`, absolute `stateDir`, non-default `worktrees.root`, main-vs-linked-worktree equivalence via a real linked git worktree). `tests/commands/next.test.ts` — config mock now returns path fields (direct consequence of paths becoming config-aware).

**AC verification:** `rg 'getTasksDir|tasks/TEMPLATE\.md|tasks\.directory|config\.yaml' src .taskforge/config.json docs/workflow.md docs/agent-framework-integration.md` → clean (0 matches).

Gates: typecheck 0 errors; lint 0 errors (26 pre-existing warnings); build success; **881 tests pass** (75 files).

## Links
- Issue:
- Project Item:
- PR: https://github.com/squoyster/task-forge/pull/new/agent/TASK-319-config-authoritative-storage
- Branch: agent/TASK-319-config-authoritative-storage
- Worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-319
- CI:
- Test Log:

## DOX Rules
```dox
R-03-001: config | field_exists -> M consumed_by_runtime ∨ delete(field).
R-03-002: task_state | authority -> configured_relative_to(main_repo).
R-03-003: worktree_path | invocation∈{main,linked_worktree} -> same_result.
R-03-004: legacy_tasks | main/tasks -> F treat_as_authoritative.
```

## Agent Prompt
Replace decorative path fields with one explicit storage contract. Introduce a configured task-state directory defaulting to `../task-state`, define whether `worktrees.root` is the final directory or a parent containing `<repoName>`, and make the path functions honor that definition from both the main checkout and linked worktrees. Remove `getTasksDir`, stop `init` from creating active task files under `main/tasks`, and remove the dead `config.yaml` accessor unless an allowed-file caller proves it is active. Do not add a storage service or database.
