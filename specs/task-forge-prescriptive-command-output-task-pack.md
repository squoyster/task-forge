# TaskForge Prescriptive Command Output Task Pack

> Status: Historical task pack. The current command envelope is `TaskForgeCommandResult` with `validNextCommands` and optional structured `data`; see `docs/architecture/command-return-contract.md` and `docs/workflow.md`. Examples using `nextAction.kind`, `done --force`, or raw force cleanup are retained as historical planning material, not current agent instructions.

## Purpose

TaskForge command output must become the process authority for agentic development.

Agents should not infer what to do next after running a command. Every agent-facing command must return a deterministic, machine-readable outcome with:

- current command state
- whether the command succeeded
- the exact next action
- allowed commands
- forbidden commands
- whether the agent must stop
- whether human intervention is required
- structured problem details on failure

This task pack defines the implementation work needed to cover the command surface, including edge cases.

## Design principles

1. **One command invocation emits exactly one JSON document** when `--json` is used.
2. **Human and JSON outputs must agree**. Human output may be formatted, but must include the same next-action instruction.
3. **No agent-facing failure should recommend force/override as the default path.**
4. **Force/override is human/doctor-only unless explicitly configured.**
5. **Every command must map all known outcomes to a stable `state` and `nextAction.kind`.**
6. **The CLI is the workflow authority; the model is only an executor.**
7. **Provider-specific instructions must be behind providers/adapters.**
8. **Unsafe, ambiguous, or credential-dependent cases must stop the agent.**
9. **Validation must be automated through a schema and test matrix.**
10. **Edge cases are not exceptional prose; they are named command states.**

## Reference standards

Use JSON Schema to define and validate the command output contract. JSON Schema object validation supports named properties, required properties, and rejection of additional properties, which fits a stable command-response API.

Use a Problem Details-like structure for command failures. The RFC 9457 model standardizes machine-readable problem records with stable type/code/title/detail semantics. TaskForge is not exposing HTTP here, but the shape is still useful for CLI/API consistency.

---

# Global response contract

## TASK-PRESCRIPTIVE-001 — Add canonical command outcome schema

**Priority:** P0  
**Type:** Architecture / Safety  
**Command scope:** All commands

### Goal

Replace ad hoc JSON output with a uniform prescriptive result contract.

### Acceptance criteria

- [ ] Add `CommandOutcome` type.
- [ ] Add `NextAction` type.
- [ ] Add `ProblemDetail` type.
- [ ] All `--json` commands emit exactly one JSON document.
- [ ] All outcomes include `ok`, `command`, `state`, `nextAction`, and `timestamp`.
- [ ] Failures include `problem`.
- [ ] `nextAction.kind` is an enum, not free text.
- [ ] Human output includes the same `nextAction.instruction`.
- [ ] Add JSON Schema file: `schemas/taskforge-command-outcome.schema.json`.
- [ ] Add tests that validate every command’s JSON output against the schema.
- [ ] Add a command-state registry that lists every valid `state` and its owning command.
- [ ] Add a next-action registry that lists every valid `nextAction.kind`.

### Canonical success template

```json
{
  "ok": true,
  "command": "taskforge <command>",
  "state": "STATE_ENUM",
  "taskId": "TASK-123",
  "timestamp": "2026-05-23T00:00:00.000Z",
  "data": {},
  "problem": null,
  "nextAction": {
    "kind": "NEXT_ACTION_ENUM",
    "instruction": "Specific instruction for the agent.",
    "stop": false,
    "allowedCommands": [],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

### Canonical failure template

```json
{
  "ok": false,
  "command": "taskforge <command>",
  "state": "ERROR_STATE_ENUM",
  "taskId": "TASK-123",
  "timestamp": "2026-05-23T00:00:00.000Z",
  "data": {},
  "problem": {
    "type": "taskforge.problem/GATES_FAILED",
    "title": "Verification gates failed",
    "detail": "One or more configured gates failed.",
    "code": "GATES_FAILED",
    "severity": "error"
  },
  "nextAction": {
    "kind": "FIX_CURRENT_TASK",
    "instruction": "Do not mark the task done. Fix the failing gate, checkpoint the fix, then rerun taskforge gates --json.",
    "stop": false,
    "allowedCommands": [
      "taskforge gates --json",
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge block TASK-123 <reason>"
    ],
    "forbiddenCommands": [
      "taskforge done TASK-123 --force"
    ],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-002 — Implement shared outcome builder and renderer

**Priority:** P0  
**Type:** Refactor  
**Command scope:** All commands

### Goal

Prevent command authors from hand-building inconsistent results.

### Acceptance criteria

- [ ] Add `src/core/command-outcome.ts`.
- [ ] Add `outcomeOk(...)`.
- [ ] Add `outcomeProblem(...)`.
- [ ] Add `nextAction(...)`.
- [ ] Add `problemDetail(...)`.
- [ ] Add `printOutcome(outcome)`.
- [ ] Add `renderHumanOutcome(outcome)`.
- [ ] Remove direct use of `jsonOk`, `jsonError`, and raw `console.log(JSON.stringify(...))` from commands.
- [ ] Add test ensuring no command emits more than one JSON object.
- [ ] Add snapshot tests for representative human output.
- [ ] Add helper to suppress nested command output when one command internally calls another command.

### Required TypeScript shape

```ts
export type NextActionKind =
  | "NO_ACTION"
  | "SELECT_NEXT_TASK"
  | "ENTER_WORKTREE_AND_IMPLEMENT"
  | "CONTINUE_CURRENT_TASK"
  | "FIX_CURRENT_TASK"
  | "CREATE_BUG_TASK_AND_CONTINUE"
  | "BLOCK_FOR_HUMAN"
  | "STOP_DOCTOR_LOCKED"
  | "RELEASE_OR_RESUME_EXISTING_TASK"
  | "RUN_GATES"
  | "CHECKPOINT_CHANGES"
  | "SUBMIT_FOR_REVIEW"
  | "CREATE_OR_UPDATE_PR"
  | "MANUAL_PR_REQUIRED"
  | "REVIEW_TASK"
  | "REPAIR_TASK_STATE"
  | "RUN_DOCTOR"
  | "RETRY_AFTER_SYNC"
  | "CONFIGURE_PROVIDER"
  | "INSTALL_OR_REPAIR_INTEGRATION"
  | "ABORT_UNSAFE_OPERATION";

export interface NextAction {
  kind: NextActionKind;
  instruction: string;
  stop: boolean;
  allowedCommands: string[];
  forbiddenCommands: string[];
  requiresHuman: boolean;
  createTask?: {
    type: "Bug" | "Chore" | "Documentation" | "Feature";
    title: string;
    priority: "P0" | "P1" | "P2" | "P3";
    reason: string;
  } | null;
}

export interface ProblemDetail {
  type: string;
  title: string;
  detail: string;
  code: string;
  severity: "info" | "warn" | "error" | "fatal";
}

export interface CommandOutcome<T = unknown> {
  ok: boolean;
  command: string;
  state: string;
  taskId?: string;
  timestamp: string;
  data: T;
  problem: ProblemDetail | null;
  nextAction: NextAction;
}
```

---

## TASK-PRESCRIPTIVE-003 — Add command outcome schema validation tests

**Priority:** P0  
**Type:** Test Infrastructure

### Goal

Ensure all command outputs conform to the canonical schema and do not regress.

### Acceptance criteria

- [ ] Add schema validation test helper.
- [ ] Add fixture tests for each command.
- [ ] Add edge-case tests for each command state listed in this file.
- [ ] Every command with `--json` is tested for exactly one valid JSON object.
- [ ] Every failure case includes non-null `problem`.
- [ ] Every outcome includes non-empty `nextAction.instruction`.
- [ ] Every outcome includes `allowedCommands`, even when empty.
- [ ] Every outcome includes `forbiddenCommands`, even when empty.
- [ ] No normal implementer path includes `--force` in `allowedCommands`.
- [ ] `--force` is only allowed under explicit human/doctor override states.

---

# Command-specific tasks

## TASK-PRESCRIPTIVE-010 — `init`

**Priority:** P1  
**Type:** Command Output

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| Init succeeded | `INIT_COMPLETE` | `SELECT_NEXT_TASK` | false |
| Dry run plan | `INIT_PLAN_READY` | `INSTALL_OR_REPAIR_INTEGRATION` | false |
| Unknown agent framework | `UNKNOWN_AGENT_FRAMEWORK` | `CONFIGURE_PROVIDER` | true |
| Not a git repo | `NOT_A_GIT_REPO` | `ABORT_UNSAFE_OPERATION` | true |
| Task-state setup failed | `TASK_STATE_INIT_FAILED` | `RUN_DOCTOR` | true |
| Config write failed | `CONFIG_WRITE_FAILED` | `RUN_DOCTOR` | true |
| Provider files repaired | `INTEGRATION_REPAIRED` | `RUN_DOCTOR` | false |
| Existing config preserved | `INIT_CONFIG_EXISTS` | `SELECT_NEXT_TASK` | false |
| Agent framework disabled | `INIT_WITHOUT_AGENT_FRAMEWORK` | `SELECT_NEXT_TASK` | false |
| Partial init | `INIT_PARTIAL` | `RUN_DOCTOR` | true |

### Success template

```json
{
  "ok": true,
  "command": "taskforge init",
  "state": "INIT_COMPLETE",
  "data": {
    "taskState": "../task-state",
    "agentFramework": "opencode",
    "policy": "managed",
    "audit": true,
    "guard": true
  },
  "problem": null,
  "nextAction": {
    "kind": "SELECT_NEXT_TASK",
    "instruction": "Run taskforge next --json to select the next safe task.",
    "stop": false,
    "allowedCommands": ["taskforge next --json"],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

### Error template: unknown framework

```json
{
  "ok": false,
  "command": "taskforge init --agent-framework bad",
  "state": "UNKNOWN_AGENT_FRAMEWORK",
  "data": {
    "requestedFramework": "bad",
    "availableFrameworks": ["generic", "opencode"]
  },
  "problem": {
    "type": "taskforge.problem/UNKNOWN_AGENT_FRAMEWORK",
    "title": "Unknown agent framework",
    "detail": "The requested agent framework is not registered.",
    "code": "UNKNOWN_AGENT_FRAMEWORK",
    "severity": "error"
  },
  "nextAction": {
    "kind": "CONFIGURE_PROVIDER",
    "instruction": "Choose a registered agent framework or install a provider extension. Do not continue initialization with an unknown framework.",
    "stop": true,
    "allowedCommands": ["taskforge init --agent-framework generic --json", "taskforge init --agent-framework opencode --json"],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-011 — `next`

**Priority:** P0  
**Type:** Command Output

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| Ready task found | `NEXT_TASK_FOUND` | `ENTER_WORKTREE_AND_IMPLEMENT` | false |
| No ready task | `NO_READY_TASKS` | `NO_ACTION` | false |
| Only blocked tasks | `ONLY_BLOCKED_TASKS` | `BLOCK_FOR_HUMAN` | true |
| Doctor lock active | `DOCTOR_LOCKED` | `STOP_DOCTOR_LOCKED` | true |
| Task-state sync failed | `TASK_STATE_SYNC_FAILED` | `RETRY_AFTER_SYNC` | false |
| Task-state invalid | `TASK_STATE_INVALID` | `REPAIR_TASK_STATE` | true |
| Existing owned task found | `ACTIVE_TASK_PRESENT` | `CONTINUE_CURRENT_TASK` | false |
| Review task found for reviewer role | `REVIEW_TASK_FOUND` | `REVIEW_TASK` | false |
| Human-only task selected | `HUMAN_INTERVENTION_REQUIRED` | `BLOCK_FOR_HUMAN` | true |

### Ready task template

```json
{
  "ok": true,
  "command": "taskforge next",
  "state": "NEXT_TASK_FOUND",
  "taskId": "TASK-123",
  "data": {
    "priority": "P0",
    "title": "Add prescriptive command output"
  },
  "problem": null,
  "nextAction": {
    "kind": "ENTER_WORKTREE_AND_IMPLEMENT",
    "instruction": "Start TASK-123 with taskforge start TASK-123 --json, then work only in the assigned worktree.",
    "stop": false,
    "allowedCommands": ["taskforge start TASK-123 --json"],
    "forbiddenCommands": ["git worktree add", "git checkout main"],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-012 — `start`

**Priority:** P0  
**Type:** Command Output

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| Started | `TASK_STARTED` | `ENTER_WORKTREE_AND_IMPLEMENT` | false |
| Already owned by current session | `TASK_ALREADY_STARTED` | `CONTINUE_CURRENT_TASK` | false |
| Owned by another session | `TASK_OWNED_BY_OTHER_SESSION` | `RELEASE_OR_RESUME_EXISTING_TASK` | true |
| Outstanding task exists | `OUTSTANDING_TASK_EXISTS` | `RELEASE_OR_RESUME_EXISTING_TASK` | true |
| Invalid status | `INVALID_TASK_STATUS` | `SELECT_NEXT_TASK` | false |
| Doctor lock | `DOCTOR_LOCKED` | `STOP_DOCTOR_LOCKED` | true |
| Claim push failed | `CLAIM_PUSH_FAILED` | `RETRY_AFTER_SYNC` | false |
| Worktree creation failed | `WORKTREE_CREATE_FAILED` | `RUN_DOCTOR` | true |
| Task not found | `TASK_NOT_FOUND` | `SELECT_NEXT_TASK` | false |
| Context hash stale | `CONTEXT_STALE` | `RETRY_AFTER_SYNC` | false |
| Control files changed before start | `CONTROL_FILES_CHANGED` | `RUN_DOCTOR` | true |

### Started template

```json
{
  "ok": true,
  "command": "taskforge start TASK-123",
  "state": "TASK_STARTED",
  "taskId": "TASK-123",
  "data": {
    "worktree": "../worktrees/task-forge/TASK-123",
    "branch": "agent/TASK-123-example",
    "sessionId": "abc123"
  },
  "problem": null,
  "nextAction": {
    "kind": "ENTER_WORKTREE_AND_IMPLEMENT",
    "instruction": "cd into the worktree, read TASKFORGE.md, AGENTS.md, and the task file, then implement only TASK-123.",
    "stop": false,
    "allowedCommands": [
      "cd ../worktrees/task-forge/TASK-123",
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge gates --json",
      "taskforge block TASK-123 <reason>",
      "taskforge done TASK-123 --json"
    ],
    "forbiddenCommands": [
      "git checkout main",
      "git push --force",
      "edit ../task-state/**"
    ],
    "requiresHuman": false,
    "createTask": null
  }
}
```

### Owned by another session template

```json
{
  "ok": false,
  "command": "taskforge start TASK-123",
  "state": "TASK_OWNED_BY_OTHER_SESSION",
  "taskId": "TASK-123",
  "data": {
    "assignee": "session-xyz",
    "claimedAt": "2026-05-23T00:00:00.000Z"
  },
  "problem": {
    "type": "taskforge.problem/TASK_OWNED_BY_OTHER_SESSION",
    "title": "Task is owned by another session",
    "detail": "The task has an active claim from another session.",
    "code": "TASK_OWNED_BY_OTHER_SESSION",
    "severity": "error"
  },
  "nextAction": {
    "kind": "RELEASE_OR_RESUME_EXISTING_TASK",
    "instruction": "Do not override the claim. Select another task, or ask a human/doctor process to release the stale claim if it is confirmed stale.",
    "stop": true,
    "allowedCommands": ["taskforge next --json", "taskforge status --json"],
    "forbiddenCommands": ["taskforge start TASK-123 --force"],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-013 — `status` and `summary`

**Priority:** P1  
**Type:** Command Output

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| Active owned task | `ACTIVE_TASK_PRESENT` | `CONTINUE_CURRENT_TASK` | false |
| Ready tasks available | `READY_TASKS_AVAILABLE` | `SELECT_NEXT_TASK` | false |
| Review tasks available | `REVIEW_REQUIRED` | `REVIEW_TASK` | false |
| Doctor lock | `DOCTOR_LOCKED` | `STOP_DOCTOR_LOCKED` | true |
| No actionable tasks | `NO_ACTIONABLE_TASKS` | `NO_ACTION` | false |
| Task-state invalid | `TASK_STATE_INVALID` | `REPAIR_TASK_STATE` | true |
| Blocked tasks dominate | `BLOCKED_TASKS_PRESENT` | `BLOCK_FOR_HUMAN` | false |

### Template

```json
{
  "ok": true,
  "command": "taskforge status",
  "state": "READY_TASKS_AVAILABLE",
  "data": {
    "ready": 4,
    "inProgress": 1,
    "blocked": 2
  },
  "problem": null,
  "nextAction": {
    "kind": "SELECT_NEXT_TASK",
    "instruction": "Run taskforge next --json and start the recommended task.",
    "stop": false,
    "allowedCommands": ["taskforge next --json"],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-014 — `gates`

**Priority:** P0  
**Type:** Command Output / Safety

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| All gates passed | `GATES_PASSED` | `SUBMIT_FOR_REVIEW` | false |
| Typecheck failed | `TYPECHECK_FAILED` | `FIX_CURRENT_TASK` | false |
| Lint failed | `LINT_FAILED` | `FIX_CURRENT_TASK` | false |
| Build failed | `BUILD_FAILED` | `FIX_CURRENT_TASK` | false |
| Test failed | `TEST_FAILED` | `FIX_CURRENT_TASK` | false |
| Multiple gates failed | `GATES_FAILED` | `FIX_CURRENT_TASK` | false |
| Gate command missing | `GATE_COMMAND_MISSING` | `CREATE_BUG_TASK_AND_CONTINUE` | false |
| Gate config invalid | `GATE_CONFIG_INVALID` | `RUN_DOCTOR` | true |
| Unknown gate name | `UNKNOWN_GATE` | `RUN_GATES` | false |
| Timeout | `GATE_TIMEOUT` | `FIX_CURRENT_TASK` | false |
| Possible upstream failure | `POSSIBLE_UPSTREAM_GATE_FAILURE` | `CREATE_BUG_TASK_AND_CONTINUE` | false |
| No gates configured | `NO_GATES_CONFIGURED` | `RUN_DOCTOR` | true |

### Test failure template

```json
{
  "ok": false,
  "command": "taskforge gates",
  "state": "TEST_FAILED",
  "taskId": "TASK-123",
  "data": {
    "failedGates": ["test"],
    "allPassed": false
  },
  "problem": {
    "type": "taskforge.problem/TEST_FAILED",
    "title": "Test gate failed",
    "detail": "The test gate failed. The current task cannot be marked done.",
    "code": "TEST_FAILED",
    "severity": "error"
  },
  "nextAction": {
    "kind": "FIX_CURRENT_TASK",
    "instruction": "Fix the failing test in the current task worktree. Do not mark the task done. After the fix, run taskforge checkpoint and taskforge gates --json again.",
    "stop": false,
    "allowedCommands": [
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge gates --json",
      "taskforge block TASK-123 <reason>"
    ],
    "forbiddenCommands": [
      "taskforge done TASK-123 --force",
      "delete or skip tests without creating a bug task"
    ],
    "requiresHuman": false,
    "createTask": null
  }
}
```

### Possible upstream failure template

```json
{
  "ok": false,
  "command": "taskforge gates",
  "state": "POSSIBLE_UPSTREAM_GATE_FAILURE",
  "taskId": "TASK-123",
  "data": {
    "failedGates": ["test"],
    "changedFilesAppearUnrelated": true
  },
  "problem": {
    "type": "taskforge.problem/POSSIBLE_UPSTREAM_GATE_FAILURE",
    "title": "Possible upstream gate failure",
    "detail": "The gate failure may be unrelated to the current task changes.",
    "code": "POSSIBLE_UPSTREAM_GATE_FAILURE",
    "severity": "warn"
  },
  "nextAction": {
    "kind": "CREATE_BUG_TASK_AND_CONTINUE",
    "instruction": "Create a bug task describing the upstream gate failure. Continue current work only if the failed gate is unrelated and non-blocking.",
    "stop": false,
    "allowedCommands": [
      "taskforge new --type Bug --priority P1 --title <title>",
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge block TASK-123 <reason>"
    ],
    "forbiddenCommands": [
      "taskforge done TASK-123 --force"
    ],
    "requiresHuman": false,
    "createTask": {
      "type": "Bug",
      "title": "Investigate upstream gate failure",
      "priority": "P1",
      "reason": "A configured verification gate appears to fail independently of the current task changes."
    }
  }
}
```

---

## TASK-PRESCRIPTIVE-015 — `checkpoint`

**Priority:** P0  
**Type:** Command Output / Safety

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| Commit created | `CHECKPOINT_CREATED` | `RUN_GATES` | false |
| No changes | `NO_CHANGES_TO_CHECKPOINT` | `RUN_GATES` | false |
| Wrong owner/session | `OWNERSHIP_MISMATCH` | `BLOCK_FOR_HUMAN` | true |
| Unsafe branch | `UNSAFE_BRANCH` | `ABORT_UNSAFE_OPERATION` | true |
| Commit failed | `CHECKPOINT_FAILED` | `RUN_DOCTOR` | true |
| Worktree missing | `WORKTREE_MISSING` | `RUN_DOCTOR` | true |
| Pre-commit hook failed | `CHECKPOINT_HOOK_FAILED` | `FIX_CURRENT_TASK` | false |
| Index locked | `GIT_INDEX_LOCKED` | `RUN_DOCTOR` | true |

### Template

```json
{
  "ok": true,
  "command": "taskforge checkpoint TASK-123",
  "state": "CHECKPOINT_CREATED",
  "taskId": "TASK-123",
  "data": {
    "commit": "abc1234"
  },
  "problem": null,
  "nextAction": {
    "kind": "RUN_GATES",
    "instruction": "Run taskforge gates --json. If gates pass, submit for review. If gates fail, fix the failures.",
    "stop": false,
    "allowedCommands": ["taskforge gates --json"],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-016 — `done`

**Priority:** P0  
**Type:** Command Output / Safety

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| Done succeeded | `TASK_DONE` | `SELECT_NEXT_TASK` | false |
| Gates failed | `GATES_FAILED` | `FIX_CURRENT_TASK` | false |
| AC missing | `ACCEPTANCE_CRITERIA_MISSING` | `FIX_CURRENT_TASK` | false |
| AC blank | `ACCEPTANCE_CRITERIA_BLANK` | `FIX_CURRENT_TASK` | false |
| AC unchecked | `ACCEPTANCE_CRITERIA_INCOMPLETE` | `FIX_CURRENT_TASK` | false |
| Invalid transition | `INVALID_TRANSITION` | `RUN_DOCTOR` | true |
| Ownership mismatch | `OWNERSHIP_MISMATCH` | `BLOCK_FOR_HUMAN` | true |
| Context hash changed | `CONTEXT_CHANGED` | `REVIEW_TASK` | true |
| Forced override used | `DONE_WITH_OVERRIDE` | `REVIEW_TASK` | true |
| Cleanup failed | `CLEANUP_FAILED` | `RUN_DOCTOR` | true |
| Audit transcript missing | `AUDIT_TRANSCRIPT_MISSING` | `INSTALL_OR_REPAIR_INTEGRATION` | false |
| Multiple JSON risk | `NESTED_JSON_SUPPRESSED` | `NO_ACTION` | false |

### Gate failure template

```json
{
  "ok": false,
  "command": "taskforge done TASK-123",
  "state": "GATES_FAILED",
  "taskId": "TASK-123",
  "data": {
    "failedGates": ["test"]
  },
  "problem": {
    "type": "taskforge.problem/GATES_FAILED",
    "title": "Task cannot be marked Done",
    "detail": "Verification gates failed.",
    "code": "GATES_FAILED",
    "severity": "error"
  },
  "nextAction": {
    "kind": "FIX_CURRENT_TASK",
    "instruction": "Do not use --force. Fix the failed gates, checkpoint the fix, then rerun taskforge done TASK-123 --json.",
    "stop": false,
    "allowedCommands": [
      "taskforge gates --json",
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge done TASK-123 --json",
      "taskforge block TASK-123 <reason>"
    ],
    "forbiddenCommands": [
      "taskforge done TASK-123 --force"
    ],
    "requiresHuman": false,
    "createTask": null
  }
}
```

### AC incomplete template

```json
{
  "ok": false,
  "command": "taskforge done TASK-123",
  "state": "ACCEPTANCE_CRITERIA_INCOMPLETE",
  "taskId": "TASK-123",
  "data": {
    "uncheckedAcceptanceCriteria": [
      "Add schema validation tests"
    ]
  },
  "problem": {
    "type": "taskforge.problem/ACCEPTANCE_CRITERIA_INCOMPLETE",
    "title": "Acceptance criteria are incomplete",
    "detail": "The task cannot be marked Done while acceptance criteria remain unchecked.",
    "code": "ACCEPTANCE_CRITERIA_INCOMPLETE",
    "severity": "error"
  },
  "nextAction": {
    "kind": "FIX_CURRENT_TASK",
    "instruction": "Complete and check all acceptance criteria before marking the task done. If an AC is invalid, create a bug or clarification task instead of bypassing it.",
    "stop": false,
    "allowedCommands": [
      "taskforge inspect TASK-123 --json",
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge done TASK-123 --json",
      "taskforge block TASK-123 <reason>"
    ],
    "forbiddenCommands": [
      "taskforge done TASK-123 --force"
    ],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-017 — `block`, `release`, `unlock`, `reject`

**Priority:** P1  
**Type:** Command Output

### Covered cases

| Command | Case | State | nextAction.kind | Stop |
|---|---|---|---:|---:|
| `block` | Blocked for human | `TASK_BLOCKED` | `SELECT_NEXT_TASK` | false |
| `block` | Missing reason | `BLOCK_REASON_REQUIRED` | `BLOCK_FOR_HUMAN` | true |
| `block` | Unsafe category | `BLOCK_CATEGORY_INVALID` | `BLOCK_FOR_HUMAN` | true |
| `release` | Released | `TASK_RELEASED` | `SELECT_NEXT_TASK` | false |
| `release` | Not owner | `OWNERSHIP_MISMATCH` | `BLOCK_FOR_HUMAN` | true |
| `unlock` | Unlocked stale claim | `TASK_UNLOCKED` | `SELECT_NEXT_TASK` | false |
| `unlock` | Unsafe active owner | `UNLOCK_REQUIRES_HUMAN` | `BLOCK_FOR_HUMAN` | true |
| `reject` | Review rejected | `TASK_REJECTED` | `FIX_CURRENT_TASK` | false |
| `reject` | Not in review | `INVALID_REJECT_STATE` | `RUN_DOCTOR` | true |
| `reject` | Missing reason | `REJECT_REASON_REQUIRED` | `BLOCK_FOR_HUMAN` | true |

### Reject template

```json
{
  "ok": true,
  "command": "taskforge reject TASK-123",
  "state": "TASK_REJECTED",
  "taskId": "TASK-123",
  "data": {
    "reason": "Acceptance criteria not met"
  },
  "problem": null,
  "nextAction": {
    "kind": "FIX_CURRENT_TASK",
    "instruction": "Resume TASK-123, address the rejection reason, checkpoint changes, and rerun gates.",
    "stop": false,
    "allowedCommands": [
      "taskforge start TASK-123 --json",
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge gates --json"
    ],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-018 — `claim`, `heartbeat`, `sweep`

**Priority:** P1  
**Type:** Command Output

### Covered cases

| Command | Case | State | nextAction.kind | Stop |
|---|---|---|---:|---:|
| `claim` | Claimed | `TASK_CLAIMED` | `ENTER_WORKTREE_AND_IMPLEMENT` | false |
| `claim` | Already claimed | `TASK_OWNED_BY_OTHER_SESSION` | `RELEASE_OR_RESUME_EXISTING_TASK` | true |
| `claim` | Invalid status | `INVALID_TASK_STATUS` | `SELECT_NEXT_TASK` | false |
| `heartbeat` | Updated | `HEARTBEAT_UPDATED` | `CONTINUE_CURRENT_TASK` | false |
| `heartbeat` | No claim | `NO_ACTIVE_CLAIM` | `SELECT_NEXT_TASK` | false |
| `heartbeat` | Wrong session | `OWNERSHIP_MISMATCH` | `BLOCK_FOR_HUMAN` | true |
| `sweep` | Stale tasks reset | `STALE_TASKS_SWEPT` | `SELECT_NEXT_TASK` | false |
| `sweep` | Dirty stale worktree | `STALE_DIRTY_WORKTREE` | `REVIEW_TASK` | true |
| `sweep` | Dry run | `SWEEP_PLAN_READY` | `RUN_DOCTOR` | false |

### Heartbeat template

```json
{
  "ok": true,
  "command": "taskforge heartbeat TASK-123",
  "state": "HEARTBEAT_UPDATED",
  "taskId": "TASK-123",
  "data": {
    "sessionId": "abc123"
  },
  "problem": null,
  "nextAction": {
    "kind": "CONTINUE_CURRENT_TASK",
    "instruction": "Continue work on TASK-123. Checkpoint meaningful changes before running gates.",
    "stop": false,
    "allowedCommands": [
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge gates --json"
    ],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-019 — `inspect`, `report`, `list`

**Priority:** P2  
**Type:** Command Output

### Covered cases

| Command | Case | State | nextAction.kind | Stop |
|---|---|---|---:|---:|
| `inspect` | Dirty worktree | `TASK_DIRTY` | `CHECKPOINT_CHANGES` | false |
| `inspect` | Clean worktree | `TASK_CLEAN` | `RUN_GATES` | false |
| `inspect` | Has commits | `TASK_HAS_COMMITS` | `RUN_GATES` | false |
| `inspect` | Missing worktree | `WORKTREE_MISSING` | `RUN_DOCTOR` | true |
| `inspect` | Task not found | `TASK_NOT_FOUND` | `SELECT_NEXT_TASK` | false |
| `report` | Report generated | `REPORT_READY` | `NO_ACTION` | false |
| `report` | Report failed | `REPORT_FAILED` | `RUN_DOCTOR` | true |
| `list` | Tasks listed | `TASK_LIST_READY` | `SELECT_NEXT_TASK` | false |
| `list` | Filter empty | `NO_MATCHING_TASKS` | `NO_ACTION` | false |

### Inspect template

```json
{
  "ok": true,
  "command": "taskforge inspect TASK-123",
  "state": "TASK_DIRTY",
  "taskId": "TASK-123",
  "data": {
    "modifiedFiles": 3,
    "untrackedFiles": 1
  },
  "problem": null,
  "nextAction": {
    "kind": "CHECKPOINT_CHANGES",
    "instruction": "The worktree has uncommitted changes. Create a checkpoint before running gates or ending the session.",
    "stop": false,
    "allowedCommands": [
      "taskforge diff TASK-123",
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge gates --json"
    ],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-020 — `diff`, `submit`, `pr`

**Priority:** P1  
**Type:** Command Output / Provider Boundary

### Covered cases

| Command | Case | State | nextAction.kind | Stop |
|---|---|---|---:|---:|
| `diff` | Diff shown | `DIFF_READY` | `CHECKPOINT_CHANGES` | false |
| `diff` | No changes | `NO_DIFF` | `RUN_GATES` | false |
| `diff` | Wrong owner | `OWNERSHIP_MISMATCH` | `BLOCK_FOR_HUMAN` | true |
| `submit` | Pushed | `BRANCH_SUBMITTED` | `CREATE_OR_UPDATE_PR` | false |
| `submit` | Push rejected | `PUSH_REJECTED` | `RETRY_AFTER_SYNC` | false |
| `submit` | Unsafe branch | `UNSAFE_BRANCH` | `ABORT_UNSAFE_OPERATION` | true |
| `submit` | No commits | `NO_COMMITS_TO_SUBMIT` | `CHECKPOINT_CHANGES` | false |
| `pr` | PR created | `PR_READY` | `REVIEW_TASK` | false |
| `pr` | PR updated | `PR_UPDATED` | `REVIEW_TASK` | false |
| `pr` | Provider unavailable | `PR_PROVIDER_UNAVAILABLE` | `MANUAL_PR_REQUIRED` | true |
| `pr` | Auth missing | `PROVIDER_AUTH_MISSING` | `BLOCK_FOR_HUMAN` | true |
| `pr` | Provider conflict | `PR_PROVIDER_CONFLICT` | `RETRY_AFTER_SYNC` | false |

### Provider unavailable template

```json
{
  "ok": false,
  "command": "taskforge pr TASK-123",
  "state": "PR_PROVIDER_UNAVAILABLE",
  "taskId": "TASK-123",
  "data": {
    "configuredProvider": null
  },
  "problem": {
    "type": "taskforge.problem/PR_PROVIDER_UNAVAILABLE",
    "title": "No pull request provider configured",
    "detail": "TaskForge cannot create a PR because no PR provider is configured.",
    "code": "PR_PROVIDER_UNAVAILABLE",
    "severity": "warn"
  },
  "nextAction": {
    "kind": "MANUAL_PR_REQUIRED",
    "instruction": "Create a pull request manually from the task branch, or configure a PR provider and rerun this command.",
    "stop": true,
    "allowedCommands": [
      "taskforge config validate --json",
      "taskforge submit TASK-123 --json"
    ],
    "forbiddenCommands": ["gh pr create"],
    "requiresHuman": true,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-021 — `doctor`, `config-validate`, `validate-state`

**Priority:** P0  
**Type:** Command Output / Safety

### Covered cases

| Command | Case | State | nextAction.kind | Stop |
|---|---|---|---:|---:|
| `doctor` | Healthy | `DOCTOR_OK` | `SELECT_NEXT_TASK` | false |
| `doctor` | Issues found | `DOCTOR_ISSUES_FOUND` | `RUN_DOCTOR` | true |
| `doctor --fix` | Fixed | `DOCTOR_FIXED_ISSUES` | `RUN_DOCTOR` | false |
| `doctor --fix` | Manual repair needed | `DOCTOR_MANUAL_REPAIR_REQUIRED` | `BLOCK_FOR_HUMAN` | true |
| `doctor` | Lock active | `DOCTOR_LOCKED` | `STOP_DOCTOR_LOCKED` | true |
| `config-validate` | Valid | `CONFIG_VALID` | `SELECT_NEXT_TASK` | false |
| `config-validate` | Invalid | `CONFIG_INVALID` | `CONFIGURE_PROVIDER` | true |
| `config-validate` | Provider invalid | `PROVIDER_CONFIG_INVALID` | `CONFIGURE_PROVIDER` | true |
| `validate-state` | Valid | `TASK_STATE_VALID` | `SELECT_NEXT_TASK` | false |
| `validate-state` | Invalid | `TASK_STATE_INVALID` | `REPAIR_TASK_STATE` | true |
| `validate-state` | Done with blank ACs | `DONE_TASK_HAS_INVALID_ACS` | `REPAIR_TASK_STATE` | true |
| `validate-state` | Duplicate task IDs | `DUPLICATE_TASK_IDS` | `REPAIR_TASK_STATE` | true |

### Validate-state failure template

```json
{
  "ok": false,
  "command": "taskforge validate-state",
  "state": "TASK_STATE_INVALID",
  "data": {
    "violations": [
      {
        "taskId": "TASK-074",
        "code": "DONE_TASK_HAS_INVALID_ACS"
      }
    ]
  },
  "problem": {
    "type": "taskforge.problem/TASK_STATE_INVALID",
    "title": "Task state violates invariants",
    "detail": "One or more Done tasks have blank or unchecked acceptance criteria.",
    "code": "TASK_STATE_INVALID",
    "severity": "error"
  },
  "nextAction": {
    "kind": "REPAIR_TASK_STATE",
    "instruction": "Do not continue normal implementation. Create or run a repair task to fix task-state invariants, then rerun taskforge validate-state --json.",
    "stop": true,
    "allowedCommands": [
      "taskforge doctor --json",
      "taskforge doctor --fix --json",
      "taskforge validate-state --json"
    ],
    "forbiddenCommands": [
      "taskforge done <TASK-ID> --force"
    ],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-022 — `new`, `prompt`, `resume`

**Priority:** P1  
**Type:** Command Output

### Covered cases

| Command | Case | State | nextAction.kind | Stop |
|---|---|---|---:|---:|
| `new` | Task created | `TASK_CREATED` | `SELECT_NEXT_TASK` | false |
| `new` | Missing ACs | `TASK_SPEC_INCOMPLETE` | `FIX_CURRENT_TASK` | false |
| `new` | Duplicate ID | `TASK_ID_CONFLICT` | `REPAIR_TASK_STATE` | true |
| `new` | Write failed | `TASK_CREATE_FAILED` | `RUN_DOCTOR` | true |
| `prompt` | Prompt emitted | `PROMPT_READY` | `CONTINUE_CURRENT_TASK` | false |
| `prompt` | Task missing | `TASK_NOT_FOUND` | `SELECT_NEXT_TASK` | false |
| `prompt` | Missing context | `PROMPT_CONTEXT_INCOMPLETE` | `RUN_DOCTOR` | true |
| `resume` | Resumed task | `TASK_RESUMED` | `CONTINUE_CURRENT_TASK` | false |
| `resume` | Nothing to resume | `NO_RESUMABLE_TASK` | `SELECT_NEXT_TASK` | false |
| `resume` | Multiple resumable tasks | `MULTIPLE_RESUMABLE_TASKS` | `SELECT_NEXT_TASK` | false |

### New task template

```json
{
  "ok": true,
  "command": "taskforge new",
  "state": "TASK_CREATED",
  "taskId": "TASK-124",
  "data": {
    "type": "Bug",
    "priority": "P1"
  },
  "problem": null,
  "nextAction": {
    "kind": "SELECT_NEXT_TASK",
    "instruction": "Task TASK-124 was created. Run taskforge next --json to select the next safe task; do not assume the new task should start immediately unless it is highest priority and unblocked.",
    "stop": false,
    "allowedCommands": ["taskforge next --json"],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-023 — `sync`

**Priority:** P1  
**Type:** Command Output / Provider Boundary

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| Sync complete | `SYNC_COMPLETE` | `SELECT_NEXT_TASK` | false |
| Provider disabled | `PROVIDER_DISABLED` | `CONFIGURE_PROVIDER` | false |
| Provider auth missing | `PROVIDER_AUTH_MISSING` | `BLOCK_FOR_HUMAN` | true |
| Provider unavailable | `PROVIDER_UNAVAILABLE` | `CONFIGURE_PROVIDER` | true |
| Partial sync | `SYNC_PARTIAL` | `RETRY_AFTER_SYNC` | false |
| Conflict | `SYNC_CONFLICT` | `BLOCK_FOR_HUMAN` | true |
| Rate limited | `PROVIDER_RATE_LIMITED` | `RETRY_AFTER_SYNC` | false |
| Remote object missing | `REMOTE_OBJECT_MISSING` | `CONFIGURE_PROVIDER` | false |
| Local task invalid | `LOCAL_TASK_INVALID` | `REPAIR_TASK_STATE` | true |

### Auth missing template

```json
{
  "ok": false,
  "command": "taskforge sync",
  "state": "PROVIDER_AUTH_MISSING",
  "data": {
    "provider": "github"
  },
  "problem": {
    "type": "taskforge.problem/PROVIDER_AUTH_MISSING",
    "title": "Provider authentication missing",
    "detail": "GitHub sync is enabled but no usable token is available.",
    "code": "PROVIDER_AUTH_MISSING",
    "severity": "error"
  },
  "nextAction": {
    "kind": "BLOCK_FOR_HUMAN",
    "instruction": "Stop. Provider authentication requires human configuration. Do not attempt to create or guess credentials.",
    "stop": true,
    "allowedCommands": [
      "taskforge config validate --json"
    ],
    "forbiddenCommands": [],
    "requiresHuman": true,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-024 — `audit`, `transcript`, `timeline`

**Priority:** P1  
**Type:** Command Output / Auditability

### Covered cases

| Command | Case | State | nextAction.kind | Stop |
|---|---|---|---:|---:|
| `audit` | Events found | `AUDIT_READY` | `NO_ACTION` | false |
| `audit` | No events | `AUDIT_EMPTY` | `INSTALL_OR_REPAIR_INTEGRATION` | false |
| `audit` | Corrupt JSONL | `AUDIT_CORRUPT` | `RUN_DOCTOR` | true |
| `audit` | Missing dir | `AUDIT_STORE_MISSING` | `INSTALL_OR_REPAIR_INTEGRATION` | false |
| `transcript` | Transcript found | `TRANSCRIPT_READY` | `NO_ACTION` | false |
| `transcript` | Missing transcript | `TRANSCRIPT_MISSING` | `INSTALL_OR_REPAIR_INTEGRATION` | false |
| `transcript` | Corrupt transcript | `TRANSCRIPT_CORRUPT` | `RUN_DOCTOR` | true |
| `timeline` | Timeline generated | `TIMELINE_READY` | `NO_ACTION` | false |
| `timeline` | Empty timeline | `TIMELINE_EMPTY` | `INSTALL_OR_REPAIR_INTEGRATION` | false |

### Missing transcript template

```json
{
  "ok": false,
  "command": "taskforge transcript TASK-123",
  "state": "TRANSCRIPT_MISSING",
  "taskId": "TASK-123",
  "data": {},
  "problem": {
    "type": "taskforge.problem/TRANSCRIPT_MISSING",
    "title": "No transcript found",
    "detail": "No per-task agentic transcript exists for this task.",
    "code": "TRANSCRIPT_MISSING",
    "severity": "warn"
  },
  "nextAction": {
    "kind": "INSTALL_OR_REPAIR_INTEGRATION",
    "instruction": "Run taskforge doctor --fix --json to repair audit integration. Do not treat this task as fully auditable until transcript capture is restored.",
    "stop": false,
    "allowedCommands": [
      "taskforge doctor --fix --json",
      "taskforge audit TASK-123 --json"
    ],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-025 — Dependency steward commands

**Priority:** P2  
**Type:** Command Output / Plugin Boundary  
**Commands:** `deps scan`, `deps audit`, `deps outdated`, `deps deprecated`, `deps plan`, `deps create-tasks`, `deps pr`, `deps summary`

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| Findings found | `DEPENDENCY_FINDINGS_FOUND` | `CREATE_BUG_TASK_AND_CONTINUE` | false |
| No findings | `DEPENDENCIES_OK` | `SELECT_NEXT_TASK` | false |
| Tool missing | `DEPENDENCY_TOOL_MISSING` | `CONFIGURE_PROVIDER` | false |
| Critical vulnerability | `CRITICAL_DEPENDENCY_FINDING` | `BLOCK_FOR_HUMAN` | true |
| Plan created | `DEPENDENCY_PLAN_READY` | `REVIEW_TASK` | false |
| Tasks created | `DEPENDENCY_TASKS_CREATED` | `SELECT_NEXT_TASK` | false |
| PR created | `DEPENDENCY_PR_READY` | `REVIEW_TASK` | false |
| Package manager unavailable | `PACKAGE_MANAGER_UNAVAILABLE` | `CONFIGURE_PROVIDER` | true |
| Lockfile changed unexpectedly | `LOCKFILE_UNEXPECTED_CHANGE` | `BLOCK_FOR_HUMAN` | true |

### Findings template

```json
{
  "ok": true,
  "command": "taskforge deps scan",
  "state": "DEPENDENCY_FINDINGS_FOUND",
  "data": {
    "findings": 3,
    "critical": 0
  },
  "problem": null,
  "nextAction": {
    "kind": "CREATE_BUG_TASK_AND_CONTINUE",
    "instruction": "Create dependency maintenance tasks for the findings. Continue the current implementation only if the findings do not block current work.",
    "stop": false,
    "allowedCommands": [
      "taskforge deps create-tasks --json",
      "taskforge next --json"
    ],
    "forbiddenCommands": [],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

## TASK-PRESCRIPTIVE-026 — `cleanup`

**Priority:** P1  
**Type:** Command Output / Safety

### Covered cases

| Case | State | nextAction.kind | Stop |
|---|---|---:|---:|
| Cleanup complete | `CLEANUP_COMPLETE` | `SELECT_NEXT_TASK` | false |
| Dirty worktree | `CLEANUP_BLOCKED_DIRTY_WORKTREE` | `CHECKPOINT_CHANGES` | true |
| Branch delete failed | `CLEANUP_BRANCH_DELETE_FAILED` | `RUN_DOCTOR` | true |
| Missing worktree | `CLEANUP_NOTHING_TO_DO` | `SELECT_NEXT_TASK` | false |
| Task not done | `CLEANUP_TASK_NOT_DONE` | `CONTINUE_CURRENT_TASK` | false |
| Ownership mismatch | `OWNERSHIP_MISMATCH` | `BLOCK_FOR_HUMAN` | true |
| Git worktree remove failed | `WORKTREE_REMOVE_FAILED` | `RUN_DOCTOR` | true |

### Dirty worktree template

```json
{
  "ok": false,
  "command": "taskforge cleanup TASK-123",
  "state": "CLEANUP_BLOCKED_DIRTY_WORKTREE",
  "taskId": "TASK-123",
  "data": {
    "modifiedFiles": 2,
    "untrackedFiles": 1
  },
  "problem": {
    "type": "taskforge.problem/CLEANUP_BLOCKED_DIRTY_WORKTREE",
    "title": "Cleanup blocked by uncommitted changes",
    "detail": "The worktree contains modified or untracked files.",
    "code": "CLEANUP_BLOCKED_DIRTY_WORKTREE",
    "severity": "error"
  },
  "nextAction": {
    "kind": "CHECKPOINT_CHANGES",
    "instruction": "Inspect the diff. If changes are valid, checkpoint them. If not, request human review before deleting work.",
    "stop": true,
    "allowedCommands": [
      "taskforge diff TASK-123",
      "taskforge checkpoint TASK-123 --message <message>",
      "taskforge block TASK-123 <reason>"
    ],
    "forbiddenCommands": [
      "git worktree remove --force"
    ],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

# Cross-command edge case matrix

## TASK-PRESCRIPTIVE-030 — Add global edge-case outcome coverage

**Priority:** P0  
**Type:** Test / Safety

### Goal

Ensure all commands have deterministic prescriptive output for shared failures.

### Acceptance criteria

- [ ] Every command maps `TASK_NOT_FOUND` to a valid next action.
- [ ] Every command maps `DOCTOR_LOCKED` to `STOP_DOCTOR_LOCKED`.
- [ ] Every command maps `CONFIG_INVALID` to `CONFIGURE_PROVIDER` or `RUN_DOCTOR`.
- [ ] Every command maps `TASK_STATE_INVALID` to `REPAIR_TASK_STATE`.
- [ ] Every command maps provider auth failure to `BLOCK_FOR_HUMAN`.
- [ ] Every command maps git operation failure to `RUN_DOCTOR` or `RETRY_AFTER_SYNC`.
- [ ] Every command maps ownership mismatch to `BLOCK_FOR_HUMAN`.
- [ ] Every command maps unsafe branch to `ABORT_UNSAFE_OPERATION`.
- [ ] Every command maps unknown options/invalid inputs to a non-destructive next action.
- [ ] Tests assert no command suggests direct mutation of `../task-state/**`.

### Shared fallback templates

#### Doctor locked

```json
{
  "ok": false,
  "command": "taskforge <command>",
  "state": "DOCTOR_LOCKED",
  "data": {
    "reason": "TaskForge is in recovery mode."
  },
  "problem": {
    "type": "taskforge.problem/DOCTOR_LOCKED",
    "title": "Doctor lock active",
    "detail": "Normal agent work is paused until recovery completes.",
    "code": "DOCTOR_LOCKED",
    "severity": "error"
  },
  "nextAction": {
    "kind": "STOP_DOCTOR_LOCKED",
    "instruction": "Stop normal implementation. Run only doctor/recovery commands or wait for the recovery task to complete.",
    "stop": true,
    "allowedCommands": [
      "taskforge doctor --json",
      "taskforge validate-state --json"
    ],
    "forbiddenCommands": [
      "taskforge start <TASK-ID>",
      "taskforge done <TASK-ID> --force"
    ],
    "requiresHuman": false,
    "createTask": null
  }
}
```

#### Unsafe branch

```json
{
  "ok": false,
  "command": "taskforge <command>",
  "state": "UNSAFE_BRANCH",
  "data": {
    "branch": "main"
  },
  "problem": {
    "type": "taskforge.problem/UNSAFE_BRANCH",
    "title": "Unsafe branch for agent operation",
    "detail": "The command would modify a protected branch or task-state directly.",
    "code": "UNSAFE_BRANCH",
    "severity": "fatal"
  },
  "nextAction": {
    "kind": "ABORT_UNSAFE_OPERATION",
    "instruction": "Stop. Do not modify this branch. Start or resume the task through TaskForge to obtain a safe worktree.",
    "stop": true,
    "allowedCommands": [
      "taskforge next --json",
      "taskforge start <TASK-ID> --json",
      "taskforge doctor --json"
    ],
    "forbiddenCommands": [
      "git checkout main",
      "git push --force",
      "edit ../task-state/**"
    ],
    "requiresHuman": false,
    "createTask": null
  }
}
```

---

# Implementation sequencing

## Phase 1 — Safety contract

1. `TASK-PRESCRIPTIVE-001`
2. `TASK-PRESCRIPTIVE-002`
3. `TASK-PRESCRIPTIVE-003`
4. `TASK-PRESCRIPTIVE-030`

## Phase 2 — Lifecycle-critical commands

1. `TASK-PRESCRIPTIVE-011` — `next`
2. `TASK-PRESCRIPTIVE-012` — `start`
3. `TASK-PRESCRIPTIVE-014` — `gates`
4. `TASK-PRESCRIPTIVE-015` — `checkpoint`
5. `TASK-PRESCRIPTIVE-016` — `done`
6. `TASK-PRESCRIPTIVE-021` — `doctor`, `config-validate`, `validate-state`

## Phase 3 — Coordination and provider commands

1. `TASK-PRESCRIPTIVE-017`
2. `TASK-PRESCRIPTIVE-018`
3. `TASK-PRESCRIPTIVE-020`
4. `TASK-PRESCRIPTIVE-023`
5. `TASK-PRESCRIPTIVE-024`
6. `TASK-PRESCRIPTIVE-026`

## Phase 4 — Non-critical command output consistency

1. `TASK-PRESCRIPTIVE-010`
2. `TASK-PRESCRIPTIVE-013`
3. `TASK-PRESCRIPTIVE-019`
4. `TASK-PRESCRIPTIVE-022`
5. `TASK-PRESCRIPTIVE-025`

---

# Non-negotiable test matrix

Add tests equivalent to:

```ts
describe.each([
  ["next", "NEXT_TASK_FOUND", "ENTER_WORKTREE_AND_IMPLEMENT"],
  ["next", "NO_READY_TASKS", "NO_ACTION"],
  ["start", "TASK_STARTED", "ENTER_WORKTREE_AND_IMPLEMENT"],
  ["start", "DOCTOR_LOCKED", "STOP_DOCTOR_LOCKED"],
  ["start", "TASK_OWNED_BY_OTHER_SESSION", "RELEASE_OR_RESUME_EXISTING_TASK"],
  ["gates", "TEST_FAILED", "FIX_CURRENT_TASK"],
  ["gates", "GATES_PASSED", "SUBMIT_FOR_REVIEW"],
  ["done", "GATES_FAILED", "FIX_CURRENT_TASK"],
  ["done", "ACCEPTANCE_CRITERIA_INCOMPLETE", "FIX_CURRENT_TASK"],
  ["checkpoint", "CHECKPOINT_CREATED", "RUN_GATES"],
  ["submit", "BRANCH_SUBMITTED", "CREATE_OR_UPDATE_PR"],
  ["pr", "PR_PROVIDER_UNAVAILABLE", "MANUAL_PR_REQUIRED"],
  ["doctor", "DOCTOR_MANUAL_REPAIR_REQUIRED", "BLOCK_FOR_HUMAN"],
  ["validate-state", "TASK_STATE_INVALID", "REPAIR_TASK_STATE"],
  ["cleanup", "CLEANUP_BLOCKED_DIRTY_WORKTREE", "CHECKPOINT_CHANGES"]
])(...)
```

Every command must prove:

- exactly one JSON object
- valid schema
- stable `state`
- stable `nextAction.kind`
- clear instruction
- no unsafe command in `allowedCommands`
- no force/override suggested to normal implementer agents
- edge cases have deterministic states
- human output contains the same instruction as JSON output

---

# Definition of done for this task pack

This task pack is complete only when:

- all listed command states are implemented or explicitly marked unsupported with a test-backed reason
- all command outputs pass schema validation
- all lifecycle-critical commands emit prescriptive next actions
- all edge cases listed in `TASK-PRESCRIPTIVE-030` are covered
- agents can follow command output without inferring process policy
- no implementer path suggests bypassing gates, acceptance criteria, ownership, provider auth, or unsafe branch protection
