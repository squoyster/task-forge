---
id: TASK-321
type: Task
status: Inbox
priority: P2
agentRole: Implementer
riskLevel: High
humanInterventionRequired: false
dependsOn:
  - TASK-320
spec_hash: 2e9f4d825cb27a1d
---
# TASK-321: TF-SIMP-05: Publish a minimal default CLI and a complete `next --json` packet
## Goal
Make `taskforge next --json` the single normal entry point and keep rare/optional commands out of default help without compatibility wrappers. The CLI currently teaches many overlapping lifecycle, diagnostic, audit, guard, dependency, and adapter concepts. Hiding rare commands while making `next` complete reduces context and operator choice without deleting recovery capability.

## Background
Source: TaskForge Simplification Task Pack 2026-06-27 (TF-SIMP-05). Classify commands at registration time. Default help exposes only the entry surface: `init`, `next`, `prompt`, `inspect`, `list`, `new`, `update`, `gates`, `validate-state`, `doctor`. Contextual task mutations stay callable but hidden, discoverable via `next --json`: `claim`, `heartbeat`, `release`, `block`, `promote`, `done`, `reject`. Recovery/diagnostic commands callable but hidden: `status`, `summary`, `unlock`, `sweep`, `agents`, `report`, `audit`, `transcript`, `timeline`, `ac-check`, `config-validate`, `guard`. `sync`, `deps`, `mcp` are opt-in and absent from default help. No taxonomy framework — a small constant or local registration grouping suffices.

## Scope
Allowed files/directories:
- `src/cli.ts`
- `src/commands/next.ts`
- `src/core/command-result.ts`
- `src/core/command-states.ts`
- `src/core/next-command-maps.ts`
- `src/core/result-builder.ts`
- `src/core/result-renderer.ts`
- `tests/commands/next.test.ts`
- `tests/command-result.test.ts`
- `tests/command-states.test.ts`
- `tests/cli-help.test.ts` — create
- `docs/workflow.md`
- `docs/next-action-semantics.md`
- `docs/architecture/command-return-contract.md`
- `src/core/AGENTS.md`
- `src/commands/AGENTS.md`
- `tests/AGENTS.md`

Forbidden files/directories:
- All `src/commands/*.ts` except `src/commands/next.ts`
- `src/commands/deps/**`
- `src/core/task.ts`, `src/core/task-store.ts`, `src/core/task-state-transaction.ts`
- `src/core/git.ts`, `src/core/hooks.ts`, `src/commands/hook.ts`
- `src/core/audit.ts`, `src/core/doctor-lock.ts`, `src/core/mutation-guard.ts`
- `src/core/config.ts`, `src/util/paths.ts`, `.taskforge/config.json`, `opencode.json`, `dist/**`

## Acceptance Criteria
- [ ] Default `taskforge --help` fits the documented core taxonomy and omits hidden/optional commands.
- [ ] Hidden recovery commands remain callable; no compatibility aliases are added.
- [ ] `sync`, `deps`, and `mcp` require explicit opt-in and do not initialize by default.
- [ ] `next --json` is sufficient to select, claim/resume ownership, create or enter the direct-git worktree, load the compact prompt, and recognize doctor/blocked states without broad docs.
- [ ] Every returned next action passes the executable-command contract from TF-SIMP-01.
- [ ] Help and representative `next --json` states have contract tests.

## Test / Verification Command
```bash
node --import tsx src/cli.ts --help
node --import tsx src/cli.ts next --json
npm test -- --run tests/cli-help.test.ts tests/commands/next.test.ts tests/command-result.test.ts tests/command-states.test.ts
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

## Expected Output / Behavior
`--help` shows only core commands. `next --json` returns task identity/status, ownership, branch/worktree expectations, cwd, reason, safety constraints, prompt reference, and ordered executable next actions. All gates pass.

## Dependencies
TF-SIMP-04 (TASK-320).

## Risks
Risk: High. Hidden does not mean unauthorized; authority checks must remain in command handlers. JSON field changes must be additive or versioned if an existing consumer requires stability.

## Continuation Policy
Auto-continue unless gates fail. Stop if a hidden command loses its authority check.

## Agent Notes

### 2026-06-27T00:00:00Z System
- Task updated via taskforge update
- riskLevel set to "High"
- dependsOn set to [TASK-320]

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
R-05-001: help | default -> expose(core_commands) ∧ hide(recovery∪diagnostic∪optional).
R-05-002: next_json | actionable_task -> M include({taskId,status,owner,branch,worktree,cwd,reason,safety,prompt,nextActions}).
R-05-003: next_action | output -> M executable_now ∧ ordered ∧ minimal.
R-05-004: optional | feature∈{sync,deps,mcp} -> M explicit_opt_in.
```

## Agent Prompt
Classify commands at registration time. Default help exposes only the entry surface listed above. Keep contextual task mutations callable but hidden and discoverable through `next --json`. Keep other recovery/diagnostic commands callable but hidden. Keep `sync`, `deps`, and `mcp` opt-in and absent from default help. Make `next --json` return task identity/status, ownership, branch/worktree expectations, cwd, reason, safety constraints, prompt reference, and ordered executable next actions. Do not add a taxonomy framework; a small constant or local registration grouping is sufficient.
