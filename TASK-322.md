---
id: TASK-322
type: Task
status: Ready
priority: P2
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
dependsOn:
  - TASK-321
spec_hash: dc8395610827817b
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
- [ ] No broad permission silently overrides force-push, protected-branch, `.git/**`, or deprecated `tasks/**` denials.
- [ ] Planner and reviewer cannot edit or run mutation commands by default.
- [ ] Implementer can complete the documented direct-git workflow without blanket shell elevation.
- [ ] Doctor permissions are an explicit recovery allowlist.
- [ ] MCP is disabled by default and has a documented explicit opt-in path.
- [ ] Generated OpenCode configuration matches checked-in policy and has static tests for critical allows/denials.
- [ ] The task result includes the required OpenCode restart notice.

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
R-06-001: role∈{planner,reviewer} -> default=read_only.
R-06-002: role=implementer -> allow(normal_task_work) ∧ F force_push ∧ F protected_push.
R-06-003: role=doctor -> allow(explicit_recovery_set) ∧ F wildcard_elevation.
R-06-004: adapter=mcp -> default=disabled ∧ opt_in(explicit).
R-06-005: deploy(opencode_change) -> M notify(restart_required).
```

## Agent Prompt
Replace broad global OpenCode mutation permissions with explicit role profiles derived from the command taxonomy in TF-SIMP-05. Implementer may use ordinary direct git and edit its task worktree plus configured task-state paths, but force-push, protected-branch push, destructive git, `.git/**`, and deprecated `tasks/**` remain denied or require human approval as appropriate. Planner and reviewer are read-only by default. Doctor receives only explicit recovery commands. Disable the MCP adapter by default and document opt-in. Preserve existing TaskForge runtime guards; this task changes adapter configuration, not core safety logic. Notify the operator that OpenCode must be restarted after deployment.
