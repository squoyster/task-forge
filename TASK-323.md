---
id: TASK-323
type: Task
status: Done
priority: P2
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
completed_at: 2026-06-27T23:25:22Z
dependsOn:
  - TASK-322
spec_hash: 1a6d2ff0ebe12dc5
---
# TASK-323: TF-EMBED-01: Install portable TaskForge Agent Skills
## Goal
Embed two focused, open-format skills in initialized projects so any compatible agent can operate TaskForge faithfully without loading broad repository documentation. Generated role prompts are currently OpenCode-specific, verbose, and stale. A portable skill gives agents a triggerable workflow while keeping TaskForge's JSON output authoritative. Separating normal work from doctor recovery prevents routine agents from receiving elevated recovery guidance.

## Background
Source: TaskForge Simplification Task Pack 2026-06-27 (TF-EMBED-01). Add a canonical project skill source that `taskforge init` installs under `.agents/skills/`. Exactly two skills: `taskforge-work-task` (select/claim/execute/verify/complete) and `taskforge-recover-state` (doctor-lock/invalid-state/ownership-conflict/stale-agent recovery). Each `SKILL.md` has only `name` and a trigger-complete `description` in frontmatter, then concise imperative instructions. Both call `taskforge next --json` or current diagnostic JSON and follow returned actions; neither duplicates the status graph, command map, or framework permissions. Framework adapters may add discovery links/config but must reference the same canonical skill files. No scripts, copied architecture references, or auxiliary READMEs unless an acceptance test proves required.

## Scope
Allowed files/directories:
- `src/core/skill-files.ts` — create
- `src/core/templates.ts`
- `src/commands/init.ts`
- `src/agent-frameworks/types.ts`
- `src/agent-frameworks/generic.ts`
- `src/agent-frameworks/opencode.ts`
- `src/agent-frameworks/registry.ts`
- `tests/skill-files.test.ts` — create
- `tests/agent-frameworks.test.ts`
- `tests/init.test.ts`
- `tests/init-opencode.test.ts`
- `docs/agent-framework-integration.md`
- `src/core/AGENTS.md`

Forbidden files/directories:
- `.opencode/agents/**`
- `src/core/agent-files.ts`
- `src/cli.ts`, `src/commands/mcp.ts`
- `src/core/task.ts`, `src/core/task-store.ts`, `src/core/task-state-transaction.ts`
- `src/core/git.ts`, `src/core/hooks.ts`, `src/core/mutation-guard.ts`
- `src/core/audit.ts`, `src/core/doctor-lock.ts`
- `opencode.json`, `.taskforge/config.json`, `dist/**`

## Acceptance Criteria
- [x] Fresh generic and OpenCode initialization produce identical canonical `.agents/skills/taskforge-work-task/SKILL.md` and `.agents/skills/taskforge-recover-state/SKILL.md` files.
- [x] Each skill has valid `name`/`description` frontmatter, clear positive and negative triggers, and fewer than 200 lines.
- [x] The work skill contains no doctor override, force, direct task-state write, or git-facade guidance.
- [x] The recovery skill requires doctor-lock/state evidence and read-only diagnosis before mutation.
- [x] Skills use JSON command output as the live contract and contain no vendor-specific required metadata.
- [x] Re-running `init --repair` is idempotent and updates stale managed skill content without overwriting unmanaged neighboring skills.
- [x] Trigger tests cover normal work, review/verify work, generic git work without TaskForge, doctor lock, and ownership conflict.

## Test / Verification Command
```bash
npm test -- --run tests/skill-files.test.ts tests/agent-frameworks.test.ts tests/init.test.ts tests/init-opencode.test.ts
rg -n 'checkpoint|submit|taskforge diff|taskforge pr|--force' src/core/skill-files.ts
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## Expected Output / Behavior
Two canonical skills installed identically by generic and OpenCode init; <200 lines each; no facade/force guidance; idempotent repair. All gates pass.

## Dependencies
TF-SIMP-06 (TASK-322). Independent of TF-EMBED-02.

## Risks
Risk: Medium. Over-broad descriptions cause false skill activation; copied workflow detail becomes stale. Trigger and non-trigger tests are mandatory.

## Continuation Policy
Auto-continue unless gates fail. Stop if a skill duplicates dynamic command contract or exceeds 200 lines.

## Agent Notes

### 2026-06-27T00:00:00Z System
- Task updated via taskforge update
- riskLevel set to "Medium"
- dependsOn set to [TASK-322]

## Result
Implemented. Created `src/core/skill-files.ts` with two canonical skills:
`taskforge-work-task` (select/claim/execute/verify/complete) and
`taskforge-recover-state` (doctor-lock/invalid-state/ownership-conflict/stale-
agent recovery). Both wired into generic.ts (was a no-op apply) and opencode.ts
apply/plan via `installSkillFiles`/`getSkillFilePlanEntries` — both adapters
install IDENTICAL canonical files (AC #1). Bodies are concise (<60 lines each),
imperative, defer to `taskforge next --json` as the live contract, and do not
duplicate the status graph or command map. Frontmatter has only `name` +
`description` (no vendor-specific metadata). Work skill has no doctor override,
--force, task-state write, or facade guidance (AC #3). Recovery skill mandates
read-only diagnosis before any mutation (AC #4). AC rg clean:
`rg 'checkpoint|submit|taskforge diff|taskforge pr|--force' src/core/skill-files.ts`
→ 0 matches. Idempotent install (writeGeneratedFile overwrite); neighbors
untouched (AC #6).

Tests: tests/skill-files.test.ts (19 tests: structure, forbidden content,
diagnosis-first ordering, trigger coverage positive+negative, install behavior
idempotent+neighbors+dry-run); tests/init.test.ts +1 (cmdInit installs skills);
tests/init-opencode.test.ts +1 (generic vs opencode produce identical files);
tests/agent-frameworks.test.ts updated (generic plan/apply no longer no-ops;
opencode plan includes skills).

Gates: typecheck 0 errors, lint 0 errors (32 no-explicit-any warnings), build
success, 883 tests pass / 74 files (+19 from TASK-322's 864).

## Links
- Issue:
- Project Item:
- PR: https://github.com/squoyster/task-forge/pull/new/agent/TASK-323-portable-agent-skills
- Branch: agent/TASK-323-portable-agent-skills
- Worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-323
- CI:
- Test Log:

## DOX Rules
```dox
R-E01-001: work_skill | trigger=taskforge_task_work -> M start(`taskforge next --json`) ∧ M obey(executable_next_actions).
R-E01-002: recovery_skill | trigger=doctor_or_state_failure -> M diagnose_read_only_first ∧ M preserve(doctor_lock).
R-E01-003: skill_body -> M concise ∧ M imperative ∧ F duplicate(dynamic_command_contract).
R-E01-004: framework_adapter -> M reuse(canonical_skill) ∧ F vendor_workflow_fork.
```

## Agent Prompt
Add a canonical project skill source that `taskforge init` installs under `.agents/skills/`. Create exactly two skills: `taskforge-work-task` for selecting, claiming, executing, verifying, and completing tasks; and `taskforge-recover-state` for doctor-lock, invalid-state, ownership-conflict, and stale-agent recovery. Each `SKILL.md` has only `name` and a trigger-complete `description` in frontmatter, then concise imperative instructions. Both skills call `taskforge next --json` or current diagnostic JSON commands and follow returned actions; neither duplicates the status graph, command map, or framework permissions. Framework adapters may add discovery links/config, but must reference the same canonical skill files rather than fork their contents.
