---
id: TASK-319
type: Task
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 1886e19e9e13c923
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
- [ ] Fresh config has one documented task-state path and one unambiguous worktree-root path.
- [ ] `getTaskStateDir` and `getWorktreesDir` honor non-default relative and absolute configurations.
- [ ] Resolving from the main checkout and a linked worktree yields the same durable locations.
- [ ] `init` no longer creates or advertises `main/tasks` as live state.
- [ ] No retained config field is decorative; dead `config.yaml` behavior is removed or proven active in the task result.
- [ ] Existing default installations retain the current sibling task-state and worktree layout.

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
R-03-001: config | field_exists -> M consumed_by_runtime ∨ delete(field).
R-03-002: task_state | authority -> configured_relative_to(main_repo).
R-03-003: worktree_path | invocation∈{main,linked_worktree} -> same_result.
R-03-004: legacy_tasks | main/tasks -> F treat_as_authoritative.
```

## Agent Prompt
Replace decorative path fields with one explicit storage contract. Introduce a configured task-state directory defaulting to `../task-state`, define whether `worktrees.root` is the final directory or a parent containing `<repoName>`, and make the path functions honor that definition from both the main checkout and linked worktrees. Remove `getTasksDir`, stop `init` from creating active task files under `main/tasks`, and remove the dead `config.yaml` accessor unless an allowed-file caller proves it is active. Do not add a storage service or database.
