---
id: TASK-317
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
completed_at: 2026-06-27T13:16:41Z
spec_hash: 19c678fbfe63023c
---
# TASK-317: TF-SIMP-01: Remove stale facade guidance and dead facade artifacts
## Goal
Every production next action names an available TaskForge command or a native git/`gh` command; no dead git-facade implementation remains. The CLI no longer registers `checkpoint`, `submit`, `diff`, or `pr`, but production guidance, generated agent files, architecture docs, and (if present) an orphaned command module still reference them. This is the highest-risk agent UX defect because recovery output instructs agents to run nonexistent commands.

## Background
Source: TaskForge Simplification Task Pack 2026-06-27 (TF-SIMP-01). The git-facade module was removed by TASK-312, but stale guidance persists across state machines and generators. Direct-git model is authoritative (AGENTS.md R060-R064, docs/workflow.md): agents use raw git; facade compatibility wrappers must not be re-added.

## Scope
Allowed files/directories:
- `src/commands/git-facade.ts` — delete (if still present)
- `src/commands/next.ts`
- `src/commands/resume.ts`
- `src/core/agent-files.ts`
- `src/core/agents-md.ts`
- `src/core/command-result.ts`
- `src/core/command-states.ts`
- `src/core/completion-policy.ts`
- `src/core/guard-plugin.ts`
- `src/core/mutation-guard.ts`
- `src/core/next-command-maps.ts`
- `tests/git-facade.test.ts` — delete if still present
- `tests/command-result.test.ts`
- `tests/command-states.test.ts`
- `tests/commands/next.test.ts`
- `tests/next-command-maps.test.ts` — create only if no existing test covers the map
- `tests/agent-files.test.ts`
- `tests/agents-md.test.ts`
- `docs/architecture/command-return-contract.md`
- `docs/architecture/command-state-machine-and-invariants.md`
- `docs/next-action-semantics.md`
- `docs/deployment/container-runtime.md`
- `src/core/AGENTS.md`
- `src/commands/AGENTS.md`
- `specs/AGENTS.md`

Forbidden files/directories:
- `src/core/audit.ts`, `src/core/audit-schema.ts`, `src/core/cli-audit.ts`
- `src/core/doctor-lock.ts`, `src/core/hooks.ts`, `src/commands/hook.ts`
- `src/core/task-state-transaction.ts`, `src/core/task.ts`, `src/core/task-store.ts`
- `src/util/status-constants.ts`, `src/util/paths.ts`, `src/core/config.ts`
- `.taskforge/config.json`, `opencode.json`, `src/cli.ts`, `dist/**`

## Acceptance Criteria
- [x] `src/commands/git-facade.ts` and its dedicated test are absent.
- [x] No production code or active workflow/architecture guidance emits the four removed facade commands (`taskforge checkpoint|submit|diff|pr`).
- [x] Every structured `nextActions[].command` is registered by `src/cli.ts`, native git/`gh`, or explicitly doctor/human-only.
- [x] `specs/AGENTS.md`, `src/core/AGENTS.md`, and `src/commands/AGENTS.md` no longer claim the git facade is authoritative.
- [x] Tests cover success and recovery guidance, including `next`, `gates`, `done`, and unknown/error states.
- [x] Safety behavior (mutation guards, audit) is unchanged.
- [x] A contract assertion scans emitted guidance and structured next actions for removed commands.

## Test / Verification Command
```bash
rg -n 'taskforge (checkpoint|submit|diff|pr)' src docs/architecture/command-return-contract.md docs/architecture/command-state-machine-and-invariants.md docs/next-action-semantics.md docs/deployment/container-runtime.md specs/AGENTS.md
npm test -- --run tests/command-states.test.ts tests/command-result.test.ts tests/commands/next.test.ts tests/agent-files.test.ts tests/agents-md.test.ts
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## Expected Output / Behavior
The `rg` for removed facade commands returns no production/active hits. All gate steps pass with zero errors. Mutation/audit behavior unchanged.

## Dependencies
TASK-312 through TASK-315 integrated (final combined tip used as base).

## Risks
Risk: High. Guidance is distributed across state machines and generators. The main failure mode is replacing strings while leaving structured next actions stale.

## Continuation Policy
Auto-continue unless gates fail or a forbidden file must be touched. Stop and report if any change to mutation/audit behavior is required.

## Agent Notes

### 2026-06-27T00:00:00Z System
- Task updated via taskforge update
- riskLevel set to "High"

## Result
Implemented. Removed every `taskforge checkpoint|submit|diff|pr` reference (git facade deleted in TASK-312) and replaced with the direct-git model (AGENTS.md R060-R064, docs/workflow.md): checkpoint→`git add -A && git commit --message "..."`, submit→`git push -u origin <branch>`, diff→`git diff`, pr→`gh pr create`.

Changed 23 files + 1 new test (+190/-102): mechanical string replacement across src/core/command-states.ts, next-command-maps.ts, completion-policy.ts, src/commands/next.ts, src/commands/resume.ts, and 4 docs; semantic edits to mutation-guard.ts + guard-plugin.ts (REPLACEMENTS drop commit/push entries; denial behavior unchanged — still hardcoded), command-result.ts (reasons → "Forbidden in managed agent sessions"), agent-files.ts + agents-md.ts (direct-git workflow), specs/AGENTS.md (rewrote Forbidden Workflow Git → Direct-Git Routine). Deleted stale `git-facade.ts`/`Git Facade` table rows from src/core/AGENTS.md and src/commands/AGENTS.md (start/resume/cleanup-cmd rows left — TF-SIMP-04 scope).

Added tests/no-stale-facade-guidance.test.ts: runtime scan of COMMAND_STATE_REGISTRY, STANDARD_PROHIBITED_ACTIONS, and getReplacement(DENIED_GIT_COMMANDS) + static scan of 15 guidance-emitting files. Updated 6 existing test files whose assertions referenced the old facade strings.

Gates (run in worktree, R090): typecheck 0 errors; lint 0 errors (26 pre-existing `no-explicit-any` warnings, none in edited files); build ok; `npm test -- --run` 877 passed / 75 files. AC verification rg (word-boundary) on src + 4 docs + specs/AGENTS.md: CLEAN.

## Links
- Issue:
- Project Item:
- PR: https://github.com/squoyster/task-forge/pull/new/agent/TASK-317-remove-stale-facade-guidance
- Branch: agent/TASK-317-remove-stale-facade-guidance
- Worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-317
- CI:
- Test Log:

## DOX Rules
```dox
R-01-001: guidance | command∈{checkpoint,submit,diff,pr} -> F emit(`taskforge ${command}`).
R-01-002: replacement | save -> use(`git add -A`∧`git commit`).
R-01-003: replacement | publish -> use(`git push -u origin <branch>`∧human_or_gh_pr).
R-01-004: guard_text_change -> F weaken(mutation_guard_behavior).
```

## Agent Prompt
Remove the orphaned git-facade module and replace every production or generated recommendation of `taskforge checkpoint`, `taskforge submit`, `taskforge diff`, and `taskforge pr` with direct git/`gh` guidance consistent with `docs/workflow.md`. Do not add compatibility aliases. Preserve the structure of `CommandResult` and all mutation/audit behavior. Add a contract assertion that scans emitted guidance and structured next actions for removed commands.
