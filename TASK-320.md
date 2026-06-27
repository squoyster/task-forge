---
id: TASK-320
type: Task
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 7bc19f155944204b
---

# TASK-320: TF-SIMP-04: Remove TaskForge-owned git and worktree lifecycle mutation
## Goal
Make the direct-git boundary executable: TaskForge claims and transitions tasks; it does not create/delete worktrees, branches, commits, pushes, or PRs. Root policy prefers direct git, but `start`, `resume`, `cleanup`, `done --cleanup`, MCP tools, and even `claim` still perform or orchestrate worktree/branch operations. Keeping two authorities preserves the architecture split.

## Background
Source: TaskForge Simplification Task Pack 2026-06-27 (TF-SIMP-04). TaskForge owns durable task state, atomic claims/transitions, next-action planning, validation, gates, recovery, audit. Git owns branches, worktrees, commits, pushes, diffs, PR transport. `claim` becomes atomic state-only; `done` loses cleanup/delete-branch flags but retains gates, AC, ownership, publication checks, final task-state transition, audit. Direct-git worktree/branch commands emitted as guidance using configured paths (TF-SIMP-03). Do not weaken hooks or mutation guards.

## Scope
Allowed files/directories:
- `src/cli.ts`
- `src/commands/start.ts` — delete
- `src/commands/resume.ts` — delete
- `src/commands/cleanup-cmd.ts` — delete
- `src/commands/claim.ts`
- `src/commands/done.ts`
- `src/commands/next.ts`
- `src/commands/mcp.ts`
- `src/core/git.ts`
- `src/core/command-states.ts`
- `src/core/next-command-maps.ts`
- `tests/commands/start.test.ts` — delete
- `tests/resume.test.ts` — delete
- `tests/cleanup.test.ts` — delete
- `tests/claim.test.ts`
- `tests/done.test.ts`
- `tests/commands/done.test.ts`
- `tests/commands/next.test.ts`
- `tests/command-states.test.ts`
- `tests/mcp.test.ts`
- `docs/workflow.md`
- `docs/architecture/command-state-machine-and-invariants.md`
- `src/core/AGENTS.md`
- `src/commands/AGENTS.md`
- `tests/AGENTS.md`

Forbidden files/directories:
- `src/core/task-state-transaction.ts`, `src/core/audit.ts`, `src/core/event-log.ts`
- `src/core/doctor-lock.ts`, `src/core/hooks.ts`, `src/commands/hook.ts`
- `src/core/mutation-guard.ts`, `src/core/guard-plugin.ts`
- `src/core/task.ts`, `src/util/status-constants.ts`, `src/core/config.ts`, `src/util/paths.ts`
- `.taskforge/config.json`, `opencode.json`, `dist/**`

## Acceptance Criteria
- [ ] `taskforge start`, `resume`, and `cleanup` are not registered and have no MCP equivalents.
- [ ] `claim` atomically records ownership/status and returns a direct-git setup command without creating a worktree.
- [ ] `done` does not remove worktrees or branches and has no cleanup/delete flags.
- [ ] No TaskForge production path creates/removes worktrees or branches after dead helper removal.
- [ ] Doctor lock, ownership, task-state conflict detection, gates, AC checks, publication checks, and audit events remain enforced.
- [ ] Tests prove a claim failure cannot leave partial task state and no mocked worktree command is invoked.

## Test / Verification Command
```bash
node --import tsx src/cli.ts --help
rg -n 'cmdStart|cmdResume|cmdCleanup|createWorktree|removeWorktree|removeBranch|--cleanup|--delete-branch' src tests
npm test -- --run tests/claim.test.ts tests/done.test.ts tests/commands/done.test.ts tests/commands/next.test.ts tests/mcp.test.ts
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## Expected Output / Behavior
`--help` shows no start/resume/cleanup. No production path invokes worktree/branch creation. Claim atomicity, gates, AC, publication, audit all enforced. All gates pass.

## Dependencies
TF-SIMP-03 (TASK-319).

## Risks
Risk: Critical. Claim and done are distributed mutation boundaries. Removal of git orchestration must not weaken atomic ownership or completion checks.

## Continuation Policy
Stop at the first sign of weakened atomic ownership or completion checks. Require human review of the claim/done diff before merge.

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
R-04-001: claim -> M atomic_task_state_mutation ∧ F mutate(git_worktree∨branch).
R-04-002: done -> M verify_then_transition ∧ F delete(worktree∨branch).
R-04-003: repo_mutation | kind∈{worktree,branch,commit,push,pr} -> owner=git_or_gh.
R-04-004: safety -> M preserve(ownership∧gates∧AC∧publication_checks∧audit).
```

## Agent Prompt
Remove public `start`, `resume`, and `cleanup` commands and corresponding MCP tools. Make `claim` perform only atomic task ownership/state mutation; it must not create a worktree. Remove cleanup/delete-branch options from `done`; `done` retains gates, AC, ownership, branch publication/merge checks, final task-state transition, and audit behavior. Delete git helpers only when no allowed-file caller remains. Emit exact direct-git worktree/branch commands as guidance, using configured paths from TF-SIMP-03. Do not weaken hooks or mutation guards.
