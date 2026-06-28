---
id: TASK-325
type: Task
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
dependsOn:
  - TASK-323
  - TASK-324
assignee: e8edbcdbf9
claimed_at: '2026-06-28 00:14:19'
context_hash: 73657e52ea2540f4
spec_hash: be194d8099d81fe9
branch: agent/TASK-325-tf-embed-03-add-fresh-project-embedding--e8edbcdbf9
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-325
---
# TASK-325: TF-EMBED-03: Add fresh-project embedding conformance and repair
## Goal
Prove that a newly initialized project gives an unfamiliar agent enough correct, compact context to use TaskForge and that `doctor` detects/repairs embedding drift. Generated files are currently tested individually, but the observed architecture drift occurred across their combined output. A black-box embedding contract catches stale skills, MCP tools, permissions, and guidance before release.

## Background
Source: TaskForge Simplification Task Pack 2026-06-27 (TF-EMBED-03). Add a temp-repository conformance suite for `--agent-framework none`, `generic`, and `opencode`. Initialize each project, then validate one shared vendor-neutral contract: canonical skills installed, no stale facade commands/statuses, optional MCP disabled by default, MCP config correct when enabled, compact AGENTS guidance points to `next --json`, doctor check passes. Tamper with each managed embedding artifact and prove `doctor --check` identifies exact drift while `doctor --fix` repairs only managed content. Add scenario fixtures feeding representative `next --json`/MCP results to the skill instructions and assert the selected action is permitted and current; no hosted model in the normal test suite.

## Scope
Allowed files/directories:
- `src/commands/init.ts`
- `src/commands/doctor.ts`
- `src/core/skill-files.ts`
- `src/core/agent-framework-adapter.ts`
- `src/agent-frameworks/types.ts`
- `src/agent-frameworks/generic.ts`
- `src/agent-frameworks/opencode.ts`
- `tests/embedding-conformance.test.ts` — create
- `tests/skill-files.test.ts`
- `tests/mcp-contract.test.ts`
- `tests/init.test.ts`
- `tests/init-opencode.test.ts`
- `tests/doctor.test.ts` — create if no doctor-level test exists after dependencies land
- `docs/agent-framework-integration.md`
- `docs/workflow.md`
- `src/core/AGENTS.md`
- `src/commands/AGENTS.md`
- `tests/AGENTS.md`

Forbidden files/directories:
- `src/cli.ts`
- `src/core/task.ts`, `src/core/task-store.ts`, `src/core/task-state-transaction.ts`
- `src/core/git.ts`, `src/core/hooks.ts`, `src/commands/hook.ts`
- `src/core/audit.ts`, `src/core/event-log.ts`, `src/core/doctor-lock.ts`
- `src/core/mutation-guard.ts`, `src/core/guard-plugin.ts`
- `opencode.json`, `.taskforge/config.json`, `dist/**`

## Acceptance Criteria
- [ ] None/generic/OpenCode initialization passes one shared embedding contract.
- [ ] The shared contract is agent-agnostic; adapter-specific assertions cover discovery/config only.
- [ ] Default initialization works without MCP; explicit MCP enablement produces a valid stdio configuration.
- [ ] Doctor reports missing, stale, malformed, and conflicting managed skills/MCP config with actionable repair guidance.
- [ ] Doctor repair is idempotent and preserves unmanaged skills, agent config, and project instructions.
- [ ] Offline scenarios cover Ready, In Progress, Review, Verify, Blocked, doctor-lock, ownership-conflict, gate-failure, and terminal tasks.
- [ ] No installed skill, agent instruction, MCP instruction, or scenario output mentions a removed facade command or noncanonical status.

## Test / Verification Command
```bash
npm test -- --run tests/embedding-conformance.test.ts tests/skill-files.test.ts tests/mcp-contract.test.ts tests/doctor.test.ts tests/init.test.ts tests/init-opencode.test.ts
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## Expected Output / Behavior
One shared embedding contract passes for none/generic/opencode. Doctor detects and idempotently repairs managed drift while preserving unmanaged content. No removed facade command or noncanonical status in any installed/scenario output. All gates pass.

## Dependencies
TF-EMBED-01 (TASK-323) and TF-EMBED-02 (TASK-324).

## Risks
Risk: Medium. Framework-specific expectations can accidentally become the product contract. Keep the shared assertions separate from thin adapter assertions.

## Continuation Policy
Stop if framework-specific expectations become the product contract. Require shared-contract separation.

## Agent Notes

### 2026-06-28T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-325

### 2026-06-28T00:00:00Z System
- Task claimed via taskforge start TASK-325
- Session: e8edbcdbf9
- Branch: agent/TASK-325-tf-embed-03-add-fresh-project-embedding--e8edbcdbf9

### 2026-06-27T00:00:00Z System
- Task updated via taskforge update
- riskLevel set to "Medium"
- dependsOn set to [TASK-323, TASK-324]

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
R-E03-001: conformance | framework -> same(core_embedding_contract).
R-E03-002: drift | managed_artifact_changed -> doctor_detects ∧ repair_idempotent.
R-E03-003: repair -> F overwrite(unmanaged_content).
R-E03-004: scenario_eval -> deterministic ∧ offline ∧ cover(normal∨blocked∨doctor∨review∨verify).
```

## Agent Prompt
Add a temp-repository conformance suite for `--agent-framework none`, `generic`, and `opencode`. Initialize each project, then validate the same vendor-neutral contract: canonical skills installed, no stale facade commands/statuses, optional MCP disabled by default, MCP configuration correct when enabled, compact AGENTS guidance points to `next --json`, and doctor check passes. Tamper with each managed embedding artifact and prove `doctor --check` identifies the exact drift while `doctor --fix` repairs only managed content. Add scenario fixtures that feed representative `next --json`/MCP results to the skill instructions and assert the selected action is permitted and current; do not require a hosted model in the normal test suite.
