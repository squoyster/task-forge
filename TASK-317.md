---
id: TASK-317
type: Task
status: Ready
priority: P2
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
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
- [ ] `src/commands/git-facade.ts` and its dedicated test are absent.
- [ ] No production code or active workflow/architecture guidance emits the four removed facade commands (`taskforge checkpoint|submit|diff|pr`).
- [ ] Every structured `nextActions[].command` is registered by `src/cli.ts`, native git/`gh`, or explicitly doctor/human-only.
- [ ] `specs/AGENTS.md`, `src/core/AGENTS.md`, and `src/commands/AGENTS.md` no longer claim the git facade is authoritative.
- [ ] Tests cover success and recovery guidance, including `next`, `gates`, `done`, and unknown/error states.
- [ ] Safety behavior (mutation guards, audit) is unchanged.
- [ ] A contract assertion scans emitted guidance and structured next actions for removed commands.

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
R-01-001: guidance | command∈{checkpoint,submit,diff,pr} -> F emit(`taskforge ${command}`).
R-01-002: replacement | save -> use(`git add -A`∧`git commit`).
R-01-003: replacement | publish -> use(`git push -u origin <branch>`∧human_or_gh_pr).
R-01-004: guard_text_change -> F weaken(mutation_guard_behavior).
```

## Agent Prompt
Remove the orphaned git-facade module and replace every production or generated recommendation of `taskforge checkpoint`, `taskforge submit`, `taskforge diff`, and `taskforge pr` with direct git/`gh` guidance consistent with `docs/workflow.md`. Do not add compatibility aliases. Preserve the structure of `CommandResult` and all mutation/audit behavior. Add a contract assertion that scans emitted guidance and structured next actions for removed commands.
