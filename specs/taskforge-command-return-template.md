# TaskForge Command Return Template and Agent Anti-Drift Contract

Status: Draft implementation specification  
Audience: TaskForge implementer agents, reviewer agents, and human product owner  
Purpose: Define the mandatory return packet for every `taskforge` command so agents receive explicit execution constraints, valid next commands, todo-merge instructions, context-cleanup instructions, and recovery guidance.

---

## 1. Objective

TaskForge command output must become the active control surface for agents.

Each command must return not only status, but a constrained agentic prompt that tells the agent:

1. Whether the command succeeded.
2. What state it is now in.
3. Which TaskForge commands are valid next.
4. Which actions are prohibited.
5. What todo items must be merged into the current task.
6. Whether context cleanup is required before continuing.
7. How to recover from failure without bypassing TaskForge.
8. When to stop for human or doctor-mode intervention.

Agents must not infer their own workflow. They must select from the returned `validNextCommands`.

---

## 2. Absolute Control-Plane Rules

### 2.1 TaskForge Is the Workflow Interface

Agents must use TaskForge commands for task workflow operations.

Agents must not use raw `git` for workflow actions when TaskForge provides a facade.

Use:

```bash
taskforge diff <TASK-ID>
taskforge checkpoint <TASK-ID> -m "<message>"
taskforge submit <TASK-ID>
taskforge pr <TASK-ID>
taskforge cleanup <TASK-ID> --dry-run
taskforge cleanup <TASK-ID> --apply
```

Do not use these directly for task workflow:

```bash
git diff
git commit
git push
gh pr create
git worktree remove
git branch -D
```

Exception: TaskForge internals may use git. Normal coding agents may not bypass the TaskForge command surface.

### 2.2 Force Is Not Agent-Available

Normal agents must not use `--force`.

`--force` is reserved for:

1. Human intervention.
2. Doctor-mode recovery.
3. A recovery task explicitly created by doctor mode and authorized for force use.

If a normal agent believes `--force` is required, the valid next command must be one of:

```bash
taskforge doctor
```

```bash
taskforge block <TASK-ID> "Requires human or doctor-mode recovery: <reason>" --category unsafe_operation --blocked-by human
```

```bash
taskforge new "Handle unclosed TaskForge error state: <ERROR-CODE>" --type Bug --priority P1 --agent-role "Planner" --status Ready --body "Observed unhandled state from command <COMMAND>. Error code: <ERROR-CODE>. Error message: <MESSAGE>. Define invariant, recovery path, valid next commands, tests, and documentation."
```

### 2.3 New Task Requires Context Cleanup

When a command causes an agent to start or switch to a new task, the command result must explicitly request context cleanup.

Relevant carry-forward information must be converted into todo items before context cleanup.

The return packet must include:

1. `contextCleanup.required: true`
2. An imperative instruction to clear irrelevant prior-task context.
3. A `todoMerge` section containing all relevant carry-forward items.
4. A prohibition against relying on unstated memory from previous tasks.

The agent must not begin implementation on the new task until it has merged relevant carry-forward items into the task todo list.

---

## 3. Required JSON Return Schema

JSON mode is authoritative. Plain-text mode must render the same semantics as Markdown.

```ts
export interface TaskForgeCommandResult {
  ok: boolean;

  command: CommandMetadata;

  status: CommandStatus;

  context: CommandContext;

  agentPrompt: AgentPromptEnvelope;

  validNextCommands: ValidNextCommand[];

  todoMerge: TodoMergeInstruction;

  contextCleanup: ContextCleanupInstruction;

  prohibitedActions: ProhibitedAction[];

  recovery?: RecoveryInstruction;

  diagnostics?: DiagnosticItem[];

  audit?: AuditReference;
}

export interface CommandMetadata {
  name: string;
  argv: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface CommandStatus {
  outcome: "success" | "blocked" | "failed" | "noop" | "human_required" | "doctor_required";
  code: string;
  message: string;
  severity: "info" | "warn" | "error" | "critical";
}

export interface CommandContext {
  taskId?: string;
  previousTaskId?: string;
  taskStatus?: string;
  taskStatusLabel?: string;
  assignee?: string;
  branch?: string;
  worktree?: string;
  doctorLocked?: boolean;
  repoRoot?: string;
  taskStateRoot?: string;
  taskSwitch?: boolean;
}

export interface AgentPromptEnvelope {
  role: "TaskForge Control Plane";
  instruction: string;
  task: string;
  constraints: string[];
  executeNow: string[];
  stopConditions: string[];
}

export interface ValidNextCommand {
  command: string;
  purpose: string;
  when: string;
  allowedFor: "agent" | "human" | "doctor" | "agent_after_human_approval";
  priority: number;
}

export interface TodoMergeInstruction {
  required: boolean;
  instruction: string;
  items: TodoMergeItem[];
}

export interface TodoMergeItem {
  id: string;
  text: string;
  source: string;
  priority: "P0" | "P1" | "P2" | "P3";
  status: "todo" | "doing" | "blocked" | "done";
}

export interface ContextCleanupInstruction {
  required: boolean;
  reason: string;
  instruction: string;
  preserve: string[];
  discard: string[];
  mustCompleteBefore: string;
}

export interface ProhibitedAction {
  action: string;
  reason: string;
  replacementCommand?: string;
}

export interface RecoveryInstruction {
  state: string;
  summary: string;
  agentAllowed: boolean;
  commands: ValidNextCommand[];
  createUnhandledStateTask: boolean;
  unhandledStateTaskCommand?: string;
}

export interface DiagnosticItem {
  code: string;
  message: string;
  severity: "info" | "warn" | "error" | "critical";
  taskId?: string;
  suggestedCommand?: string;
}

export interface AuditReference {
  eventId?: string;
  transcriptPath?: string;
  timelinePath?: string;
}
```

---

## 4. Required Markdown Rendering

Every non-JSON command result must render the following sections in this exact order.

```md
# TaskForge Command Result

## 1. Command Success Status

- Success: <true|false>
- Outcome: <success|blocked|failed|noop|human_required|doctor_required>
- Code: <CODE>
- Severity: <info|warn|error|critical>
- Message: <plain English status>

## 2. Current Context

- Task: <TASK-ID or none>
- Previous Task: <TASK-ID or none>
- Task Switch: <true|false>
- Task Status: <status or none>
- Assignee: <session or none>
- Branch: <branch or none>
- Worktree: <path or none>
- Doctor Lock: <true|false>

## 3. Agentic Instruction

You are operating under the TaskForge control plane.

Your immediate task is:

<imperative instruction>

You must obey these constraints:

- <constraint>
- <constraint>

## 4. Valid Next Commands

Run exactly one of the following TaskForge commands next. Select the first command whose condition matches the current state.

| Priority | Command | Allowed For | When | Purpose |
|---:|---|---|---|---|
| 1 | `<command>` | agent | <condition> | <purpose> |

## 5. Todo Merge Required

MERGE the following items into the current task todo list before performing any implementation work. Preserve existing todo items. Add missing items. Update matching items by ID. Do not delete existing task todo items unless TaskForge explicitly says to remove them.

| ID | Priority | Status | Source | Todo Item |
|---|---|---|---|---|
| <id> | P1 | todo | <source> | <text> |

If the table is empty, no todo merge is required.

## 6. Context Cleanup

- Required: <true|false>
- Reason: <reason>
- Must Complete Before: <next activity>

Instruction:

<context cleanup instruction>

Preserve only:

- <item>

Discard:

- Prior-task implementation details not listed in Todo Merge
- Stale assumptions from previous task context
- Unverified plan fragments not captured in task notes or todo items

## 7. Prohibited Actions

Do not perform these actions.

| Prohibited Action | Reason | Use Instead |
|---|---|---|
| <action> | <reason> | `<replacement command>` |

## 8. Recovery Guidance

If the command did not succeed, follow this recovery path.

- Recovery State: <state>
- Agent Allowed To Recover: <true|false>
- Required Recovery Command: `<command>`
- Human Required: <true|false>
- Doctor Required: <true|false>

## 9. Audit and Trace

- Event ID: <event id or none>
- Transcript: <path or none>
- Timeline: <path or none>
```

---

## 5. Standard Agent Prompt Blocks

### 5.1 Default Agentic Instruction

Every command result must contain a prompt equivalent to this:

```text
You are operating under the TaskForge control plane. You must not invent workflow steps. You must not bypass TaskForge with raw git or direct task-file edits. Select exactly one next command from validNextCommands. If no agent-allowed command applies, stop and follow Recovery Guidance.
```

### 5.2 Todo Merge Instruction

Every command result must contain this instruction, even when no todo items exist:

```text
MERGE the listed todoMerge.items into the current task todo list before performing implementation work. Preserve existing todo items. Add missing items. Update matching items by ID. Do not delete existing task todo items unless TaskForge explicitly instructs removal. Any relevant context from a previous task must be represented as a todo item before context cleanup.
```

### 5.3 Context Cleanup Instruction for New Task

When `context.taskSwitch === true`, `contextCleanup.required` must be `true`, and the command must return this instruction:

```text
CONTEXT CLEANUP REQUIRED. You are starting or switching to a new task. Before implementation, merge all relevant carry-forward information into the current task todo list. After todo merge, discard prior-task context not explicitly preserved here. Do not rely on memory from previous tasks unless it appears in the task file, the command result, or the merged todo list.
```

### 5.4 Force Prohibition Instruction

Every command result must include:

```text
Do not use --force. Force is reserved for human intervention and doctor-mode recovery. If force appears necessary, run taskforge doctor or block the task for human intervention.
```

---

## 6. Standard Prohibited Actions

Every command result must include these prohibited actions.

| Prohibited Action | Reason | Use Instead |
|---|---|---|
| Do not run raw git commands for task workflow operations. | TaskForge must preserve state, auditability, and guardrails. | `taskforge diff`, `taskforge checkpoint`, `taskforge submit`, `taskforge pr`, `taskforge cleanup` |
| Do not modify task files directly. | Task-state mutations must go through TaskForge transaction logic. | `taskforge block`, `taskforge done`, `taskforge release`, `taskforge new`, `taskforge report`, `taskforge heartbeat` |
| Do not use `--force`. | Force is reserved for humans and doctor-mode recovery. | `taskforge doctor` or `taskforge block <TASK-ID> "Requires human or doctor-mode recovery: <reason>" --category unsafe_operation --blocked-by human` |
| Do not start unrelated work. | Agents must preserve task scope and avoid uncontrolled parallel work. | `taskforge next` or `taskforge prompt <TASK-ID>` |
| Do not carry hidden context into a new task. | Hidden context pollutes task execution and causes drift. | Merge relevant context into `todoMerge.items`, then perform context cleanup. |

---

## 7. Valid Next Command Selection Algorithm

Agents must use this algorithm exactly.

```text
1. Read command result.
2. If todoMerge.required is true, merge todoMerge.items into the current task todo list.
3. If contextCleanup.required is true, perform context cleanup after todo merge and before implementation.
4. Filter validNextCommands to allowedFor = "agent".
5. Select the lowest-priority command whose when condition matches current state.
6. Execute exactly that command.
7. If no agent-allowed command applies, follow Recovery Guidance.
8. If Recovery Guidance requires human or doctor mode, stop normal implementation.
9. Never use --force unless the result explicitly identifies the current executor as doctor mode or human-authorized recovery.
```

---

## 8. Required Valid Next Commands by CLI Command

### 8.1 `taskforge init`

On success, valid next commands:

```bash
taskforge doctor
```

```bash
taskforge next
```

Context cleanup:

- Required: false

Force rule:

- Normal agents may not invoke `taskforge init --force`.

### 8.2 `taskforge next`

If a Ready task is found, valid next command:

```bash
taskforge start <TASK-ID>
```

If current session owns an active task:

```bash
taskforge resume <TASK-ID>
```

If no task is available:

```bash
taskforge status
```

or:

```bash
taskforge new "Define next TaskForge work item" --type Task --priority P2 --agent-role "Planner" --status Needs Spec
```

Context cleanup:

- Required: false unless the result selects a different task than the current active task.
- If returning a new task candidate after previous task completion, include carry-forward context as todo items.

### 8.3 `taskforge start <TASK-ID>`

On success, valid next commands:

```bash
taskforge prompt <TASK-ID>
```

```bash
taskforge gates
```

```bash
taskforge diff <TASK-ID>
```

Context cleanup:

- Required: true.
- Reason: starting task work creates a new bounded execution context.
- Relevant prior context must be included in `todoMerge.items`.

Required todo merge items should include:

1. Acceptance criteria summary.
2. Verification commands expected for the task.
3. Files or modules in scope.
4. Known constraints.
5. Any carry-forward context from the previous task that is relevant.
6. Anti-drift reminder to use TaskForge facades.

If task is locked, valid next commands:

```bash
taskforge inspect <TASK-ID>
```

```bash
taskforge sweep
```

```bash
taskforge doctor
```

Normal agents must not use:

```bash
taskforge start <TASK-ID> --force
```

If still blocked after sweep:

```bash
taskforge block <TASK-ID> "Task appears locked and could not be safely recovered without force" --category unsafe_operation --blocked-by human
```

### 8.4 `taskforge resume <TASK-ID>`

On success:

```bash
taskforge prompt <TASK-ID>
```

```bash
taskforge diff <TASK-ID>
```

```bash
taskforge gates
```

Context cleanup:

- Required: true if resuming a different task than the prior active context.
- Required: false if resuming the same task and no task switch occurred.

If worktree missing:

```bash
taskforge inspect <TASK-ID>
```

```bash
taskforge doctor
```

### 8.5 `taskforge prompt <TASK-ID>`

On success:

```bash
taskforge diff <TASK-ID>
```

```bash
taskforge gates
```

```bash
taskforge checkpoint <TASK-ID> -m "<message>"
```

Context cleanup:

- Required: true if prompt is for a newly started task or task switch.
- Required: false if prompt is for same active task.

The prompt result must restate todo merge requirements.

### 8.6 `taskforge diff <TASK-ID>`

On success with changes:

```bash
taskforge gates
```

```bash
taskforge checkpoint <TASK-ID> -m "<message>"
```

On success with no changes:

```bash
taskforge prompt <TASK-ID>
```

or:

```bash
taskforge report <TASK-ID>
```

Context cleanup:

- Required: false.

Agents must not replace this with `git diff`.

### 8.7 `taskforge gates`

On success:

```bash
taskforge report <TASK-ID>
```

```bash
taskforge checkpoint <TASK-ID> -m "<message>"
```

On task-caused failure:

```bash
taskforge prompt <TASK-ID>
```

On environment or control-plane failure:

```bash
taskforge doctor
```

On unrelated failure that cannot be isolated:

```bash
taskforge block <TASK-ID> "Unrelated verification failure requires human triage: <details>" --category test_failure --blocked-by human
```

Context cleanup:

- Required: false.

### 8.8 `taskforge checkpoint <TASK-ID> -m "<message>"`

On success:

```bash
taskforge submit <TASK-ID>
```

```bash
taskforge report <TASK-ID>
```

On failure:

```bash
taskforge inspect <TASK-ID>
```

```bash
taskforge doctor
```

Context cleanup:

- Required: false.

Agents must not replace this with `git commit`.

### 8.9 `taskforge submit <TASK-ID>`

On success:

```bash
taskforge pr <TASK-ID>
```

or:

```bash
taskforge report <TASK-ID>
```

On push rejection:

```bash
taskforge inspect <TASK-ID>
```

```bash
taskforge doctor
```

Context cleanup:

- Required: false.

Agents must not replace this with `git push`.

### 8.10 `taskforge pr <TASK-ID>`

On success:

```bash
taskforge report <TASK-ID> --complete
```

On failure:

```bash
taskforge submit <TASK-ID>
```

```bash
taskforge doctor
```

Context cleanup:

- Required: false.

Agents must not replace this with `gh pr create` unless a task explicitly authorizes a missing TaskForge facade workaround.

### 8.11 `taskforge report <TASK-ID>`

On success:

```bash
taskforge done <TASK-ID>
```

or, if review is still required:

```bash
taskforge status
```

On incomplete acceptance criteria:

```bash
taskforge ac-check <TASK-ID>
```

```bash
taskforge prompt <TASK-ID>
```

or:

```bash
taskforge block <TASK-ID> "Acceptance criteria incomplete or ambiguous" --category ambiguous_spec --blocked-by human
```

Context cleanup:

- Required: false.

### 8.12 `taskforge done <TASK-ID>`

On success:

```bash
taskforge cleanup <TASK-ID> --dry-run
```

```bash
taskforge next
```

If cleanup is desired:

```bash
taskforge cleanup <TASK-ID> --apply
```

Context cleanup:

- Required: true if the result recommends `taskforge next` and a new task will be selected.
- The done result must summarize any relevant follow-up items as todo merge candidates for either a new follow-up task or the next task context.

Agents must not use:

```bash
taskforge done <TASK-ID> --force
```

### 8.13 `taskforge cleanup <TASK-ID>`

On dry-run success:

```bash
taskforge cleanup <TASK-ID> --apply
```

On apply success:

```bash
taskforge next
```

If unsafe:

```bash
taskforge inspect <TASK-ID>
```

```bash
taskforge doctor
```

Context cleanup:

- Required: true after successful cleanup if the next step is `taskforge next`.

Agents must not use:

```bash
taskforge cleanup <TASK-ID> --force
```

### 8.14 `taskforge block <TASK-ID> "reason"`

On success:

```bash
taskforge next
```

or:

```bash
taskforge status
```

Context cleanup:

- Required: true if moving away from the blocked task.
- Blocked reason and remaining work must be included in todo merge items before cleanup.

A blocked task result must include todo items for:

1. The blocked condition.
2. Required human input or external condition.
3. Last safe known state.
4. Recommended unblocking command.

### 8.15 `taskforge release <TASK-ID>`

On success:

```bash
taskforge next
```

If release is unsafe:

```bash
taskforge doctor
```

Context cleanup:

- Required: true.
- Any relevant carry-forward information must be converted to todo items before releasing context.

### 8.16 `taskforge sweep`

On success with recovered tasks:

```bash
taskforge next
```

On success with no recovered tasks:

```bash
taskforge status
```

On dirty stale worktree:

```bash
taskforge inspect <TASK-ID>
```

```bash
taskforge doctor
```

Context cleanup:

- Required: false unless sweep causes current task ownership/context to change.

Sweep must not expose a normal-agent force path.

### 8.17 `taskforge doctor`

On healthy result:

```bash
taskforge next
```

On repairable issues:

```bash
taskforge new "Doctor recovery: <summary>" --type Bug --priority P1 --agent-role "Recovery" --status Ready --body "<doctor findings>"
```

Context cleanup:

- Required: true if entering a doctor-created recovery task.
- The doctor result must put every relevant finding into todo merge items for the recovery task.

Normal agents must not run hidden or future repair mode unless the command result marks that repair as `allowedFor: "doctor"` or `allowedFor: "human"`.

### 8.18 `taskforge validate-state`

On success:

```bash
taskforge next
```

On invariant errors:

```bash
taskforge doctor
```

On unknown invariant error:

```bash
taskforge new "Handle unclosed TaskForge invariant violation: <CODE>" --type Bug --priority P1 --agent-role "Planner" --status Ready --body "Define recovery path, valid next commands, tests, and documentation for invariant <CODE>."
```

Context cleanup:

- Required: true if creating an invariant-repair task.
- Validation findings must be merged as todo items.

### 8.19 `taskforge new "Title"`

On success:

```bash
taskforge prompt <TASK-ID>
```

```bash
taskforge next
```

If task is underspecified:

```bash
taskforge block <TASK-ID> "Task requires specification before implementation" --category ambiguous_spec --blocked-by human
```

Context cleanup:

- Required: true if the agent will start or prompt the newly created task.
- The result must include all known source context as todo items.

### 8.20 Dependency Commands

All dependency commands must return TaskForge-only next commands.

Minimum transitions:

| Command | Valid Next Commands |
|---|---|
| `taskforge deps scan` | `taskforge deps audit`, `taskforge deps outdated`, `taskforge deps deprecated`, `taskforge deps plan` |
| `taskforge deps audit` with findings | `taskforge deps create-tasks` |
| `taskforge deps outdated` with findings | `taskforge deps plan` |
| `taskforge deps deprecated` with findings | `taskforge deps plan` |
| `taskforge deps plan` | `taskforge deps create-tasks` |
| `taskforge deps create-tasks` | `taskforge next` |
| `taskforge deps pr` | `taskforge report <TASK-ID>`, `taskforge pr <TASK-ID>` |
| `taskforge deps summary` | `taskforge status`, `taskforge next` |

Context cleanup:

- Required: true when a dependency command creates or selects a task.
- Findings must be added to todo merge items for the created task.

---

## 9. Example: Successful `taskforge start TASK-123 --json`

```json
{
  "ok": true,
  "command": {
    "name": "start",
    "argv": ["TASK-123"],
    "startedAt": "2026-05-27T20:00:00.000Z",
    "finishedAt": "2026-05-27T20:00:01.000Z",
    "durationMs": 1000
  },
  "status": {
    "outcome": "success",
    "code": "TASK_STARTED",
    "message": "Task TASK-123 was claimed and workspace was prepared.",
    "severity": "info"
  },
  "context": {
    "taskId": "TASK-123",
    "previousTaskId": "TASK-122",
    "taskSwitch": true,
    "taskStatus": "in_progress",
    "taskStatusLabel": "In Progress",
    "branch": "agent/TASK-123-example",
    "worktree": "../worktrees/task-forge/TASK-123",
    "doctorLocked": false
  },
  "agentPrompt": {
    "role": "TaskForge Control Plane",
    "instruction": "You are now operating on TASK-123. Do not use prior task context unless it is listed in todoMerge or the task file.",
    "task": "Merge todo items, perform context cleanup, then continue with one valid next command.",
    "constraints": [
      "Do not use raw git for workflow operations.",
      "Do not use --force.",
      "Do not modify task-state files directly.",
      "Do not carry hidden context from TASK-122 into TASK-123."
    ],
    "executeNow": [
      "Merge todoMerge.items into the current task todo list.",
      "Perform context cleanup.",
      "Run taskforge prompt TASK-123."
    ],
    "stopConditions": [
      "No valid agent command applies.",
      "Human intervention is required.",
      "Doctor-mode recovery is required."
    ]
  },
  "validNextCommands": [
    {
      "command": "taskforge prompt TASK-123",
      "purpose": "Load the complete execution packet for the started task.",
      "when": "The task has just been started successfully.",
      "allowedFor": "agent",
      "priority": 1
    },
    {
      "command": "taskforge gates",
      "purpose": "Run baseline verification before edits if needed.",
      "when": "The agent needs a pre-change verification baseline.",
      "allowedFor": "agent",
      "priority": 2
    }
  ],
  "todoMerge": {
    "required": true,
    "instruction": "MERGE the following items into the current task todo list before performing implementation work. Preserve existing todo items. Add missing items. Update matching items by ID. Do not delete existing task todo items unless TaskForge explicitly says to remove them.",
    "items": [
      {
        "id": "TF-START-READ-SPEC",
        "text": "Read TASKFORGE.md, AGENTS.md if present, and the TASK-123 task file before editing code.",
        "source": "taskforge start",
        "priority": "P1",
        "status": "todo"
      },
      {
        "id": "TF-START-USE-FACADES",
        "text": "Use taskforge diff/checkpoint/submit/pr instead of raw git workflow commands.",
        "source": "taskforge start",
        "priority": "P1",
        "status": "todo"
      },
      {
        "id": "TF-CARRY-FORWARD-001",
        "text": "Carry forward from TASK-122: command return template must include context cleanup instructions.",
        "source": "previous task context",
        "priority": "P1",
        "status": "todo"
      }
    ]
  },
  "contextCleanup": {
    "required": true,
    "reason": "A new task context has been entered.",
    "instruction": "CONTEXT CLEANUP REQUIRED. Merge relevant carry-forward information into todoMerge first. Then discard prior-task context not explicitly preserved here. Do not rely on previous task memory unless it appears in the task file, command result, or merged todo list.",
    "preserve": [
      "TASK-123 task file",
      "TASKFORGE.md",
      "AGENTS.md if present",
      "todoMerge.items"
    ],
    "discard": [
      "TASK-122 implementation details not represented in todoMerge",
      "Unverified assumptions from prior task context",
      "Prior task plan fragments not captured in task notes"
    ],
    "mustCompleteBefore": "implementation work"
  },
  "prohibitedActions": [
    {
      "action": "Do not use --force.",
      "reason": "Force is reserved for humans and doctor-mode recovery.",
      "replacementCommand": "taskforge doctor"
    },
    {
      "action": "Do not run raw git commands for workflow operations.",
      "reason": "TaskForge must preserve auditability and state invariants.",
      "replacementCommand": "taskforge diff/checkpoint/submit/pr"
    }
  ]
}
```

---

## 10. Implementation Prompt for Agent

Use this prompt to direct an implementation agent.

```text
You are implementing the TaskForge command return contract.

Goal:
Every TaskForge command must return a structured control-plane result that prevents agentic drift.

Implement the following:

1. Add a shared TaskForgeCommandResult model.
2. Add helper builders for success, blocked, failed, human_required, doctor_required, and noop outcomes.
3. Add required fields: command, status, context, agentPrompt, validNextCommands, todoMerge, contextCleanup, prohibitedActions, recovery, diagnostics, audit.
4. Ensure every command supports the same result shape in JSON mode.
5. Ensure non-JSON mode renders the same result as Markdown using the required section order.
6. Add command-specific validNextCommands for every CLI command.
7. Add standard prohibited actions to every result.
8. Enforce that normal-agent results never recommend commands containing --force.
9. Add contextCleanup.required=true whenever a task is started, resumed after a task switch, newly created and selected, released, blocked-and-left, completed-and-next, cleaned-up-and-next, or converted into a recovery task.
10. Ensure all relevant carry-forward context is represented in todoMerge.items before context cleanup.
11. Ensure unknown error states generate recovery guidance that creates a new TaskForge task to close that unhandled state.
12. Add tests proving that every CLI command returns ok/status/validNextCommands/todoMerge/contextCleanup/prohibitedActions.
13. Add tests proving no normal-agent validNextCommands include --force.
14. Add tests proving task-switching commands require context cleanup.
15. Add docs explaining the return contract and agent command-selection algorithm.

Constraints:
- Do not use raw git workflow commands in agent guidance when a TaskForge command exists.
- Do not expose --force to normal agents.
- Do not directly edit task-state files outside existing transaction mechanisms.
- Do not invent new workflow concepts outside TaskForge.

Verification:
- npm run typecheck
- npm test
- npm run lint if configured
- taskforge validate-state --json
- taskforge doctor --json

Expected deliverables:
- Shared result schema/types.
- Markdown renderer.
- JSON renderer.
- Command-specific next-command maps.
- Context cleanup support.
- Todo merge support.
- Tests.
- Documentation.
```

---

## 11. Reviewer Prompt

Use this prompt to direct a review agent.

```text
You are reviewing the TaskForge command return contract implementation.

Review objectives:

1. Confirm every CLI command returns the required TaskForgeCommandResult shape.
2. Confirm every result explicitly reports command success status.
3. Confirm every result includes validNextCommands.
4. Confirm every result includes todoMerge with imperative merge instructions.
5. Confirm every task-switching result includes contextCleanup.required=true.
6. Confirm all relevant carry-forward context is converted into todoMerge.items before cleanup.
7. Confirm normal-agent validNextCommands never include --force.
8. Confirm --force appears only as human-only or doctor-only guidance.
9. Confirm all prohibited actions are present.
10. Confirm unknown errors produce recovery guidance that creates a new TaskForge task for the unhandled state.
11. Confirm no command output encourages raw git workflow bypasses.
12. Confirm tests cover success, failure, blocked, doctor-required, human-required, and context-cleanup paths.

Reject the implementation if:
- Any command can return without validNextCommands.
- Any command can return without todoMerge.
- Any task-switch command omits contextCleanup.
- Any normal-agent next command includes --force.
- Any result tells the agent to use raw git instead of TaskForge facades.
- Any unhandled state lacks a task-creation recovery path.

Return a concise review with blocking issues first.
```

---

## 12. Documentation Prompt

Use this prompt to direct a documentation agent.

```text
You are documenting the TaskForge command return contract.

Create or update documentation that explains:

1. The command return schema.
2. Required Markdown section order.
3. The validNextCommands selection algorithm.
4. Todo merge semantics.
5. Context cleanup semantics.
6. The rule that relevant prior context must be converted to todo items before starting a new task.
7. The rule that normal agents must not use --force.
8. The rule that agents must not bypass TaskForge with raw git workflow commands.
9. Recovery guidance for known and unknown error states.
10. Examples for start, done, block, doctor, validate-state, and gates.

Documentation must be written as direct agent instructions, not passive prose.

Acceptance criteria:
- Agents can determine exactly what to do next from any command result.
- Agents are explicitly told when to clean context.
- Agents are explicitly told what to merge into todo state.
- Agents are explicitly told not to use --force.
- Agents are explicitly told not to bypass TaskForge.
```
