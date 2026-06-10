---
id: TASK-094
type: Bug
status: Done
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
context_hash: 8c607774d14d0be5
spec_hash: a26f2cc119a715d8
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-094
---

# TASK-094: Improve gate-failure guidance in done command

## Goal

## Background

When `taskforge done` fails because of gate failures, the CLI prints:

```
Error: 2/4 gate(s) failed.
Not all gates passed. Run 'taskforge done --force' to override.
```

This message is actively harmful: it frames `--force` as the default next step rather than a last resort. The correct response to failing gates is to fix the failures or determine they are pre-existing and document follow-up tasks — not to bypass verification.

The CLI currently cannot distinguish between regressions (your change broke something) and pre-existing failures (it was already broken). It should.

## Proposed Changes

1. **Gate baseline / snapshot** — On `taskforge start`, capture a snapshot of gate results (test pass/fail counts, typecheck errors, lint errors). On `taskforge done`, compare current results to the baseline to detect regressions.

2. **Context-appropriate guidance** — Replace the `--force` suggestion with:
   - Regression: "X test(s) that previously passed are now failing. Fix the failures and re-run."
   - Pre-existing: "These failures were present when the task started. Create BUG tasks for the failures, add them as `dependsOn` on this task, then block this task until the bugs are fixed. Re-run when dependencies are resolved."
   - Can't determine: "Investigate whether failures are caused by your changes before using --force."

3. **Dependency workflow for pre-existing failures** — The `done` command should refuse to proceed and guide the agent through the correct workflow:
   1. Create BUG tasks for each pre-existing failure via `taskforge new`
   2. Add BUG task IDs as `dependsOn` on the current task
   3. Optionally: `taskforge block <current-task> "waiting on pre-existing test fixes: TASK-XXX, TASK-YYY"`
   4. When BUG tasks are resolved, return to the current task and re-run `taskforge done`
   5. The gate check should then pass cleanly — no `--force` needed

4. **`--reason` flag on `--force`** — Require (or strongly encourage) an explicit reason when forcing past gates. This makes bypasses auditable in agent notes. Note: force-completing past pre-existing failures should be discouraged — the dependency workflow (item 3) is the correct path.

5. **Structured gate failure summary** — Instead of burying failures in raw test output, emit a clean summary of which gates failed, how many failures, and whether they are regressions or pre-existing.

## Scope

- `src/commands/done.ts` — gate check logic and messaging
- `src/commands/gates.ts` — structured output, baseline capture
- `tests/done.test.ts` — update for new messaging/behavior
- `tests/gates.test.ts` — baseline tests

## Acceptance Criteria

- [ ] `taskforge done` never suggests `--force` as a default next step
- [ ] Gate failures are classified as regression vs pre-existing when a baseline exists
- [ ] Regression guidance: tells agent to fix the failures and re-run
- [ ] Pre-existing guidance: tells agent to create BUG tasks, add `dependsOn`, and block until fixed
- [ ] Can't-determine guidance: tells agent to investigate before proceeding
- [ ] `--force` accepts an optional `--reason` flag stored in agent notes
- [ ] No change to `--force` behavior when no `--reason` is given (backward compatible)

## Agent Notes

### 2026-05-23 System
- Task marked Done (forced)
- Completed despite gate failures — forced.

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-094

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-094

### 2026-05-23 System
- Task claimed via taskforge start TASK-094
- Session: 5e58faef05
- Branch: agent/TASK-094-improve-gate-failure-guidance-in-done-co--5e58faef05

### 2026-05-23 System
- Task claimed via taskforge start TASK-094
- Session: 5e58faef05
- Branch: agent/TASK-094-improve-gate-failure-guidance-in-done-co--5e58faef05

### 2026-05-23 02:34 System
- Discovered during TASK-086 (project runtime configuration) — pre-existing test failures and CLI message audit findings.
