# TaskForge AC Repair Task Pack

> Status: Historical task pack. Use `docs/workflow.md` and `docs/architecture/command-return-contract.md` for the current command contract. Older examples may use pre-`TaskForgeCommandResult` terminology such as `nextAction.kind`.

## Purpose

This task pack converts the current audit findings into discrete, agent-ready remediation tasks. Each task has **exactly one acceptance criterion** to force precise implementation and prevent vague or partially checked completion.

## Operating Rules for These Tasks

- Each task must remain small.
- Each task has one acceptance criterion only.
- A task may not be marked `Done` unless its single AC is objectively satisfied.
- If the implementing agent discovers the AC is blocked by prior broken work, it must create a bug task and either continue safely or block explicitly.
- Forced completion must be prohibited unless a human explicitly authorizes it.

---

# P0 Tasks

## TASK-ACFIX-001: Reject Done Transition When AC Section Is Missing

**Type:** Bug  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Prevent `taskforge done` from marking a task complete if the task file has no `## Acceptance Criteria` section.

### Background

Several tasks are currently marked `Done` without meaningful ACs. This invalidates task-state reliability and makes agentic completion untrustworthy.

### Implementation Notes

- Add parsing support for detecting the AC section.
- Enforce this in `done` transition logic.
- The failure output must be explicit and actionable.

### Acceptance Criteria

- [ ] `taskforge done TASK-ID` refuses to complete a task whose Markdown file lacks a `## Acceptance Criteria` section and emits a next action telling the agent to add or request ACs before completion.

---

## TASK-ACFIX-002: Reject Done Transition When AC Items Are Blank

**Type:** Bug  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-001

### Goal

Prevent tasks with placeholder AC entries from being marked `Done`.

### Background

Many task files contain only `- [ ]` under ACs. That is not a verifiable acceptance condition.

### Implementation Notes

- Treat blank checkbox text as invalid.
- Include line/section context in the error where practical.

### Acceptance Criteria

- [ ] `taskforge done TASK-ID` refuses to complete a task containing any blank acceptance criterion checkbox such as `- [ ]` or `- [x]` with no criterion text.

---

## TASK-ACFIX-003: Reject Done Transition When AC Items Are Unchecked

**Type:** Bug  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-001

### Goal

Prevent incomplete ACs from being bypassed.

### Background

A task cannot be considered complete while one or more explicit acceptance criteria remain unchecked.

### Implementation Notes

- Detect Markdown checkboxes under `## Acceptance Criteria`.
- Require all nonblank criteria to be checked before `Done`.

### Acceptance Criteria

- [ ] `taskforge done TASK-ID` refuses to complete a task when any nonblank acceptance criterion under `## Acceptance Criteria` remains unchecked.

---

## TASK-ACFIX-004: Add Structured Override Metadata for Forced Completion

**Type:** Feature  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-001, TASK-ACFIX-002, TASK-ACFIX-003

### Goal

Make exceptional completion explicit, auditable, and non-normal.

### Background

Current task notes show `Task marked Done (forced)` and `Completed despite gate failures — forced.` This is too loose for agentic governance.

### Implementation Notes

- Add a distinct override path rather than overloading normal `Done`.
- Record override reason, actor, timestamp, and failed checks/gates when known.
- Human override should be visible in task frontmatter or structured task metadata.

### Acceptance Criteria

- [ ] A forced completion requires a nonempty override reason and records structured override metadata including actor, timestamp, reason, and failed gate names if present.

---

## TASK-ACFIX-005: Report Invalid Done Tasks in Doctor

**Type:** Bug  
**Priority:** P0  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-001, TASK-ACFIX-002, TASK-ACFIX-003

### Goal

Make existing invalid completions visible.

### Background

The repository already contains `Done` tasks with empty ACs and forced completion notes. `doctor` must flag these.

### Implementation Notes

- Reuse the AC validator from `done`.
- Report per-task diagnostics.
- JSON output must include machine-readable issue codes.

### Acceptance Criteria

- [ ] `taskforge doctor --json` reports every `Done` task that has missing, blank, or unchecked acceptance criteria using a stable machine-readable diagnostic code.

---

## TASK-ACFIX-006: Add Validate-State Rule for Invalid Done Tasks

**Type:** Bug  
**Priority:** P0  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-005

### Goal

Make invalid completion fail validation, not just doctor diagnostics.

### Background

`validate-state` should be the stricter state integrity gate used by agents and CI.

### Acceptance Criteria

- [ ] `taskforge validate-state` exits nonzero when any `Done` task has missing, blank, or unchecked acceptance criteria.

---

## TASK-ACFIX-007: Add Command Next-Action Envelope Type

**Type:** Feature  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Define a standard command feedback contract that tells agents what to do next.

### Background

The CLI currently reports success/failure, but does not consistently direct agent behavior.

### Implementation Notes

Define a reusable result shape similar to:

```ts
interface CommandResultEnvelope<T = unknown> {
  ok: boolean;
  state: string;
  data?: T;
  nextAction: {
    kind: string;
    instruction: string;
    stop: boolean;
    allowedCommands: string[];
  };
}
```

### Acceptance Criteria

- [ ] A shared command result envelope type exists and includes `ok`, `state`, `nextAction.kind`, `nextAction.instruction`, `nextAction.stop`, and `nextAction.allowedCommands`.

---

## TASK-ACFIX-008: Make Gates Emit Fix-Current-Task Next Action on Test Failure

**Type:** Feature  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-007

### Goal

Tell agents to fix local failures before moving on.

### Background

When a gate fails because of the current task, the agent should repair the issue and rerun gates.

### Acceptance Criteria

- [ ] `taskforge gates --json` emits `nextAction.kind = "FIX_CURRENT_TASK"` when any configured gate fails and no upstream-failure override is supplied.

---

## TASK-ACFIX-009: Add Upstream Failure Classification to Gates

**Type:** Feature  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-008

### Goal

Support the workflow where a broken test suite or unrelated failure becomes a new bug task.

### Background

Agents need an explicit path when the failing condition is not caused by the current task.

### Implementation Notes

Possible interface:

```bash
taskforge gates --json --classify-upstream "reason text"
```

or a follow-up command:

```bash
taskforge gates classify-upstream TASK-ID --reason "..."
```

Pick the cleanest design consistent with the CLI.

### Acceptance Criteria

- [ ] A gates failure can be explicitly classified as upstream, causing JSON output to emit `nextAction.kind = "CREATE_BUG_TASK_AND_CONTINUE"` with an instruction to create a bug task and continue only if safe.

---

## TASK-ACFIX-010: Add Block-for-Human Next Action

**Type:** Feature  
**Priority:** P0  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-007

### Goal

Give agents a clear stop condition for ambiguous, unsafe, or human-decision-required cases.

### Acceptance Criteria

- [ ] Any command that detects a required human decision emits `nextAction.kind = "BLOCK_FOR_HUMAN"` and `nextAction.stop = true` in JSON output.

---

## TASK-ACFIX-011: Remove Direct Task Markdown Mutation from Start Before Transaction

**Type:** Bug  
**Priority:** P0  
**Risk:** High  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Make `start` comply with transactional task-state mutation.

### Background

`cmdStart` currently performs direct task mutation before the transaction boundary. That undermines durable claim semantics.

### Acceptance Criteria

- [ ] `cmdStart` no longer calls direct mutation helpers such as `updateTaskLock`, `updateTaskStatus`, `writeTaskFile`, or `appendAgentNote` before successful transactional claim completion.

---

## TASK-ACFIX-012: Capture Base HEAD in Task-State Transactions

**Type:** Bug  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Make transaction conflict detection explicit.

### Acceptance Criteria

- [ ] `withTaskStateTransaction` records the task-state branch base HEAD before mutation and includes that base HEAD in transaction diagnostics or audit metadata.

---

## TASK-ACFIX-013: Validate Invariants Before Transaction Commit

**Type:** Bug  
**Priority:** P0  
**Risk:** High  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-012

### Goal

Prevent invalid task-state commits.

### Acceptance Criteria

- [ ] `withTaskStateTransaction` runs task-state invariant validation after mutation and before commit, aborting the transaction on validation errors.

---

## TASK-ACFIX-014: Auto-Emit Audit Event for Every Task-State Transaction

**Type:** Feature  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-013

### Goal

Make task-state mutation auditable by default.

### Acceptance Criteria

- [ ] Every successful `withTaskStateTransaction` appends at least one structured audit event describing the transaction name, changed task IDs, actor/session if known, and resulting commit SHA if available.

---

## TASK-ACFIX-015: Add Dirty-Task Write Set to Transactions

**Type:** Refactor  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-013

### Goal

Reduce conflict surface and avoid rewriting unrelated task files.

### Acceptance Criteria

- [ ] `withTaskStateTransaction` writes only task files that were explicitly modified in the transaction dirty set.

---

## TASK-ACFIX-016: Add Transaction Tests for Conflict Retry

**Type:** Test  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** QA
**Depends On:** TASK-ACFIX-012

### Goal

Verify optimistic retry behavior.

### Acceptance Criteria

- [ ] Automated tests prove that a non-fast-forward task-state push causes the transaction to reload fresh state and rerun the mutation before retrying.

---

## TASK-ACFIX-017: Add Transaction Tests for Invariant Abort

**Type:** Test  
**Priority:** P0  
**Risk:** Medium  
**Agent Role:** QA  
**Depends On:** TASK-ACFIX-013

### Goal

Verify invalid mutations cannot commit.

### Acceptance Criteria

- [ ] Automated tests prove that a transaction producing invalid task-state fails before commit and leaves task-state unchanged.

---

# P1 Tasks

## TASK-ACFIX-018: Add Generic Transcript Provider Interface

**Type:** Feature  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-007

### Goal

Decouple per-task agentic audit logs from OpenCode.

### Background

OpenCode is the presumptive target, but transcript capture should be generic.

### Acceptance Criteria

- [ ] A generic `TranscriptProvider` or equivalent interface exists for importing or appending session transcript events independent of OpenCode.

---

## TASK-ACFIX-019: Write OpenCode Transcript Events to Per-Session Logs

**Type:** Bug  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-018

### Goal

Complete per-session audit storage.

### Acceptance Criteria

- [ ] The generated OpenCode audit plugin writes session events to `logs/taskforge/sessions/<sessionId>.jsonl`.

---

## TASK-ACFIX-020: Write OpenCode Transcript Events to Per-Task Logs

**Type:** Bug  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-018

### Goal

Complete per-task audit storage.

### Acceptance Criteria

- [ ] The generated OpenCode audit plugin writes task events to `logs/taskforge/tasks/<taskId>/transcript.jsonl`.

---

## TASK-ACFIX-021: Capture File Events in OpenCode Audit Plugin

**Type:** Feature  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-018

### Goal

Record file edits for agentic traceability.

### Acceptance Criteria

- [ ] The generated OpenCode audit plugin records file edit events with timestamp, task ID, session ID if available, and file path.

---

## TASK-ACFIX-022: Capture Permission Events in OpenCode Audit Plugin

**Type:** Feature  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-018

### Goal

Record permission requests and approvals/denials.

### Acceptance Criteria

- [ ] The generated OpenCode audit plugin records permission request and permission response events with timestamp, task ID, session ID if available, and decision metadata.

---

## TASK-ACFIX-023: Fix Task-ID Resolution Regex in OpenCode Audit Plugin

**Type:** Bug  
**Priority:** P1  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Ensure task ID detection actually works.

### Acceptance Criteria

- [ ] The generated OpenCode audit plugin correctly extracts `TASK-123` from branches like `agent/TASK-123-example` and worktree paths like `/worktrees/task-forge/TASK-123`.

---

## TASK-ACFIX-024: Add Recursive Secret Redaction for Audit Events

**Type:** Security  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-018

### Goal

Prevent audit logs from storing credentials.

### Acceptance Criteria

- [ ] Audit plugin redaction recursively replaces values for keys matching token, secret, password, api key, private key, credential, or authorization before writing JSONL.

---

## TASK-ACFIX-025: Stop Silently Swallowing Audit Write Failures

**Type:** Bug  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-018

### Goal

Make audit failure visible.

### Acceptance Criteria

- [ ] Audit write failures are reported through a visible diagnostic path unless audit failure suppression is explicitly enabled in config.

---

## TASK-ACFIX-026: Add JSON Output to Timeline Command

**Type:** Bug  
**Priority:** P1  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Make all audit read commands machine-readable.

### Acceptance Criteria

- [ ] `taskforge timeline TASK-ID --json` emits a structured JSON summary equivalent to the human timeline output.

---

## TASK-ACFIX-027: Enforce Audit Event Type Schema

**Type:** Bug  
**Priority:** P1  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Prevent arbitrary event names from degrading audit consistency.

### Acceptance Criteria

- [ ] `AuditEventSchema` validates `event` against the defined audit event type registry or an explicitly documented extension namespace rule.

---

## TASK-ACFIX-028: Route Doctor Agent Diagnostics Through Agent Framework Adapter

**Type:** Refactor  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Remove hardcoded OpenCode-specific checks from generic doctor flow.

### Acceptance Criteria

- [ ] `taskforge doctor` invokes the configured `AgentFrameworkAdapter.doctor()` for agent-framework-specific diagnostics instead of duplicating OpenCode checks in `cmdDoctor`.

---

## TASK-ACFIX-029: Implement Doctor Fix Mode

**Type:** Feature  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-028

### Goal

Make `--fix` perform repairs rather than being a no-op.

### Acceptance Criteria

- [ ] `taskforge doctor --fix` repairs at least one missing or stale managed agent-framework artifact and reports the repair in both human and JSON output.

---

## TASK-ACFIX-030: Validate Audit JSONL Parseability in Doctor

**Type:** Feature  
**Priority:** P1  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Catch corrupted audit/transcript files.

### Acceptance Criteria

- [ ] `taskforge doctor --json` reports invalid JSONL lines in audit or transcript files with file path and line number.

---

## TASK-ACFIX-031: Replace Direct gh Usage in PR Command

**Type:** Refactor  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Remove hard dependency on GitHub CLI from the task git facade.

### Acceptance Criteria

- [ ] `cmdPr` no longer directly executes `gh` and instead delegates PR creation to a configured provider abstraction or emits a manual PR next action when no provider is configured.

---

## TASK-ACFIX-032: Emit Audit Event for PR Command

**Type:** Bug  
**Priority:** P1  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-031

### Goal

Ensure PR creation attempts are traceable.

### Acceptance Criteria

- [ ] `taskforge pr TASK-ID` appends a task transcript event for PR creation success, failure, or manual-provider-required outcome.

---

## TASK-ACFIX-033: Validate Ownership in Diff Command

**Type:** Bug  
**Priority:** P1  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Make all task worktree commands enforce the same ownership discipline.

### Acceptance Criteria

- [ ] `taskforge diff TASK-ID` validates task/worktree/session ownership before reading the task worktree diff.

---

## TASK-ACFIX-034: Fail Clearly on Invalid Config Instead of Returning Defaults

**Type:** Bug  
**Priority:** P1  
**Risk:** Medium  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Prevent silent misconfiguration.

### Background

`loadConfig()` currently catches all parse/validation failures and returns defaults. This hides invalid policy values.

### Acceptance Criteria

- [ ] `loadConfig()` surfaces invalid JSON or schema validation errors clearly instead of silently returning default config, except in an explicit documented fallback mode.

---

## TASK-ACFIX-035: Complete Agent Framework Integration Documentation

**Type:** Documentation  
**Priority:** P1  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Finish the missing documentation promised by the prior task.

### Acceptance Criteria

- [ ] `docs/agent-framework-integration.md` exists and documents `AgentFrameworkAdapter`, registry usage, generic adapter behavior, OpenCode adapter behavior, generated files, hooks, audit plugin, guard plugin, doctor integration, and extension author workflow.

---

## TASK-ACFIX-036: Link Agent Framework Integration Documentation from README and TASKFORGE

**Type:** Documentation  
**Priority:** P1  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-035

### Goal

Make extension documentation discoverable.

### Acceptance Criteria

- [ ] `README.md` and `TASKFORGE.md` both link to `docs/agent-framework-integration.md` with a short description of when users should read it.

---

## TASK-ACFIX-037: Add Extension Methodology Checklist

**Type:** Documentation  
**Priority:** P1  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-035

### Goal

Tell users how to add new integrations correctly.

### Acceptance Criteria

- [ ] The extension documentation includes a checklist for adding a new provider without modifying core domain logic.

---

# P2 Tasks

## TASK-ACFIX-038: Add task-forge CLI Alias

**Type:** Chore  
**Priority:** P2  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Support both compact and hyphenated command names.

### Acceptance Criteria

- [ ] `package.json` exposes both `taskforge` and `task-forge` as CLI binaries pointing to the same built entrypoint.

---

## TASK-ACFIX-039: Remove Placeholder Install URL from Container Runtime Documentation

**Type:** Documentation  
**Priority:** P2  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** None

### Goal

Avoid publishing misleading install instructions.

### Acceptance Criteria

- [ ] `docs/deployment/container-runtime.md` contains no `example.invalid` install URL and instead uses either a real project path or clearly marked local/manual install instructions.

---

## TASK-ACFIX-040: Add AC Linter for Task Files

**Type:** Feature  
**Priority:** P2  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-001, TASK-ACFIX-002, TASK-ACFIX-003

### Goal

Allow agents to validate task quality before starting work.

### Acceptance Criteria

- [ ] A command exists that scans task files and reports missing, blank, duplicate, or unchecked acceptance criteria without changing task state.

---

## TASK-ACFIX-041: Add Repair Report for Existing Forced-Done Tasks

**Type:** Chore  
**Priority:** P2  
**Risk:** Low  
**Agent Role:** QA  
**Depends On:** TASK-ACFIX-005

### Goal

Create a concrete backlog of existing forced-completion cleanup items.

### Acceptance Criteria

- [ ] A generated report lists every existing forced-Done task, its failed/blank AC condition, and the recommended remediation task ID.

---

## TASK-ACFIX-042: Add Documentation for Command Next-Action Semantics

**Type:** Documentation  
**Priority:** P2  
**Risk:** Low  
**Agent Role:** Implementer  
**Depends On:** TASK-ACFIX-007

### Goal

Make agent command interpretation stable and learnable.

### Acceptance Criteria

- [ ] Documentation exists that enumerates all supported `nextAction.kind` values, their meanings, whether agents may continue, and the expected follow-up commands.

---

# Recommended Execution Order

1. `TASK-ACFIX-001` through `TASK-ACFIX-006` — stop invalid completion.
2. `TASK-ACFIX-007` through `TASK-ACFIX-010` — define agent next-action protocol.
3. `TASK-ACFIX-011` through `TASK-ACFIX-017` — repair transaction integrity.
4. `TASK-ACFIX-018` through `TASK-ACFIX-027` — repair audit/transcript system.
5. `TASK-ACFIX-028` through `TASK-ACFIX-034` — repair provider/config safety issues.
6. `TASK-ACFIX-035` through `TASK-ACFIX-037` — complete extension documentation.
7. `TASK-ACFIX-038` through `TASK-ACFIX-042` — polish and reporting.

# Notes for Agents

- Do not combine tasks unless explicitly authorized.
- Do not mark a task `Done` with blank ACs.
- Do not use forced completion as a normal path.
- If gates fail and the failure is caused by your changes, fix it.
- If gates fail because of an unrelated upstream issue, create a bug task and continue only if safe.
- If the next step requires human judgment, block explicitly.
