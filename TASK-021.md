---
id: TASK-021
type: Refactor
status: Done
priority: P0
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-021: Harden Status Semantics — Centralize, Normalize, Keep Human-Readable Canonical Values

## Goal

Harden TaskForge's task status handling by centralizing definitions, normalizing input variants at boundaries, and replacing ad hoc string literals with shared constants — while **intentionally preserving the current human-readable persisted values** (`In Progress`, `Needs Spec`, etc.) as canonical.

## Architectural Intent

TaskForge task files are meant to be readable and safely editable by humans and agents. Human-readable status values are acceptable as canonical persisted values. **Do not** migrate to snake_case such as `in_progress`.

However, the current codebase repeats raw status strings across many files, making the system fragile because casing and spacing effectively become part of the API. This task should centralize all status definitions, provide a `normalizeStatus()` helper that accepts common variants, and ensure all internal logic uses shared constants.

## What NOT to Do

Do **not** change the persisted task frontmatter format. Task files must continue to use:

```yaml
status: In Progress
status: Needs Spec
status: Done
```

Do **not** add a mapping layer that converts between canonical and display values — the canonical values *are* the display values.

## Scope

### 1. Centralized Status Constants

Create a single source of truth for all status values, replacing ad hoc string literals across the codebase:

New file: `src/util/status-constants.ts` (or similar)

```typescript
export const STATUS = {
  INBOX: "Inbox",
  NEEDS_SPEC: "Needs Spec",
  READY: "Ready",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  REVIEW: "Review",
  VERIFY: "Verify",
  DONE: "Done",
  REJECTED: "Rejected",
  DEFERRED: "Deferred",
} as const;

export const ALL_STATUSES: readonly string[] = Object.values(STATUS);
export const ACTIVE_STATUSES = [STATUS.READY, STATUS.IN_PROGRESS, STATUS.REVIEW, STATUS.VERIFY];
export const TERMINAL_STATUSES = [STATUS.DONE, STATUS.REJECTED, STATUS.DEFERRED];
```

### 2. Status Variant Normalization

Add a `normalizeStatus(input: string): string` function that accepts common input variants and returns the canonical value:

| Input | Output |
|---|---|
| `"In Progress"` | `"In Progress"` |
| `"in_progress"` | `"In Progress"` |
| `"in-progress"` | `"In Progress"` |
| `"in progress"` | `"In Progress"` |
| `"InProgress"` | `"In Progress"` |
| `"needs_spec"` | `"Needs Spec"` |
| `"NeedsSpec"` | `"Needs Spec"` |
| `"ready"` | `"Ready"` |
| `"done"` | `"Done"` |

Invalid statuses should fail clearly with the list of allowed canonical values.

### 3. Update Schema Validation

Update `src/core/task.ts`:
- Keep the current `TaskStatus` enum with human-readable values
- Add `z.preprocess(normalizeStatus, TaskStatus)` to the status field
- The Zod schema should reject truly invalid values

### 4. Update Core Logic

- `src/core/status-transition.ts` — use `STATUS.*` constants instead of string literals
- `src/core/scheduler.ts` — use `STATUS.*` and `ACTIVE_STATUSES`
- `src/core/task-store.ts` — use constants for defaults
- `src/integrations/github/types.ts` — use constants

### 5. Update Commands

- `src/commands/start.ts` — use `STATUS.READY`, `STATUS.IN_PROGRESS`
- `src/commands/done.ts` — use `STATUS.DONE`, `STATUS.REVIEW`, `STATUS.VERIFY`
- `src/commands/block.ts` — use `STATUS.BLOCKED`
- `src/commands/sweep.ts` — use `STATUS.IN_PROGRESS`, `STATUS.READY`
- `src/commands/status.ts` — use constants, accept normalized input in `--status` filter
- `src/commands/summary.ts` — use constants
- `src/commands/list.ts` — normalize `--status` filter input
- `src/cli.ts` — normalize `--status` filter parsing

### 6. Update Tests

All test files that use status string literals should use the `STATUS.*` constants or be updated to use the canonical values.

### 7. Templates

- `src/markdown/templates.ts` — use constants

## Acceptance Criteria

- [x] Single `STATUS` constant object exists as the source of truth
- [x] `normalizeStatus()` accepts all common variants listed above and returns canonical values
- [x] `normalizeStatus()` returns original value for invalid inputs (Zod enum catches and rejects them)
- [x] `TaskSchema.status` uses `z.preprocess(normalizeStatus, TaskStatus)` for input normalization
- [x] All internal status comparisons use `STATUS.*` constants, not raw strings
- [x] All CLI commands that accept `--status` filter normalize input via `normalizeStatus()`
- [x] `status-transition.ts` keys are derived from or reference `STATUS` constants
- [x] Existing task files with canonical human-readable statuses parse without change
- [x] No ad hoc string literals remain for status values in src/ (excluding tests)
- [x] All existing tests pass
- [x] Test files import `STATUS` constants where possible

## Test / Verification Command

```bash
npm run typecheck && npm run lint && npm run build && npm test -- --run
```

## Dependencies

None — this is a pure refactor of existing status handling. Should be done before TASK-017 (JSON contracts) since that will add `--json` output.

## Risk Level

Medium — touches many files but is a mechanical refactor. Tests should catch regressions.

## Agent Notes

### 2026-05-21 Implementer

- Created `src/util/status-constants.ts` with `STATUS` constants, `normalizeStatus()` helper, and `createStatusSchema()` Zod preprocessor
- Updated `src/core/task.ts` to use `z.preprocess(normalizeStatus, TaskStatus)` — accepts variants like `in_progress`, `needs_spec`, `InProgress`
- Updated `src/core/status-transition.ts` — all transition keys use `STATUS.*` constants
- Updated `src/core/scheduler.ts` — uses `STATUS.*` constants and `ACTIVE_STATUSES` for task scoring/selection
- Updated `src/core/task-store.ts` — default status uses `STATUS.INBOX`
- Updated commands: `start.ts`, `done.ts`, `block.ts`, `sweeper.ts`, `status.ts`, `summary.ts`, `list.ts` — all use `STATUS.*` constants instead of raw strings
- Updated `src/commands/deps/create-tasks.ts` — uses `STATUS.READY` for new task creation
- Updated `src/integrations/github/types.ts` — `STATUS_LABELS` keys use computed `STATUS.*` constants
- `list.ts` and `status.ts` normalize `--status` filter input via `normalizeStatus()`
- All verification gates pass: typecheck, lint (0 errors), build, 286 tests

## Continuation Policy

Auto-continue unless a stopping condition occurs.
