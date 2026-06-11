# TaskForge Control-Plane Closure Specification

**Audience:** TaskForge implementation agents, reviewer agents, QA agents, and human product owner  
**Purpose:** Make TaskForge the mandatory control plane for agentic development so agents cannot drift into raw `git`, ad-hoc task concepts, or bypass workflows.

**Status:** Historical closure specification. Use the live CLI, `docs/workflow.md`, and `docs/architecture/command-state-machine-and-invariants.md` as current operational authority. Items marked as gaps below may already be implemented.

---

## 1. Current-State Evaluation

### 1.1 Confirmed implementation/documentation alignment

The project already has the correct high-level architecture:

- TaskForge is described as a repo-centered task management and execution system for agentic software development.
- The intended model includes:
  - human-visible task board,
  - repo-native Markdown task specifications,
  - isolated agent workspaces via git worktrees,
  - task branches and pull requests,
  - continuation policy,
  - human-intervention gates,
  - project summaries.
- Documentation states that task-state lives on a dedicated `task-state` branch through sibling worktree `../task-state/`.
- Documentation warns agents not to create or modify `main/tasks/*.md`.
- CLI already contains a broad command surface:
  - task discovery/claiming: `next`, `claim`, `start`, `resume`
  - lifecycle: `done`, `release`, `reject`, `block`, `unlock`
  - inspection/reporting: `status`, `summary`, `list`, `inspect`, `prompt`
  - maintenance: `sweep`, `heartbeat`, `cleanup`, `report`
  - health/quality: `gates`, `validate-state`, `doctor`, `config-validate`
  - git facade: `diff`, `checkpoint`, `submit`, `pr`
  - dependency stewardship: `deps *`
  - audit/transcript/timeline
  - acceptance criteria check: `ac-check`

### 1.2 Material inconsistencies and gaps

#### Gap A — Documentation is not authoritative enough for agent control

The existing docs describe intended workflows, but they do not yet define a complete **command-state contract** that forces every command to return explicit valid next actions.

Required correction:

- Add an authoritative `docs/architecture/command-state-machine-and-invariants.md`.
- Add machine-consumable state-machine data, preferably `src/core/command-state-machine.ts` or `.json`.
- Add tests that compare CLI commands against the documented state-machine registry.

#### Gap B — `--force` is exposed to normal agents

Current CLI exposes force-like options on several commands. This is dangerous in an agentic environment.

Policy change:

- `--force` must be unavailable to normal agents.
- `--force` may only be used by:
  - a human operator,
  - doctor mode,
  - an explicit recovery task whose task file states human authorization.
- Agent-facing prompts must say: **never use `--force`**.

Implementation requirement:

- Add role/authority gating around all force options.
- Commands must reject agent use of force with a structured error and next action:
  - `taskforge doctor --json`
  - `taskforge block TASK-ID "Requires human or doctor-mode force authorization" --category unsafe_operation --blocked-by human`

#### Gap C — Doctor docs and CLI mismatch

Resolved in the current CLI: `doctor --check`, `doctor --lock`, `doctor --fix`, `--reason`, `--ttl-hours`, and `--json` are registered. Doctor mutations require human/doctor authority.

Required correction:

- Keep docs aligned with the explicit lock flow in `docs/workflow.md`.
- Keep `doctor --fix` doctor/human-only for mutating repairs.
- Doctor mode must be the only automated path that can perform recovery operations equivalent to force.

#### Gap D — Error handling is insufficiently directive

`TaskForgeError` includes code and exitCode, but normal error output does not yet provide structured next actions. JSON result shape has `next.command`, but not a complete `nextActions[]` contract.

Required correction:

Every command must return a structured result:

```ts
interface NextAction {
  command: string;
  reason: string;
  safety: "safe" | "requires_human" | "doctor_only" | "blocked";
  preferred: boolean;
  stateTransition?: {
    from: string;
    to: string;
  };
}

interface CommandResult {
  ok: boolean;
  command: string;
  state?: object;
  nextActions: NextAction[];
  error?: {
    code: string;
    message: string;
    handled: boolean;
  };
}
```

#### Gap E — State-machine logic exists for task statuses but not for commands

`status-transition.ts` defines allowed status transitions, but command-level transitions are not centrally defined.

Required correction:

- Add command-level state machine.
- Each command implementation must consult it before mutation.
- Each command response must emit valid next actions from it.

#### Gap F — No closure over unknown/unhandled states

Current doctor/validator finds some inconsistent states, but the system does not yet guarantee closure over every error or unknown state.

Required correction:

Unhandled states must produce either:

1. a doctor-mode recovery path,
2. a human-intervention block,
3. a new generated TaskForge task to implement handling for that missing state.

No agent should be left with “just use git” or “figure it out.”

---

## 2. Non-Negotiable Agent Policy

Agents must obey these rules.

### 2.1 TaskForge is the control plane

Agents must use TaskForge for:

- task discovery,
- task claiming,
- task start/resume,
- worktree entry guidance,
- task status mutation,
- task notes,
- checkpoint commits,
- branch push,
- PR creation,
- cleanup,
- diagnostics,
- audit review.

Agents must not use raw `git` as a workflow bypass.

Allowed raw commands:

- read-only shell commands for inspection,
- build/test commands,
- package manager commands within task scope,
- raw `git status` only if TaskForge is broken and the agent is creating a TaskForge bug task for that condition.

Preferred TaskForge equivalents:

| Intent | Required command |
|---|---|
| Find work | `taskforge next` |
| Start work | `taskforge start TASK-ID` |
| Resume work | `taskforge resume TASK-ID` |
| Inspect task workspace | `taskforge inspect TASK-ID` |
| View diff | `taskforge diff TASK-ID` |
| Commit | `taskforge checkpoint TASK-ID -m "message"` |
| Push branch | `taskforge submit TASK-ID` |
| Open PR | `taskforge pr TASK-ID` |
| Run gates | `taskforge gates` |
| Mark blocked | `taskforge block TASK-ID "reason"` |
| Complete report | `taskforge report TASK-ID --complete` |
| Complete task | `taskforge done TASK-ID` |
| Diagnose system | `taskforge doctor --json` |
| Validate task state | `taskforge validate-state --json` |
| Create missing-system task | `taskforge new "Handle unclosed TaskForge state: <summary>" --type Bug --priority P1 --status Ready --body "<details>"` |

### 2.2 Agents must never use `--force`

Normal agents must not run commands containing `--force`.

Forbidden for agents:

```bash
taskforge start TASK-ID --force
taskforge unlock TASK-ID --force
taskforge heartbeat TASK-ID --force
taskforge cleanup TASK-ID --force
```

Force is reserved for:

- human operator,
- doctor-mode recovery,
- explicitly human-authorized recovery task.

If an agent thinks force is needed, it must run:

```bash
taskforge doctor --json
```

Then either:

```bash
taskforge block TASK-ID "Force operation required; human or doctor-mode authorization needed" --category unsafe_operation --blocked-by human
```

or create a missing-state task:

```bash
taskforge new "Add doctor-mode handling for <state>" --type Bug --priority P1 --status Ready --body "<state, command, error, expected recovery>"
```

---

## 3. Global Logical Invariants

### G1. Single source of truth

Task files live only in the TaskForge task-state worktree/branch.

Invariant:

```text
No agent may create or modify main/tasks/*.md.
All task mutations must go through TaskForge.
```

### G2. One active owned task per session

Invariant:

```text
A session may own at most one unresolved active task.
```

Active owned statuses:

- `In Progress`
- `Review`
- `Verify`

Before claiming or starting new work, the agent must resolve existing owned work by one of:

```bash
taskforge resume TASK-ID
taskforge report TASK-ID --complete
taskforge block TASK-ID "reason"
taskforge release TASK-ID
taskforge done TASK-ID
```

### G3. Worktree isolation

Invariant:

```text
Implementation work happens only inside the TaskForge-created task worktree.
```

Agents must not edit implementation files from:

- main branch,
- task-state worktree,
- unrelated worktree,
- parent repo checkout.

### G4. Branch/task/session consistency

For any active implementation task:

```text
task.id must match branch/worktree identity.
task.assignee must identify owning session.
task.branch must be TaskForge-managed.
task.worktree must be TaskForge-managed.
```

### G5. Valid status transitions only

Allowed status transitions:

| From | To |
|---|---|
| Inbox | Needs Spec, Rejected |
| Needs Spec | Ready, Deferred |
| Ready | In Progress, Blocked, Deferred |
| In Progress | Review, Verify, Blocked, Deferred |
| Blocked | Ready, In Progress |
| Review | In Progress, Verify, Done |
| Verify | In Progress, Review, Done |
| Done | In Progress only through explicit reopen/recovery |
| Rejected | none |
| Deferred | Ready |

### G6. Blocked tasks require actionable reason

Invariant:

```text
status=Blocked requires blocked_reason.
```

Recommended fields:

```yaml
blocked_reason: "Concrete reason"
blocked_by: human | agent | bot
blocked_since: "YYYY-MM-DD HH:MM:SS"
block_category: human_decision | test_failure | merge_conflict | missing_secret | unsafe_operation | ambiguous_spec | unspecified
```

### G7. Done requires evidence

A task may become Done only if:

- acceptance criteria section exists,
- criteria are not blank,
- criteria are checked or explicitly excepted,
- gates were run or exception is recorded,
- report exists,
- task notes updated,
- code is checkpointed if code changed,
- branch submitted if code changed,
- PR merged or deliverable accepted.

### G8. Doctor lock stops normal agents

If doctor lock is active, normal agents must not continue implementation work.

Valid next actions:

```bash
taskforge doctor --json
```

or follow a doctor-emitted recovery task.

### G9. Every command must return next actions

All command outputs must include valid next action guidance.

Required JSON field:

```json
{
  "nextActions": [
    {
      "command": "taskforge ...",
      "reason": "...",
      "safety": "safe",
      "preferred": true
    }
  ]
}
```

### G10. Unknown state creates closure task

If TaskForge cannot map the current state to a valid next action, the agent must create a task.

Template:

```bash
taskforge new "Handle unclosed TaskForge state: <short summary>" \
  --type Bug \
  --priority P1 \
  --status Ready \
  --body "Observed command: <cmd>

Observed state:
<state>

Error:
<error>

Expected behavior:
TaskForge must return explicit valid nextActions and must not leave agents to bypass the control plane."
```

---

## 4. Command State Machine

This section defines valid command preconditions, effects, and next actions.

### 4.1 `taskforge init`

Valid when:

- repo is uninitialized, partially initialized, or needs repair.

Effects:

- creates config,
- creates/repairs task-state worktree,
- installs configured hooks/plugins,
- validates configuration.

Next actions:

| Result | Next actions |
|---|---|
| initialized | `taskforge status`, `taskforge next` |
| partially initialized | `taskforge doctor --json` |
| config invalid | `taskforge config-validate --json` |
| repair needed | `taskforge doctor --json` then human/doctor repair |

Agent restriction:

- agents may run `init` only when no TaskForge control plane exists or when task explicitly requires it.
- agents must not run destructive repair without doctor/human authority.

---

### 4.2 `taskforge next`

Valid when:

- no doctor lock,
- no unresolved owned task,
- task-state is readable.

Effects:

- pulls task-state,
- may sweep stale claims if implemented,
- returns highest-priority safe task.

Next actions:

| Result | Next actions |
|---|---|
| ready task found | `taskforge start TASK-ID` |
| owned task exists | `taskforge resume TASK-ID`, `taskforge report TASK-ID --complete`, `taskforge block TASK-ID "reason"` |
| no ready tasks | `taskforge list --status "Needs Spec"`, `taskforge list --status Blocked`, `taskforge new "..."` only if creating follow-up from known gap |
| doctor lock | `taskforge doctor --json` |
| invalid state | `taskforge validate-state --json`, then `taskforge doctor --json` |

Must not suggest:

- raw `git checkout`,
- raw branch creation,
- manual task-file edits.

---

### 4.3 `taskforge claim TASK-ID`

Valid when:

- task exists,
- status is `Ready`,
- task has no active assignee,
- no unresolved owned task,
- no doctor lock.

Effects:

- sets `assignee`,
- sets `claimed_at`,
- moves or keeps task in `In Progress` depending implementation decision.

Preferred policy:

- use `start` for implementers.
- use `claim` only for planning/review agents that do not need a worktree.

Next actions:

| Result | Next actions |
|---|---|
| claimed | `taskforge prompt TASK-ID`, `taskforge start TASK-ID` or role-specific command |
| already claimed | `taskforge inspect TASK-ID`, `taskforge next` |
| stale-looking claim | `taskforge doctor --json` |
| force would be needed | block for human/doctor; do not use force |

---

### 4.4 `taskforge start TASK-ID`

Valid when:

- task exists,
- status is `Ready` or resumable `In Progress`,
- no doctor lock,
- no other unresolved owned task,
- task is not assigned to another active session.

Effects:

- claims task,
- sets status to `In Progress`,
- creates task branch,
- creates task worktree,
- records control-file hash,
- appends agent note,
- emits worktree entry command.

Next actions:

| Result | Next actions |
|---|---|
| success | `cd <worktree>`, `taskforge prompt TASK-ID`, implement, `taskforge gates` |
| task missing | `taskforge list --json`, or create investigation task |
| invalid status | use command appropriate to current status |
| assigned to another session | `taskforge inspect TASK-ID`, `taskforge next`; if stale, `taskforge doctor --json` |
| worktree error | `taskforge doctor --json`, `taskforge inspect TASK-ID` |
| push failed/conflict | `taskforge next`, `taskforge inspect TASK-ID`, `taskforge doctor --json` |
| force would be needed | block for human/doctor |

Agent restriction:

- never use `taskforge start TASK-ID --force`.

---

### 4.5 `taskforge resume TASK-ID`

Valid when:

- task exists,
- worktree exists,
- task is active,
- current session owns task or task is review/verify-resumable under explicit policy.

Effects:

- prints worktree and branch,
- does not create new task state unless notes are appended.

Next actions:

| Result | Next actions |
|---|---|
| success | `cd <worktree>`, `taskforge inspect TASK-ID`, implement or review |
| missing worktree | `taskforge doctor --json` |
| not owner | `taskforge inspect TASK-ID`, then block or next |
| task terminal | `taskforge report TASK-ID` or create reopen task |

---

### 4.6 `taskforge inspect TASK-ID`

Valid when:

- task exists.

Effects:

- reads worktree/branch/dirty/ahead/claim state.

Next actions:

| Result | Next actions |
|---|---|
| clean active worktree | `taskforge resume TASK-ID` |
| dirty worktree | continue work, then `taskforge gates`, `taskforge checkpoint TASK-ID -m "..."` |
| ahead of main | `taskforge submit TASK-ID`, `taskforge pr TASK-ID` |
| stale claim | `taskforge doctor --json` |
| missing worktree | `taskforge doctor --json` |
| unknown condition | create missing-state task |

---

### 4.7 `taskforge gates`

Valid when:

- inside task worktree or task context is identifiable,
- project has configured gates.

Effects:

- runs typecheck/lint/build/test gates.

Next actions:

| Result | Next actions |
|---|---|
| all pass | `taskforge report TASK-ID --complete`, `taskforge checkpoint TASK-ID -m "..."` |
| task-caused failure | fix, rerun `taskforge gates` |
| unrelated failure | `taskforge block TASK-ID "Unrelated gate failure: <summary>" --category test_failure --blocked-by human` |
| gate missing/misconfigured | `taskforge doctor --json`, create task to add/fix gate |
| repeated failure | block for human with exact evidence |

---

### 4.8 `taskforge diff TASK-ID`

Valid when:

- task has worktree.

Effects:

- shows worktree diff through TaskForge facade.

Next actions:

| Result | Next actions |
|---|---|
| no diff | continue implementation, run gates, or report |
| expected diff | `taskforge gates`, then `taskforge checkpoint TASK-ID -m "..."` |
| unexpected diff | investigate; if unrelated, block or create cleanup task |
| missing worktree | `taskforge doctor --json` |

---

### 4.9 `taskforge checkpoint TASK-ID -m "message"`

Valid when:

- task has worktree,
- there are changes to commit,
- changes are in scope,
- gates have passed or this is a WIP checkpoint allowed by policy.

Effects:

- creates commit on task branch with TaskForge metadata/trailers.

Next actions:

| Result | Next actions |
|---|---|
| committed | `taskforge submit TASK-ID` |
| nothing to commit | `taskforge report TASK-ID --complete` or continue |
| commit failure | `taskforge doctor --json` |
| out-of-scope diff | revert in-scope way or block for human |

Agents must not run raw `git commit`.

---

### 4.10 `taskforge submit TASK-ID`

Valid when:

- task branch exists,
- commit(s) exist,
- branch is not protected main,
- no doctor lock.

Effects:

- pushes task branch.

Next actions:

| Result | Next actions |
|---|---|
| pushed | `taskforge pr TASK-ID` |
| rejected/non-fast-forward | `taskforge doctor --json` or TaskForge-managed sync command when implemented |
| auth failure | block for human |
| missing branch | `taskforge inspect TASK-ID`, `taskforge doctor --json` |

Agents must not run raw `git push`.

---

### 4.11 `taskforge pr TASK-ID`

Valid when:

- submitted branch exists,
- task has commits,
- PR does not already exist or can be updated.

Effects:

- creates or updates PR.

Next actions:

| Result | Next actions |
|---|---|
| PR created | `taskforge report TASK-ID --complete` |
| PR exists | `taskforge report TASK-ID --complete` |
| auth failure | block for human |
| no commits | resume task or report no-op task |
| GitHub unavailable | block or retry once |

Agents must not bypass with manual GitHub PR creation unless TaskForge lacks capability; if lacking, create a TaskForge bug.

---

### 4.12 `taskforge report TASK-ID --complete`

Valid when:

- task is `In Progress` or `Verify`,
- implementation/review work is substantially complete.

Effects:

- generates structured completion report,
- may transition to `Review`.

Next actions:

| Result | Next actions |
|---|---|
| report complete | `taskforge pr TASK-ID` if code changed, then `taskforge done TASK-ID` when accepted |
| missing acceptance evidence | `taskforge ac-check TASK-ID --json` |
| gates missing | `taskforge gates` |
| unresolved blocker | `taskforge block TASK-ID "reason"` |

---

### 4.13 `taskforge done TASK-ID`

Valid when:

- acceptance criteria satisfied,
- gates pass or exception recorded,
- report exists,
- PR merged or deliverable accepted,
- no unresolved blocker.

Effects:

- sets status `Done`,
- clears claim fields,
- may clean worktree if explicitly requested by human-safe option.

Next actions:

| Result | Next actions |
|---|---|
| done | `taskforge cleanup TASK-ID --dry-run`, `taskforge next` |
| acceptance criteria missing | `taskforge ac-check TASK-ID --json` |
| unchecked criteria | update task evidence or continue implementation |
| gates failed | fix/rerun or block |
| PR not merged | wait/review; do not mark done |
| cleanup desired | use non-force cleanup |

Agent restriction:

- agents may use `--cleanup` only if safe and documented.
- agents must not use `--delete-branch` unless explicitly allowed by human policy.

---

### 4.14 `taskforge block TASK-ID "reason"`

Valid when:

- task exists,
- reason is concrete,
- blocking state prevents safe continuation.

Effects:

- sets status `Blocked`,
- records reason/category/blocked_by,
- clears or preserves claim according to policy.

Next actions:

| Block category | Next actions |
|---|---|
| human_decision | wait for human; `taskforge next` |
| test_failure | create follow-up bug or wait for human if unrelated |
| merge_conflict | create merge-conflict recovery task if TaskForge cannot handle |
| missing_secret | wait for human; never access secret without approval |
| unsafe_operation | wait for human or doctor mode |
| ambiguous_spec | create/spec refinement task |

---

### 4.15 `taskforge release TASK-ID`

Valid when:

- task is owned by current session,
- work is not being completed,
- release is voluntary and safe.

Effects:

- clears assignee/claimed_at,
- resets task to `Ready` unless policy says otherwise.

Next actions:

| Result | Next actions |
|---|---|
| released | `taskforge next` |
| dirty worktree | checkpoint or block before release |
| not owner | `taskforge inspect TASK-ID`, `taskforge doctor --json` |

---

### 4.16 `taskforge unlock TASK-ID`

Human/doctor-only command.

Normal agents must not use it.

Valid when:

- human authorized, or
- doctor recovery task authorized.

Effects:

- clears lock fields.

Next actions:

| Result | Next actions |
|---|---|
| unlocked | `taskforge validate-state --json`, `taskforge next` |
| unsafe | `taskforge doctor --json` |
| human needed | block |

---

### 4.17 `taskforge sweep`

Valid when:

- task-state readable,
- no destructive recovery is attempted by normal agent.

Effects:

- identifies stale in-progress tasks,
- safe recovery only.

Agent policy:

- normal agents may run `taskforge sweep --dry-run`.
- mutating sweep is doctor-mode or scheduler responsibility.

Next actions:

| Result | Next actions |
|---|---|
| no stale tasks | `taskforge next` |
| stale clean tasks | doctor/sweeper may reset |
| stale dirty tasks | recovery task or human intervention |
| unknown stale state | create missing-state task |

---

### 4.18 `taskforge heartbeat TASK-ID`

Valid when:

- current session owns task,
- task is `In Progress`,
- no force required.

Effects:

- updates `claimed_at`.

Next actions:

| Result | Next actions |
|---|---|
| heartbeat ok | continue work |
| not owner | `taskforge inspect TASK-ID`; do not force |
| task not active | use state-appropriate command |

Agent restriction:

- never use `--force`.

---

### 4.19 `taskforge cleanup TASK-ID`

Valid when:

- task is Done, Rejected, or explicitly safe to clean,
- no uncommitted changes unless human/doctor authorized.

Effects:

- removes task worktree and optionally branch.

Agent policy:

- agents may run `taskforge cleanup TASK-ID --dry-run`.
- agents may run `taskforge cleanup TASK-ID --apply` only after `Done` and clean state.
- agents must never use `--force`.

Next actions:

| Result | Next actions |
|---|---|
| dry-run safe | `taskforge cleanup TASK-ID --apply` |
| applied | `taskforge next` |
| dirty | `taskforge inspect TASK-ID`, block or doctor |
| unsafe | human/doctor only |

---

### 4.20 `taskforge doctor --json`

Valid when:

- any time, especially when health/invariant issue exists.

Effects:

- diagnoses task-state, worktrees, hooks, audit logs, stale locks, broken dependencies.

Next actions:

| Result | Next actions |
|---|---|
| healthy | `taskforge next` |
| repair available | human/doctor may run repair |
| critical inconsistency | create/activate recovery task |
| unhandled issue code | create missing-state task |
| doctor lock active | follow emitted recovery task only |

Required enhancement:

- CLI must expose `doctor --fix` if implementation supports it.
- `doctor --fix` must be human/doctor-only.

---

### 4.21 `taskforge validate-state --json`

Valid when:

- any time.

Effects:

- validates task invariants.

Next actions:

| Result | Next actions |
|---|---|
| valid | `taskforge next` |
| error | `taskforge doctor --json` |
| warning | resolve with state-specific command |
| unhandled validation code | create task to document and repair validator coverage |

---

### 4.22 `taskforge new "title"`

Valid when:

- creating a legitimate task,
- creating a follow-up from discovered gap,
- creating an unhandled-state closure task.

Effects:

- creates task-state task file.

Next actions:

| Result | Next actions |
|---|---|
| Ready task created | `taskforge start TASK-ID` or `taskforge next` |
| Needs Spec task created | human/spec agent refinement |
| invalid fields | `taskforge config-validate --json` |

Agents must use this instead of manually creating Markdown files.

---

### 4.23 `taskforge reject TASK-ID "reason"`

Valid when:

- task is invalid, duplicate, obsolete, unsafe, or not planned.

Effects:

- sets terminal rejected state.

Next actions:

| Result | Next actions |
|---|---|
| rejected | `taskforge next` |
| uncertain | block for human rather than reject |

---

### 4.24 `taskforge deps *`

Dependency commands are task generators and diagnostics.

Policy:

- agents may run read-only dependency diagnostics.
- agents may create dependency tasks.
- agents must not perform broad dependency upgrades unless assigned to a dependency task.
- license/security implications require human intervention unless task explicitly authorizes action.

Next actions:

| Command | Next actions |
|---|---|
| `deps scan` | `deps plan` |
| `deps audit` | `deps create-tasks` for actionable issues |
| `deps outdated` | `deps plan` |
| `deps deprecated` | `deps create-tasks` |
| `deps plan` | create or start focused dependency tasks |
| `deps pr` | only for low-risk focused task |
| `deps summary` | report status |

---

## 5. Required Command Output Contract

Every command must emit equivalent human and JSON guidance.

### 5.1 JSON schema

```ts
export interface CommandResult {
  ok: boolean;
  command: string;
  task?: {
    id: string;
    status: string;
    statusLabel: string;
    priority: string;
    title: string;
  };
  workspace?: {
    branch?: string;
    worktree?: string;
  };
  state?: Record<string, unknown>;
  nextActions: NextAction[];
  error?: CommandError;
}

export interface NextAction {
  command: string;
  reason: string;
  safety: "safe" | "requires_human" | "doctor_only" | "blocked";
  preferred: boolean;
  stateTransition?: {
    from: string;
    to: string;
  };
}

export interface CommandError {
  code: string;
  message: string;
  handled: boolean;
  createTaskCommand?: string;
}
```

### 5.2 Human-readable output

Human-readable command output must end with:

```text
Valid next actions:
1. taskforge ...
   Reason: ...
   Safety: safe | requires_human | doctor_only | blocked
```

### 5.3 Error output

Error output must never be a dead end.

Bad:

```text
Unexpected error: branch exists
```

Good:

```text
Error: branch exists
Code: WORKTREE_BRANCH_EXISTS

Valid next actions:
1. taskforge inspect TASK-ID
   Reason: Determine whether the existing branch is the correct task branch.
   Safety: safe

2. taskforge doctor --json
   Reason: Enter diagnostic mode for inconsistent branch/worktree state.
   Safety: safe

3. taskforge new "Handle unclosed TaskForge state: branch exists during start"
   Reason: This state is not yet covered by an explicit recovery path.
   Safety: safe
```

---

## 6. Error Closure Policy

### 6.1 Known error handling

Every known error code must map to next actions.

Minimum registry:

| Error code | Next action |
|---|---|
| `TASK_NOT_FOUND` | `taskforge list --json`; create task only if missing task should exist |
| `INVALID_STATUS` | emit command valid for current status |
| `INVALID_STATUS_TRANSITION` | emit allowed transitions and commands |
| `DOCTOR_LOCKED` | `taskforge doctor --json` |
| `OUTSTANDING_TASK` | `taskforge resume TASK-ID`, `taskforge done TASK-ID`, `taskforge block TASK-ID "reason"` |
| `NEEDS_FORCE` | do not force; `taskforge doctor --json` or block for human |
| `WORKTREE_ERROR` | `taskforge inspect TASK-ID`, `taskforge doctor --json` |
| `PUSH_FAILED` | `taskforge inspect TASK-ID`, `taskforge next`, `taskforge doctor --json` |
| `VALIDATION_ERROR` | `taskforge validate-state --json`, `taskforge doctor --json` |
| `MISSING_ACCEPTANCE_CRITERIA` | `taskforge ac-check TASK-ID --json`; update task spec |
| `BLANK_ACCEPTANCE_CRITERIA` | refine acceptance criteria |
| `UNCHECKED_ACCEPTANCE_CRITERIA` | complete evidence or resume implementation |
| `GATE_FAILED` | fix/rerun, or block if unrelated |
| `AUTH_FAILURE` | block for human |
| `CONFIG_INVALID` | `taskforge config-validate --json`, `taskforge doctor --json` |
| `UNKNOWN_STATE` | create missing-state task |

### 6.2 Unknown error handling

If no mapping exists:

```bash
taskforge new "Handle unclosed TaskForge error: <CODE_OR_SUMMARY>" \
  --type Bug \
  --priority P1 \
  --status Ready \
  --body "Command: <command>

Task: <taskId if any>

State:
<serialized safe state>

Error:
<message>

Required behavior:
Add explicit invariant/state-machine handling and nextActions guidance. Agents must not bypass TaskForge."
```

---

## 7. Implementation Tasks for Agents

Create these TaskForge tasks or implement directly if already assigned.

---

### Agent Prompt 1 — Document command invariants and state machine

```markdown
# Agent Prompt: Document TaskForge Command Invariants and State Machine

You are implementing TaskForge control-plane documentation.

## Goal

Create authoritative Markdown documentation that defines:

- global invariants,
- task lifecycle invariants,
- command-level state machines,
- force restrictions,
- error closure policy,
- required next-action output contract.

## Required files

Create or update:

- `docs/architecture/command-state-machine-and-invariants.md`
- `TASKFORGE.md`
- `README.md` if command lists are stale

## Required content

The new architecture doc must include:

1. TaskForge-only control-plane rule.
2. Dedicated task-state source-of-truth rule.
3. One-active-owned-task-per-session rule.
4. Worktree isolation rule.
5. Branch/task/session consistency rule.
6. Valid status transitions.
7. Done evidence requirements.
8. Doctor lock semantics.
9. `--force` is human/doctor-only.
10. Every command must emit valid `nextActions`.
11. Unknown states must create or recommend a new TaskForge task.

## Acceptance criteria

- [ ] Documentation explicitly says agents must not use raw `git` to bypass TaskForge.
- [ ] Documentation explicitly says agents must never use `--force`.
- [ ] Documentation defines valid next actions for every CLI command.
- [ ] Documentation defines error closure behavior.
- [ ] README and TASKFORGE command lists match implemented CLI commands.
- [ ] `doctor --fix` mismatch is resolved in docs or CLI.

## Verification

Run:

```bash
taskforge validate-state --json
taskforge doctor --json
npm run typecheck
npm test
```

## Constraints

Do not use raw `git commit`, `git push`, or manual PR creation. Use:

```bash
taskforge diff TASK-ID
taskforge checkpoint TASK-ID -m "docs: define command state machine and invariants"
taskforge submit TASK-ID
taskforge pr TASK-ID
```

Never use `--force`.
```

---

### Agent Prompt 2 — Implement central command-state-machine registry

```markdown
# Agent Prompt: Implement Command State-Machine Registry

You are implementing TaskForge command-level state-machine enforcement.

## Goal

Add a central registry that defines valid preconditions, effects, valid next actions, and error recovery guidance for every CLI command.

## Required files

Likely files:

- `src/core/command-state-machine.ts`
- `src/core/next-actions.ts`
- `src/core/error-guidance.ts`
- `src/util/json-result.ts`
- tests under `tests/`

## Required design

Create these types:

```ts
export type Safety = "safe" | "requires_human" | "doctor_only" | "blocked";

export interface NextAction {
  command: string;
  reason: string;
  safety: Safety;
  preferred: boolean;
  stateTransition?: {
    from: string;
    to: string;
  };
}

export interface CommandStateRule {
  command: string;
  allowedStatuses?: string[];
  forbiddenStatuses?: string[];
  requiresTask?: boolean;
  requiresWorktree?: boolean;
  requiresNoDoctorLock?: boolean;
  forbidsAgentForce?: boolean;
  nextActions: NextAction[];
  errorActions: Record<string, NextAction[]>;
}
```

Add registry entries for all commands currently registered in `src/cli.ts`.

## Required behavior

Every command must be able to ask the registry:

```ts
getNextActions(commandName, context)
getErrorGuidance(commandName, errorCode, context)
```

## Acceptance criteria

- [ ] Registry covers every CLI command.
- [ ] Tests fail if a CLI command exists with no registry entry.
- [ ] Registry marks all force paths as human/doctor-only.
- [ ] Registry maps known error codes to valid next actions.
- [ ] Unknown error mapping returns a `taskforge new ...` missing-state task command.
- [ ] No command JSON output is missing `nextActions`.

## Verification

Run:

```bash
npm run typecheck
npm test
taskforge doctor --json
```

## Constraints

Use TaskForge git facades only:

```bash
taskforge diff TASK-ID
taskforge checkpoint TASK-ID -m "feat: add command state-machine registry"
taskforge submit TASK-ID
taskforge pr TASK-ID
```

Never use `--force`.
```

---

### Agent Prompt 3 — Add structured nextActions to all command outputs

```markdown
# Agent Prompt: Add nextActions to Every Command Result

You are implementing agent-facing guidance output.

## Goal

Every TaskForge command must return explicit valid next actions in both JSON and human-readable output.

## Required files

Likely files:

- `src/util/json-result.ts`
- `src/util/logging.ts`
- `src/core/next-actions.ts`
- all command files under `src/commands/`
- tests under `tests/`

## Required JSON shape

Extend command output to include:

```ts
nextActions: Array<{
  command: string;
  reason: string;
  safety: "safe" | "requires_human" | "doctor_only" | "blocked";
  preferred: boolean;
  stateTransition?: {
    from: string;
    to: string;
  };
}>
```

## Required human output

Every command must end with:

```text
Valid next actions:
1. taskforge ...
   Reason: ...
   Safety: ...
```

## Special cases

For errors:

- include error code,
- include whether handled,
- include next actions,
- include task creation command for unhandled states.

For `start` success:

- preferred action should be `cd <worktree>`.
- next TaskForge action should be `taskforge prompt TASK-ID` or `taskforge gates`.

For force-required cases:

- never recommend `--force` to agents.
- recommend `taskforge doctor --json` or block for human.

## Acceptance criteria

- [ ] `next --json` includes `nextActions`.
- [ ] `start --json` includes `nextActions`.
- [ ] error JSON includes `nextActions`.
- [ ] human-readable output includes valid next actions.
- [ ] tests cover representative success and failure paths.
- [ ] no output suggests normal-agent use of `--force`.

## Verification

Run:

```bash
npm run typecheck
npm test
taskforge next --json
taskforge doctor --json
```

## Constraints

Use TaskForge git facades only. Never use `--force`.
```

---

### Agent Prompt 4 — Restrict force to human and doctor mode

```markdown
# Agent Prompt: Restrict Force Operations to Human and Doctor Mode

You are implementing force-operation safety restrictions.

## Goal

Prevent normal agents from using `--force`. Force must be available only to human operators or doctor-mode recovery.

## Required behavior

Commands with force-like options must check authority before acting.

Affected commands include at least:

- `start --force`
- `unlock --force`
- `heartbeat --force`
- `cleanup --force`
- any future force/destructive option

## Required authority model

Add a small authority resolver:

```ts
export type ActorAuthority = "agent" | "human" | "doctor";

export function resolveAuthority(env: NodeJS.ProcessEnv, options: unknown): ActorAuthority;
export function assertCanForce(authority: ActorAuthority): void;
```

Suggested policy:

- default authority: `agent`
- human authority: explicit env or local interactive confirmation
- doctor authority: only inside doctor recovery execution path
- CI authority: never force unless explicitly configured for doctor recovery

## Required rejection

If agent attempts force:

```json
{
  "ok": false,
  "error": {
    "code": "FORCE_REQUIRES_HUMAN_OR_DOCTOR",
    "message": "Normal agents may not use --force."
  },
  "nextActions": [
    {
      "command": "taskforge doctor --json",
      "reason": "Diagnose whether a recovery path exists.",
      "safety": "safe",
      "preferred": true
    },
    {
      "command": "taskforge block TASK-ID \"Force operation requires human or doctor-mode authorization\" --category unsafe_operation --blocked-by human",
      "reason": "Escalate unsafe operation without bypassing TaskForge.",
      "safety": "requires_human",
      "preferred": false
    }
  ]
}
```

## Acceptance criteria

- [ ] Normal agent cannot run force operations.
- [ ] Rejection includes structured nextActions.
- [ ] Doctor mode can perform approved recovery.
- [ ] Human can perform force only through explicit authority path.
- [ ] Tests cover all force options.
- [ ] Docs and prompts say agents must never use `--force`.

## Verification

Run:

```bash
npm run typecheck
npm test
taskforge doctor --json
```

## Constraints

Never implement a bypass through raw `git`.
```

---

### Agent Prompt 5 — Implement unhandled-state closure task generation

```markdown
# Agent Prompt: Implement Unhandled-State Closure

You are implementing closure over unhandled TaskForge states.

## Goal

If TaskForge encounters an unknown state, unmapped error, unsupported status combination, or missing recovery path, it must emit or create a TaskForge task that makes the gap explicit.

## Required behavior

For any unhandled condition:

1. classify it as `UNKNOWN_STATE`, `UNMAPPED_ERROR`, `UNSUPPORTED_TRANSITION`, or `MISSING_RECOVERY_COMMAND`;
2. return a safe `taskforge new ...` command in `nextActions`;
3. optionally auto-create the task when safe and non-recursive;
4. never recommend raw `git` or manual file edits.

## Required task body

Generated closure tasks must include:

- command being run,
- task ID if any,
- status,
- branch/worktree if relevant,
- error code/message,
- observed state serialized safely,
- expected recovery behavior,
- acceptance criteria requiring new invariant/state-machine coverage.

## Acceptance criteria

- [ ] Unknown error code returns a `taskforge new` command.
- [ ] Unknown task status combination returns a closure task command.
- [ ] Missing recovery command returns a closure task command.
- [ ] Generated task is P1 Bug by default.
- [ ] System avoids infinite recursive task creation if `taskforge new` itself fails.
- [ ] Tests cover unknown error and unknown state paths.

## Verification

Run:

```bash
npm run typecheck
npm test
```

## Constraints

Do not use raw `git` to recover.
Never use `--force`.
```

---

### Agent Prompt 6 — Add CLI/documentation consistency tests

```markdown
# Agent Prompt: Add CLI Documentation Consistency Tests

You are implementing drift detection between code and documentation.

## Goal

Prevent docs from becoming inconsistent with implemented CLI commands.

## Required behavior

Add tests that verify:

- every command registered in `src/cli.ts` is listed in `README.md`;
- every command registered in `src/cli.ts` is listed or categorized in `TASKFORGE.md`;
- every command registered in `src/cli.ts` has a command-state-machine entry;
- every force option is marked human/doctor-only;
- docs do not recommend normal-agent use of `--force`;
- docs do not recommend raw git for normal agent workflow except as implementation detail or read-only diagnostics.

## Acceptance criteria

- [ ] Test fails if CLI command is undocumented.
- [ ] Test fails if documented command does not exist.
- [ ] Test fails if command-state-machine entry is missing.
- [ ] Test fails if force command lacks authority restriction.
- [ ] Test fails if agent prompt recommends raw git bypass.

## Verification

Run:

```bash
npm run typecheck
npm test
```

## Constraints

Use TaskForge git facades only.
Never use `--force`.
```

---

## 8. Master Agent Directive

Use this directive at the top of implementation-agent prompts.

```markdown
# TaskForge Agent Directive

You are operating under TaskForge control-plane rules.

You must use TaskForge as the source of truth for task state, workflow state, branch/worktree state, checkpointing, submission, PR creation, diagnostics, and cleanup.

## Mandatory startup sequence

Run:

```bash
taskforge doctor --json
taskforge validate-state --json
taskforge next --json
```

If assigned a task directly, run:

```bash
taskforge start TASK-ID
taskforge prompt TASK-ID
```

If the task is already active, run:

```bash
taskforge resume TASK-ID
taskforge inspect TASK-ID
```

## Forbidden

Do not use raw `git` to bypass TaskForge.

Do not run:

```bash
git checkout
git switch
git worktree add
git commit
git push
gh pr create
```

Use TaskForge instead:

```bash
taskforge diff TASK-ID
taskforge checkpoint TASK-ID -m "message"
taskforge submit TASK-ID
taskforge pr TASK-ID
```

## Force restriction

Never use `--force`.

If force appears necessary:

```bash
taskforge doctor --json
taskforge block TASK-ID "Force operation requires human or doctor-mode authorization" --category unsafe_operation --blocked-by human
```

## Unknown state rule

If TaskForge does not provide a valid next action, create a closure task:

```bash
taskforge new "Handle unclosed TaskForge state: <summary>" --type Bug --priority P1 --status Ready --body "<details>"
```

## End-of-work sequence

Before ending, run:

```bash
taskforge diff TASK-ID
taskforge gates
taskforge checkpoint TASK-ID -m "..."
taskforge submit TASK-ID
taskforge pr TASK-ID
taskforge report TASK-ID --complete
```

Only mark done when acceptance criteria and review/verification requirements are satisfied:

```bash
taskforge done TASK-ID
```
```

---

## 9. Recommended Implementation Order

1. **Document invariants/state machines.**
2. **Add force authority restriction.**
3. **Add command-state-machine registry.**
4. **Add `nextActions` output to all command results.**
5. **Add unhandled-state closure task generation.**
6. **Add CLI/docs/state-machine consistency tests.**
7. **Resolve `doctor --fix` CLI/doc mismatch.**
8. **Make `doctor --fix` human/doctor-only.**

---

## 10. Definition of Complete

This control-plane closure effort is complete when:

- agents receive valid next TaskForge actions after every command;
- no normal-agent output recommends raw git bypass;
- no normal-agent output recommends `--force`;
- every command is documented;
- every command has a command-state-machine entry;
- every known error code maps to recovery guidance;
- every unknown state creates or recommends a TaskForge task;
- doctor mode is the only automated recovery authority;
- human intervention is the only non-doctor escape hatch.
