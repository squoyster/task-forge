---
id: TASK-018
type: Feature
status: Ready
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-018: Add `gates` Command

## Goal

Make the CLI the owner of verification gates. The `taskforge gates` command runs the configured verification suite (typecheck, lint, build, test) and reports structured results — enabling agents and the sweeper to check gates before marking tasks as Done.

## Background

Currently, agents manually run verification gates (`npm run typecheck && npm run lint && npm run build && npm test -- --run`). There is no:

- Standardized way to run gates
- Machine-parseable result
- Gate result persistence (to agent notes or report file)
- Enforcement: Done should refuse if gates fail (unless `--force`)

A `gates` command fills this gap.

## Configuration

Gates are defined in `.taskforge/config.json`:

```json
{
  "gates": {
    "typecheck": "npm run typecheck",
    "build": "npm run build",
    "lint": "npm run lint",
    "test": "npm test -- --run"
  }
}
```

## Scope

### New files:

- `src/commands/gates.ts` — `cmdGates()` implementation
- `tests/gates.test.ts` — tests

### Modified files:

- `src/cli.ts` — register `gates` command
- `src/commands/done.ts` — optionally refuse Done if gates haven't passed (unless `--force`)
- `src/core/config.ts` — load gates config

## Acceptance Criteria

- [ ] `taskforge gates` reads gates from `.taskforge/config.json`
- [ ] `taskforge gates` runs each gate command sequentially in the current worktree
- [ ] `taskforge gates` reports pass/fail for each gate
- [ ] `taskforge gates --json` emits structured JSON results
- [ ] `taskforge gates --only typecheck,lint` runs a subset of gates
- [ ] Gate results are appended to Agent Notes or written to a report file
- [ ] `taskforge done TASK-123` warns (or refuses) if gates have not passed, unless `--force`
- [ ] Tests cover gate execution, reporting, and integration with Done
- [ ] All existing tests pass

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

TASK-017 (JSON contracts) — gates output should use the JSON contract.

## Risk Level

Low — additive feature; existing behavior unchanged.

## Continuation Policy

Auto-continue unless a stopping condition occurs.
