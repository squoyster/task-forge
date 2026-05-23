---
id: TASK-094
type: Bug
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
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
   - Pre-existing: "These failures were present when the task started. Create follow-up tasks, document them in agent notes, then re-run with --force --reason."
   - Can't determine: "Investigate whether failures are caused by your changes before using --force."

3. **`--reason` flag on `--force`** — Require (or strongly encourage) an explicit reason when forcing past gates. E.g., `taskforge done TASK-086 --force --reason "pre-existing failures, follow-ups TASK-091-093 created"`. This makes bypasses auditable in agent notes.

4. **Structured gate failure summary** — Instead of burying failures in raw test output, emit a clean summary of which gates failed, how many failures, and whether they are regressions or pre-existing.

## Scope

- `src/commands/done.ts` — gate check logic and messaging
- `src/commands/gates.ts` — structured output, baseline capture
- `tests/done.test.ts` — update for new messaging/behavior
- `tests/gates.test.ts` — baseline tests

## Acceptance Criteria

- [ ] `taskforge done` never suggests `--force` as a default next step
- [ ] Gate failures are classified as regression vs pre-existing when a baseline exists
- [ ] Correct guidance is shown for each situation
- [ ] `--force` accepts an optional `--reason` flag stored in agent notes
- [ ] No change to `--force` behavior when no `--reason` is given (backward compatible)

## Acceptance Criteria

- [ ]

## Agent Notes
