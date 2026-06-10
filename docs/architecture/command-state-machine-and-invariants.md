# Command State Machines and Invariants

This document defines the complete command-state contract for TaskForge as the mandatory control plane. All agents must follow these invariants.

## 1. TaskForge-Only Control Plane

Agents must not use raw `git` to bypass TaskForge. All task-state mutations flow through the TaskForge CLI or transaction layer.

- **Forbidden**: `git commit`, `git push`, `git branch -D`, `git worktree remove`, manual edits to `../task-state/*.md`
- **Required**: `taskforge checkpoint`, `taskforge submit`, `taskforge done --cleanup`, `taskforge done --delete-branch`
- **Exception**: Doctor agents may use selected git commands under doctor protocol
- **Workflow contract**: `docs/workflow.md` is the canonical operator guide for humans and agents.

## 2. Dedicated Task-State Source of Truth (G1)

Task files live on a dedicated `task-state` git branch, not on `main`. The `task-state` branch is the single source of truth.

- **Location**: A git worktree at `../task-state/` (sibling to the main repo)
- **Access**: All agents read from and write to `../task-state/` via the transaction layer
- **Sync**: Every mutation is auto-committed and auto-pushed through `withTaskStateTransaction()`

## 3. One-Active-Owned-Task-Per-Session (G2)

Each agent session (identified by a 10-char hex session ID) may own at most one In Progress task at a time.

- `taskforge next` and `taskforge start` check `checkOutstandingSessionTasks()` before proceeding
- If an outstanding task exists, the agent must complete or release it first

## 4. Worktree Isolation (G3)

Each task runs in an isolated git worktree on its own branch.

- Worktree path: `../worktrees/<project>/TASK-NNN`
- Branch pattern: `agent/TASK-NNN-<slug>--<session-id>`
- Agents work only in their task's worktree, never on `main` or other branches

## 5. Branch/Task/Session Consistency (G4)

The branch name encodes the task ID and session ID. The task file's `assignee` field must match the session ID extracted from the branch.

- `assertTaskOwnership()` verifies this invariant before `taskforge done`
- Mismatch indicates either a stale claim or a session recovery issue

## 6. Valid Status Transitions (G5)

The authoritative transition map lives in `src/core/status-transition.ts`.
Only these transitions are allowed:

| From | To |
|------|-----|
| Inbox | Needs Spec, Rejected |
| Needs Spec | Ready, Deferred |
| Ready | In Progress, Blocked, Deferred |
| In Progress | Review, Verify, Blocked, Deferred |
| Blocked | Ready, In Progress |
| Review | In Progress, Verify, Done |
| Verify | In Progress, Review, Done |
| Done | In Progress (explicit reopen/recovery only) |
| Rejected | none (terminal) |
| Deferred | Ready |

**Special case — `release` command**: `taskforge release` transitions In Progress → Ready by calling `updateTaskStatus()` directly, bypassing `validateTransition()`. This is intentional: release is a voluntary claim surrender, not a standard progression.

## 7. Done Evidence Requirements (G7)

A task may become Done only when ALL of the following are true:

### Acceptance Criteria
- `## Acceptance Criteria` section exists in the task body
- Criteria items are not blank
- All criteria are checked off (`- [x]`) with explicit evidence, or explicitly excepted

### Verification Gates
- Verification gates were run and passed (typecheck, lint, build, test), or an exception is recorded

### Worktree State
- Worktree is clean (no uncommitted files) — checked via `getWorktreeDirtyFiles()`
- Branch is pushed (no unpushed commits) — checked via `getBranchCommitsAhead()`
- Code is checkpointed if code changed
- Branch is submitted if code changed

### Ownership & Context
- Ownership matches current session — checked via `assertTaskOwnership()`
- Control files (AGENTS.md, TASKFORGE.md, etc.) unchanged since task start — checked via `hashControlFiles()` / `context_hash`

### Deliverables
- Report exists (generated via `taskforge report`)
- Task notes updated via `appendAgentNote()`
- PR merged or deliverable accepted

### Implementation
The `doneStateMachine` in `command-states.ts` enforces these checks in order:
1. `invalid_transition` — `validateTransition()` from current status to Done
2. `gates_failed` — gates must pass
3. `ownership_mismatch` — session must own the task
4. `worktree_dirty` — no uncommitted files
5. `branch_unpushed` — no unpushed commits
6. `control_file_changed` — `context_hash` must match
7. `ac_missing` — acceptance criteria section must exist
8. `ac_blank` — no blank criteria items
9. `ac_unchecked` — all criteria must be checked

**Note**: `done --force` is not implemented in `done.ts` or the CLI and must not appear in normal-agent recovery guidance.

## 8. Doctor Lock Semantics (G8)

`TASKFORGE_ACTOR=doctor taskforge doctor --lock --reason "..."` creates a `.doctor-lock` file that pauses all agents during system recovery.

- All normal agents pause (doctor-lock blocks `next`, `claim`, `start`)
- Doctor agent works the recovery task
- `taskforge doctor --fix --json` applies automatic repairs where available
- `taskforge agents --recover --json` marks stale registry entries as crashed
- Release `.doctor-lock` only after `taskforge validate-state --strict --json` passes
- If a recovery task exists, `taskforge done TASK-ID` removes the lock; otherwise a doctor or human may remove the lock as an audited recovery action

## 9. Force Is Human/Doctor-Only (Gap B)

`--force` is restricted to human operators (`TASKFORGE_ACTOR=human`) and doctor-mode recovery (`TASKFORGE_ACTOR=doctor`).

- Normal agents (`TASKFORGE_ACTOR` unset or `agent`) may never use `--force`
- Every `--force` path that requires elevated authority is gated by `assertCanForce()` in `authority.ts`
- Authority is resolved via `resolveAuthority()`: checks `TASKFORGE_ACTOR` env var, defaults to `"agent"`

### Force paths gated by `assertCanForce()`

| Command | Force Path | Required Authority |
|---------|-----------|-------------------|
| `start --force` | Override stale claim | human, doctor |
| `claim --force` | Override stale claim | human, doctor |
| `unlock --force` | Release another session's lock | human, doctor |
| `cleanup --force` | Skip all safety checks | human, doctor |
| `heartbeat --force` | Skip ownership verification | human, doctor |
| `sweep --force` | Skip worktree classification | human, doctor |

### Force-like options NOT gated by `assertCanForce()`

| Command | Option | Notes |
|---------|--------|-------|
| `init --force` | Recreate missing files | No authority check — safe idempotent operation |
| `done --force` | Bypass gate failures | Not implemented; do not recommend to normal agents |

## 10. Every Command Emits `nextActions` (G9)

Every CLI command returns structured `validNextCommands` in JSON output and human-readable guidance.

- `validNextCommands` is an array of `{ command, purpose, when, allowedFor, priority }` objects
- `allowedFor` values are `all`, `agent`, `human`, and `doctor`
- Commands use state machines (`command-states.ts`) to determine next actions

## 11. Unknown States Create Closure Tasks (G10)

When a command encounters an unhandled state, it directs the agent to create a new task and request human input.

- `unhandledError()` in `command-states.ts` returns `create_task_for_error` + `request_human_input`
- Agents must not guess or proceed without clear guidance

## 12. Command-Level State Machines

Core lifecycle commands use state machines from `command-states.ts`.
Not all CLI commands have state machines yet — commands without one rely on direct error throwing and manual guidance.

### Commands with state machines

| Command | State Machine | Key States |
|---------|--------------|------------|
| `next` | `nextStateMachine` | task_selected, no_tasks, no_actionable_tasks, uncommitted_changes, current_task_blocked, doctor_locked, outstanding_task |
| `claim` | `claimStateMachine` | task_claimed, task_not_found, invalid_status, already_claimed, push_failed, doctor_locked, outstanding_task |
| `start` | `startStateMachine` | task_started, task_not_found, invalid_status, already_assigned, push_failed, worktree_failed, doctor_locked, outstanding_task |
| `checkpoint` | `checkpointStateMachine` | changes_committed, no_changes, commit_failed, not_in_worktree |
| `gates` | `gatesStateMachine` | all_passed, some_failed, no_gates |
| `submit` | `submitStateMachine` | pr_created, pr_failed, pr_manual, no_changes |
| `done` | `doneStateMachine` | task_done, invalid_transition, gates_failed, ownership_mismatch, control_file_changed, ac_missing, ac_blank, ac_unchecked, worktree_dirty, branch_unpushed |
| `new` | `newStateMachine` | task_created, push_failed, write_failed |

### Commands without state machines (known gap)

`block`, `report`, `release`, `reject`, `cleanup`, `heartbeat`, `sweep`, `unlock`, `doctor`, `list`, `status`, `summary`, `sync`, `prompt`, `resume`, `config-validate`, `validate-state`, `audit`, `transcript`, `timeline`, `ac-check`, `diff`, `pr`, `init`, `deps scan`, `deps audit`, `deps outdated`, `deps deprecated`, `deps plan`, `deps create-tasks`, `deps pr`, `deps summary`

## 13. Error Closure Policy

### Known Error Codes

Error codes emitted by state machines in `command-states.ts` and commands:

| Code | Source | Recovery |
|------|--------|----------|
| `TASK_NOT_FOUND` | `claimStateMachine`, `startStateMachine` | Verify task ID, request human input |
| `INVALID_STATUS` | `claimStateMachine`, `startStateMachine` | Request human input to correct status |
| `ALREADY_CLAIMED` | `claimStateMachine` | Use `--force` (human/doctor only) or block |
| `ALREADY_ASSIGNED` | `startStateMachine` | Use `--force` (human/doctor only) or block |
| `PUSH_FAILED` | `claimStateMachine`, `startStateMachine`, `newStateMachine` | Retry after brief wait, or `taskforge next` |
| `WORKTREE_FAILED` | `startStateMachine` | Request human input to resolve worktree issue |
| `OUTSTANDING_TASK` | `nextStateMachine`, `claimStateMachine`, `startStateMachine` | Complete or release current task |
| `DOCTOR_LOCKED` | `nextStateMachine`, `claimStateMachine`, `startStateMachine` | Wait for recovery |
| `UNCOMMITTED_CHANGES` | `nextStateMachine` | Complete current task before proceeding |
| `UNCOMMITTED_BLOCKED_TASK` | `nextStateMachine` | Commit changes, then find resolving task |
| `NO_TASKS` | `nextStateMachine` | Run `taskforge init` or request human input |
| `NO_ACTIONABLE_TASKS` | `nextStateMachine` | Request human input to prioritize work |
| `NO_CHANGES` | `checkpointStateMachine`, `submitStateMachine` | Continue working, then retry |
| `COMMIT_FAILED` | `checkpointStateMachine` | Request human input |
| `NOT_IN_WORKTREE` | `checkpointStateMachine` | Run `taskforge resume TASK-ID` for existing tasks or `taskforge start TASK-ID` for Ready tasks |
| `GATE_FAILURE` | `gatesStateMachine` | Fix issues, re-run `taskforge gates` |
| `PR_FAILED` | `submitStateMachine` | Request human input |
| `INVALID_TRANSITION` | `doneStateMachine` | Request human input to correct status |
| `GATES_FAILED` | `doneStateMachine` | Fix issues and re-run gates; do not use `done --force` |
| `OWNERSHIP_MISMATCH` | `doneStateMachine` | Request human input |
| `CONTROL_FILE_CHANGED` / `CONTEXT_CHANGED` | `doneStateMachine` | Re-read control files, verify compliance |
| `WORKTREE_DIRTY` | `doneStateMachine` | `taskforge checkpoint`, then retry |
| `BRANCH_UNPUSHED` | `doneStateMachine` | `taskforge submit`, then retry |
| `MISSING_ACCEPTANCE_CRITERIA` | `doneStateMachine` | Add AC section to task file |
| `BLANK_ACCEPTANCE_CRITERIA` | `doneStateMachine` | Replace blank checkboxes with verifiable conditions |
| `UNCHECKED_ACCEPTANCE_CRITERIA` | `doneStateMachine` | Check off each criterion with evidence |
| `WRITE_FAILED` | `newStateMachine` | Request human input |
| `UNHANDLED_ERROR` | `unhandledError()` | Create task for error, request human input |
| `FORCE_REQUIRES_HUMAN_OR_DOCTOR` | `authority.ts` | Use `taskforge doctor` or block for human |

### Unknown Errors

When an error code cannot be cleanly inferred:
1. Create a new task describing the unexpected state
2. Request human input via `taskforge block` with category `unsafe_operation`

## 14. Force Restrictions

Every `--force` path gated by `assertCanForce()` and its required authority:

| Command | Force Path | Required Authority |
|---------|-----------|-------------------|
| `start --force` | Override stale claim | human, doctor |
| `claim --force` | Override stale claim | human, doctor |
| `unlock --force` | Release another session's lock | human, doctor |
| `cleanup --force` | Skip safety checks | human, doctor |
| `heartbeat --force` | Skip ownership verification | human, doctor |
| `sweep --force` | Skip worktree classification | human, doctor |

**Normal agents may never use `--force`.** Any attempt results in `FORCE_REQUIRES_HUMAN_OR_DOCTOR` error, which directs the agent to `taskforge doctor --json` or `taskforge block` with category `unsafe_operation`.

**Note**: `done --force` is not implemented. Documentation and command guidance must not present it as a normal recovery path.

## CLI Command Registry

All commands registered in `src/cli.ts`:

| Command | Description |
|---------|-------------|
| `init` | Initialize TaskForge in this repository |
| `next` | Return the highest-priority safe task to continue |
| `start <taskId>` | Set up worktree, branch, and begin a task |
| `status` | Show project status summary |
| `summary` | Show full project summary with recommended next action |
| `gates` | Run configured verification gates |
| `block <taskId> <reason>` | Mark a task as blocked with a reason |
| `done <taskId>` | Mark a task as done |
| `sync` | Sync with external issue tracker |
| `list` | List and filter tasks |
| `promote <taskId>` | Advance a task through the status state machine |
| `unlock <taskId>` | Manually unlock a task (requires --force) |
| `sweep` | Sweeper Protocol: recover stale in-progress tasks |
| `heartbeat <taskId>` | Extend the lease on an In Progress task |
| `agents` | List and recover distributed agent registry entries |
| `inspect <taskId>` | Inspect task worktree and branch state |
| `claim <taskId>` | Claim a task without creating a worktree |
| `report <taskId>` | Generate a structured completion report |
| `cleanup <taskId>` | Remove task worktree and branch with safety checks |
| `new <title>` | Create a new task file with auto-incremented ID |
| `prompt <taskId>` | Emit a complete agent execution packet |
| `resume <taskId>` | Re-enter an existing task workspace |
| `doctor` | Run diagnostic checks on repo and task-state health |
| `config-validate` | Validate .taskforge/config.json |
| `release <taskId>` | Voluntarily release a task claim |
| `reject <taskId> <reason>` | Mark a task as rejected |
| `validate-state` | Validate task-state for invariant violations |
| `audit <taskId>` | Show audit events for a task |
| `transcript <taskId>` | Show readable transcript for a task |
| `timeline <taskId>` | Show event timeline summary for a task |
| `ac-check [taskId]` | Scan task files for acceptance criteria issues |
| `diff <taskId>` | Show current worktree diff for a task |
| `checkpoint <taskId>` | Create a commit on the task branch |
| `submit <taskId>` | Push the task branch |
| `pr <taskId>` | Create a PR for the task |
| `mcp` | Start a Model Context Protocol server |
| `guard` | Manage mutation-boundary overrides |
| `deps scan` | Run broad dependency health checks |
| `deps audit` | Run package-manager-native audit |
| `deps outdated` | Report outdated direct dependencies |
| `deps deprecated` | Check for deprecated packages |
| `deps plan` | Produce a dependency remediation plan |
| `deps create-tasks` | Create TaskForge dependency tasks from findings |
| `deps pr` | Create focused dependency update PRs |
| `deps summary` | Produce a dependency health summary |

## Related Tasks

- **TASK-216**: Define and implement command state machines for agentic workflow (Ready)
- **TASK-222**: Refactor command-state-machine registry to spec shape with full command coverage (Ready)
- **TASK-224**: Implement unhandled-state closure task generation (Ready)
- **TASK-226**: Resolve doctor --fix CLI/doc mismatch and restrict to human/doctor authority (implemented; keep docs aligned)
- **TASK-228**: Historical proposal for done force handling; current workflow does not implement or recommend `done --force`
