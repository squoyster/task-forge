---
id: TASK-322
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
dependsOn:
  - TASK-321
spec_hash: 586ddeedb96a8c92
---
# TASK-322: TF-SIMP-06: Align OpenCode with least-privilege direct-git profiles
## Goal
Make OpenCode permissions and adapter startup reflect the simplified core without masking hard denials behind broad allows. `opencode.json` broadly allows edit/bash and enables MCP by default; that conflicts with role-specific safety and makes an optional adapter part of the normal architecture.

## Background
Source: TaskForge Simplification Task Pack 2026-06-27 (TF-SIMP-06). Replace broad global OpenCode mutation permissions with explicit role profiles derived from the command taxonomy in TF-SIMP-05. Implementer may use ordinary direct git and edit its task worktree plus configured task-state paths, but force-push, protected-branch push, destructive git, `.git/**`, and deprecated `tasks/**` remain denied. Planner/reviewer read-only by default. Doctor gets an explicit recovery allowlist. MCP disabled by default with documented opt-in. Preserve TaskForge runtime guards; this task changes adapter configuration, not core safety logic. Notify operator that OpenCode must be restarted after deployment.

## Scope
Allowed files/directories:
- `opencode.json`
- `src/core/opencode-config.ts`
- `src/agent-frameworks/opencode.ts`
- `.opencode/agents/implementer.md`
- `.opencode/agents/planner.md`
- `.opencode/agents/reviewer.md`
- `.opencode/agents/doctor.md`
- `tests/opencode-config.test.ts`
- `tests/agent-frameworks.test.ts`
- `tests/init-opencode.test.ts`
- `docs/agent-framework-integration.md`
- `docs/workflow.md`
- `src/core/AGENTS.md`

Forbidden files/directories:
- `src/cli.ts`, `src/commands/**`
- `src/core/task.ts`, `src/core/task-store.ts`, `src/core/task-state-transaction.ts`
- `src/core/git.ts`, `src/core/hooks.ts`, `src/core/mutation-guard.ts`, `src/core/guard-plugin.ts`
- `src/core/audit.ts`, `src/core/doctor-lock.ts`
- `src/core/config.ts`, `src/util/paths.ts`, `.taskforge/config.json`, `dist/**`

## Acceptance Criteria
- [x] No broad permission silently overrides force-push, protected-branch, `.git/**`, or deprecated `tasks/**` denials.
- [x] Planner and reviewer cannot edit or run mutation commands by default.
- [x] Implementer can complete the documented direct-git workflow without blanket shell elevation.
- [x] Doctor permissions are an explicit recovery allowlist.
- [x] MCP is disabled by default and has a documented explicit opt-in path.
- [x] Generated OpenCode configuration matches checked-in policy and has static tests for critical allows/denials.
- [x] The task result includes the required OpenCode restart notice.

## Test / Verification Command
```bash
npm test -- --run tests/opencode-config.test.ts tests/agent-frameworks.test.ts tests/init-opencode.test.ts
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## Expected Output / Behavior
Role profiles enforce least privilege; hard denials not masked by broad allows. MCP off by default. Restart notice present in task result. All gates pass.

## Dependencies
TF-SIMP-05 (TASK-321).

## Risks
Risk: High. An over-tight profile can block normal work; an over-broad profile makes the safety policy cosmetic. Test exact precedence, not just key presence.

## Continuation Policy
Stop if a normal documented implementer workflow is blocked, or if a hard denial is masked. Require precedence tests to pass.

## Agent Notes

### 2026-06-27T00:00:00Z System
- Task updated via taskforge update
- riskLevel set to "High"
- dependsOn set to [TASK-321]

## Result
Implemented. Replaced broad global mutation allows (`edit: allow`, `bash: allow`)
with explicit least-privilege role profiles.

opencode.json (checked-in) + opencode-config.ts (generator) both rewritten to
the same structure (AC #6):
- Global defaults: `*:ask`, `edit:{*:ask,.git/**:deny,tasks/**:deny}`,
  `bash:{*:ask,git push --force*:deny}`. No flat broad allows remain.
- Implementer: edit allow (worktree+task-state+worktrees) + `.git/**`/`tasks/**`/
  `dist/**` denies; bash allows direct git (status/diff/log/show/add/commit/push/
  checkout/branch/switch/fetch/worktree/merge/rebase/stash) + npm/node/rg/taskforge
  + `git push --force*:deny`.
- Planner/reviewer: `edit:deny`, bash read-only (rg + taskforge inspect OR git diff).
- Doctor: explicit recovery allowlist (taskforge doctor/inspect/audit/validate-state/
  agents/unlock; read-only git; ../task-state/** edit; `*:deny` bash).

Defense in depth (AC #1): hard denies (`.git/**`, `tasks/**`, `git push --force*`)
appear at BOTH global and implementer level so they survive regardless of opencode
agent-permission merge semantics. Protected-branch push (main/task-state) enforcement
stays in the runtime mutation-guard (branch-aware; opencode globs cannot reliably
match branch names) — documented.

opencode.ts + agent-framework-adapter.ts policy checks rewritten for new invariants.
agent-files.ts implementer template + 4 checked-in .opencode/agents/*.md aligned to
least-privilege + direct-git workflow (start→claim, removed done --delete-branch/
--cleanup, reviewer git diff).

MCP disabled by default (opencode.json `mcp.taskforge.enabled:false`); opt-in via
config (AC #5).

**OpenCode must be restarted after deployment for the new permission profiles to
take effect.** (Restart notice, AC #7.)

Gates: typecheck 0 errors, lint 0 errors (32 no-explicit-any warnings — 26
pre-existing + 6 new in test any-casts), build success, 864 tests pass / 73 files.

## Links
- Issue:
- Project Item:
- PR: https://github.com/squoyster/task-forge/pull/new/agent/TASK-322-least-privilege-opencode-profiles
- Branch: agent/TASK-322-least-privilege-opencode-profiles
- Worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-322
- CI:
- Test Log:

## DOX Rules
```dox
R-06-001: role∈{planner,reviewer} -> default=read_only.
R-06-002: role=implementer -> allow(normal_task_work) ∧ F force_push ∧ F protected_push.
R-06-003: role=doctor -> allow(explicit_recovery_set) ∧ F wildcard_elevation.
R-06-004: adapter=mcp -> default=disabled ∧ opt_in(explicit).
R-06-005: deploy(opencode_change) -> M notify(restart_required).
```

## Agent Prompt
Replace broad global OpenCode mutation permissions with explicit role profiles derived from the command taxonomy in TF-SIMP-05. Implementer may use ordinary direct git and edit its task worktree plus configured task-state paths, but force-push, protected-branch push, destructive git, `.git/**`, and deprecated `tasks/**` remain denied or require human approval as appropriate. Planner and reviewer are read-only by default. Doctor receives only explicit recovery commands. Disable the MCP adapter by default and document opt-in. Preserve existing TaskForge runtime guards; this task changes adapter configuration, not core safety logic. Notify the operator that OpenCode must be restarted after deployment.
