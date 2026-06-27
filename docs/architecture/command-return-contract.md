# TaskForge Command Return Contract

## Overview

Every taskforge CLI command must return a structured `TaskForgeCommandResult` that prevents agentic drift. This is a mandatory control-plane invariant, not an optional feature.

## Schema

The `TaskForgeCommandResult` interface is defined in `src/core/command-result.ts` and validated by a Zod schema.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `ok` | `boolean` | Whether the command succeeded |
| `status` | `CommandStatus` | One of: `success`, `blocked`, `failed`, `noop`, `human_required`, `doctor_required` |
| `metadata` | `CommandMetadata` | Command name, timestamp, duration, session ID |
| `context` | `CommandContext` | Task ID, worktree path, branch name |
| `agentPrompt` | `AgentPromptEnvelope` | Agent role and instruction |
| `validNextCommands` | `ValidNextCommand[]` | List of valid next commands |
| `todoMerge` | `TodoMergeInstruction` | Todo list merge instructions |
| `contextCleanup` | `ContextCleanupInstruction` | Context cleanup instructions |
| `prohibitedActions` | `ProhibitedAction[]` | Actions the agent must not take |
| `recovery` | `RecoveryInstruction` | Recovery guidance for error states |
| `diagnostics` | `DiagnosticItem[]` | Diagnostic messages |
| `data` | `unknown` | Optional structured command-specific payload for agents and integrations |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `audit` | `AuditReference` | Audit trail reference |
| `guidance` | `string` | Human-readable guidance |
| `error` | `string` | Error message |
| `code` | `string` | Error code |

## Result Builders

Use the builder functions in `src/core/result-builder.ts` to create results:

- `successResult()` — Command succeeded
- `blockedResult()` — Command blocked (requires reason)
- `failedResult()` — Command failed (requires error, optional recovery steps)
- `noopResult()` — No action taken
- `humanRequiredResult()` — Requires human intervention
- `doctorRequiredResult()` — Requires doctor-mode recovery
- `contextCleanupResult()` — Task-switching with cleanup required

## Standard Prohibited Actions

Every normal-agent result must include these 5 standard prohibited actions:

1. `git commit` — Forbidden in managed agent sessions
2. `git push` — Forbidden in managed agent sessions
3. `git worktree add` — Forbidden in managed agent sessions
4. `git branch -D` — Forbidden in managed agent sessions
5. `direct task-state file edits` — Use `taskforge CLI` commands instead

## Valid Next Commands

Each command has a map of valid next commands defined in `src/core/next-command-maps.ts`. Maps are keyed by command name + outcome state.

### ValidNextCommand Structure

| Field | Type | Description |
|-------|------|-------------|
| `command` | `string` | The command to run |
| `purpose` | `string` | Why to run it |
| `when` | `string` | When to run it |
| `allowedFor` | `"all" \| "human" \| "doctor" \| "agent"` | Who can run it |
| `priority` | `1-3` | Priority (1 = highest) |

## Markdown Output

The `renderResultMarkdown()` function in `src/core/result-renderer.ts` produces output with exactly 9 sections in order:

1. **Command Success Status** — Status icon and message
2. **Current Context** — Task, worktree, branch
3. **Agentic Instruction** — Role and instruction
4. **Valid Next Commands** — List of next actions
5. **Todo Merge Required** — Todo list changes
6. **Context Cleanup** — Cleanup actions for task switching
7. **Prohibited Actions** — Actions to avoid
8. **Recovery Guidance** — Steps to recover from errors
9. **Audit and Trace** — Audit trail and diagnostics

## JSON Output

The `renderResultJson()` function outputs the full `TaskForgeCommandResult` as JSON. JSON is authoritative; Markdown must render the same semantics. Agents must prefer `validNextCommands` and structured `data` over parsing prose guidance.

### `next --json` Packet

`taskforge next --json` is the single normal entry point. For an actionable task it returns a complete packet sufficient to select, claim, set up the worktree, load the prompt, and recognize safety constraints without consulting broad docs:

| Field | Description |
|-------|-------------|
| `taskId` / `context.taskId` | The selected task identity |
| `task.statusLabel` | Canonical task status (e.g. `Ready`, `In Progress`) |
| `owner` | Current assignee (`null` if unclaimed) |
| `workspace` | `{ worktree, branch, exists }` — existing worktree/branch, or the expected worktree path before creation |
| `cwd` | Directory to enter (`worktree` if it exists, else repo root) |
| `guidance` | Why this task was selected (the reason) |
| `prohibitedActions` | Safety constraints (managed-agent git boundary) |
| `nextActions` | Ordered, executable commands with per-action `safety` |
| `prompt` | Reference to load the compact execution packet (`taskforge prompt <TASK-ID>`) |

Doctor-locked and blocked states return `status: "doctor_required"` / `"blocked"` with recovery `nextActions`.

## Invariant Enforcement

- Every new command MUST conform to `TaskForgeCommandResult` or fail typecheck
- `validate-state` audits all commands at runtime and reports deviations
- Tests prove invariants hold after every change
- PR review rejects any command that omits required fields

### validate-state Checks

The `validate-state` command checks:
- Standard prohibited actions count (must be 5)
- No `--force` in prohibited actions
- Next command maps exist for all major commands
- No `--force` in next commands for normal agents
- Sample result validates against schema

## Migration Guide

To wire an existing command to the new schema:

1. Import builders: `import { successResult, failedResult } from "../core/result-builder.js";`
2. Import next commands: `import { getValidNextCommands } from "../core/next-command-maps.js";`
3. Replace ad-hoc output with builder result
4. Add `--json` flag handling with `renderResultJson()`
5. Add Markdown output with `renderResultMarkdown()`

### Example

```typescript
import { successResult, failedResult } from "../core/result-builder.js";
import { getValidNextCommands } from "../core/next-command-maps.js";
import { renderResultMarkdown, renderResultJson } from "../core/result-renderer.js";

export async function cmdExample(taskId: string, opts: { json?: boolean }): Promise<void> {
  try {
    // ... command logic ...

    const result = successResult({
      command: "example",
      taskId,
      nextCommands: getValidNextCommands("example", "success"),
      guidance: "Command succeeded",
    });

    if (opts.json) {
      process.stdout.write(renderResultJson(result) + "\n");
      return;
    }

    process.stdout.write(renderResultMarkdown(result) + "\n");
  } catch (err) {
    const result = failedResult({
      command: "example",
      taskId,
      error: err instanceof Error ? err.message : String(err),
      recoverySteps: ["Retry the command", "Check task state"],
      nextCommands: getValidNextCommands("example", "failed"),
    });

    if (opts.json) {
      process.stdout.write(renderResultJson(result) + "\n");
      return;
    }

    process.stdout.write(renderResultMarkdown(result) + "\n");
  }
}
```

> **Prefer `emitResult`** over raw `process.stdout.write(renderResult...)`. It is a drop-in (`emitResult(result, json)`) that renders identically AND pushes the typed result into an optional module-level sink, so in-process callers (the MCP bridge) can capture the structured result without parsing stdout (TF-EMBED-02).

## Result Sink & MCP Typed Bridge (TF-EMBED-02)

`src/core/command-result.ts` exposes a module-level result sink:

- `setResultSink(sink | null)` — install/clear a sink; returns the previous one.
- `emitResult(result, json)` — drop-in for `writeResult`: pushes to the sink (if installed), then renders + `console.log`s the output.

The MCP server (`src/commands/mcp.ts`) uses this to run CLI command functions in-process and receive their typed `TaskForgeCommandResult` via `runCommandForResult()` (`src/core/mcp-contract.ts`):

1. Install a sink that captures the result.
2. Silence `process.stdout` (blackhole) for the duration of the command — commands emit progress via `console.log`, which would otherwise corrupt the stdio JSON-RPC transport. stderr is left intact.
3. `await` the command function (called with `json: true` so it emits `failedResult` instead of throwing).
4. Restore stdout + clear the sink. If the command threw without emitting, synthesise a `COMMAND_THREW`/`NO_RESULT_EMIT` failed result.

This satisfies the contract invariant **`mcp_result → structured(schema=CommandResult) ∧ ¬ parse(ANSI_stdout)`**: the client always receives typed `structuredContent`, never a string scrape. Mutating tools (`claim`/`block`/`complete`) reuse the real CLI core, so authority, doctor-lock, transaction, audit, and validation invariants are preserved — no mutation logic is duplicated.
