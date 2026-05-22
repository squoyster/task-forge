# TaskForge Combined Architecture Review and Agentic Prompts

Generated: 2026-05-22 09:12:21 UTC

## Contents

1. [TaskForge Architecture Gap Analysis](#section-1-taskforge-architecture-gap-analysis)
2. [Sweeper Auto-Invocation Prompt](#section-2-sweeper-auto-invocation-prompt)
3. [Lifecycle JSON Contracts Prompt](#section-3-lifecycle-json-contracts-prompt)
4. [Control-Plane Hardening Task-Creation Prompt](#section-4-control-plane-hardening-task-creation-prompt)
5. [Control-Plane Hardening With Doctor Mode Prompt](#section-5-control-plane-hardening-with-doctor-mode-prompt)
6. [Post-Doctor Resume Policy Prompt](#section-6-post-doctor-resume-policy-prompt)

---

<a id="section-1-taskforge-architecture-gap-analysis"></a>

# Section 1: TaskForge Architecture Gap Analysis

# TaskForge Architecture Evaluation and Agent-CLI Gap Analysis

## Interpretation

This evaluates **TaskForge as an agent-facing control plane for coding work**, not just as a human task tracker. The analysis is based on the project Markdown/task specs provided, especially `AGENTS.md`, `README.md`, `TASKFORGE.md`, `CHANGELOG.md`, and the task files through `TASK-015`.

---

## 1. Architectural Evaluation

### Overall Verdict

**Good core architecture.** TaskForge has the right primitives for agentic coding:

```text
task-state branch = shared control plane
task Markdown = execution contract
worktree = isolation boundary
branch = code-change boundary
PR/review = integration boundary
verification gates = quality boundary
```

This is substantially better than keeping task state inside each worktree. Moving task files to a dedicated `task-state` branch solves the major failure mode where agents operate from stale snapshots.

The project is close to a usable “agent work dispatcher,” but still needs stronger **machine contracts**, **lifecycle enforcement**, **recovery semantics**, and **agent command ergonomics**.

---

## Strengths

### A. Correct Use of Git Worktrees

Using per-task worktrees is the right default.

| Property | Result |
|---|---|
| Isolated filesystem | Multiple agents can work simultaneously |
| Separate branches | Low merge contamination |
| Stable main checkout | Human/operator can inspect repo safely |
| Easy cleanup | `git worktree remove` maps cleanly to task lifecycle |

This fits OpenCode-style execution well.

---

### B. Dedicated `task-state` Branch Is the Key Architectural Improvement

The `task-state` branch solves a real defect in the earlier design:

```text
Problem:
agent worktree = snapshot of main
new tasks added later = invisible to existing worktree

Fix:
../task-state = shared sibling worktree
all agents can read current task state
```

This is the right direction. It turns task files into a repo-local distributed state store.

---

### C. Markdown Task Specs Are Appropriate

Markdown + YAML frontmatter gives:

| Layer | Purpose |
|---|---|
| Frontmatter | machine-readable state |
| Markdown body | human/agent-readable execution contract |
| Agent Notes | audit trail |
| Acceptance Criteria | deterministic completion target |

That is the right hybrid format for agentic software work.

---

### D. Existing Task Breakdown Shows Good Incremental Architecture

The task history is coherent:

```text
TASK-003/004: JSON output
TASK-005: cleanup lifecycle
TASK-006: dependencies
TASK-008: command tests
TASK-010: list/search/filter
TASK-012: locking
TASK-013: task-state branch
TASK-014: sweeper
TASK-015: optimistic concurrency
```

That is a rational build sequence.

---

## Weaknesses / Risks

### 1. Status Casing Appears Inconsistent

Docs use statuses like:

```text
Ready
In Progress
Done
```

But the sweeper text says:

```text
status: in_progress
```

This is not cosmetic. It can break automation.

**Recommendation:** choose one canonical internal enum.

Prefer frontmatter-safe machine values:

```yaml
status: ready
status: in_progress
status: blocked
status: review
status: verify
status: done
```

Then render human labels in CLI output:

```text
In Progress
Needs Spec
```

If changing now is too disruptive, create a normalization layer and enforce canonical output on write.

---

### 2. Current Task Specs Are Stale Relative to the New Architecture

`README.md` still says:

```text
tasks/ # Repo-native task specifications
```

But `TASKFORGE.md` says `tasks/` on main is no longer authoritative.

That creates agent confusion. Agents will read both and may modify the wrong directory.

**Fix:** update `README.md` and `tasks/README.md` to state clearly:

```text
tasks/ on main is legacy/backward-compatible only.
Authoritative task state lives in ../task-state.
Agents must never create or update main/tasks/*.md except migration/docs tasks.
```

---

### 3. Lock Semantics Are Underspecified After Rename

Current lock fields:

```yaml
assignee: f4539169a5
claimed_at: '2026-05-22 02:20:22'
```

That is minimally sufficient, but not ideal.

You are using `assignee` as a **session GUID**, not a human/agent identity. That naming is slightly misleading.

Better model:

```yaml
assignee: agent:implementer
session: f4539169a5
claimed_at: '2026-05-22 02:20:22'
lease_expires_at: '2026-05-22 06:20:22'
```

Minimal improvement:

```yaml
assignee: f4539169a5
claimed_at: '...'
```

works, but then document that `assignee` means **session owner**, not durable role/person ownership.

---

### 4. Sweeper May Destroy Useful State Unless It Checks Worktrees

The current sweeper protocol says:

```text
If claimed_at > 4 hours old:
  reset status Ready
  clear assignee/claimed_at
```

This is dangerous unless it checks the corresponding worktree/branch.

A stale lock can mean:

| Case | Correct behavior |
|---|---|
| Agent crashed before editing | reset to Ready |
| Agent has dirty worktree | do not reset blindly; mark `stale_dirty` |
| Agent committed but did not mark done | mark Review or Stale Review |
| Branch missing | reset to Ready |
| Worktree missing | reset to Ready |
| Worktree clean and no unique commits | reset to Ready |

The sweeper should classify, not just unlock.

---

### 5. Auto-Commit + Auto-Push Needs Conflict Discipline

The design says every mutation commits and pushes immediately. Good.

But `task-state` is effectively a distributed state database. That means writes need:

```text
pull/rebase before write
atomic-ish write
commit
push
retry on non-fast-forward
re-read after conflict
```

`TASK-015` addresses this. Until `TASK-015` is done, multi-agent claims are race-prone.

---

### 6. `Done` Semantics Are Too Weak

Current flow:

```text
taskforge done TASK-123
```

But “done” should mean more than “agent says done.”

For agentic work, split:

```text
In Progress -> Review -> Verify -> Done
```

Recommended:

| Command | Meaning |
|---|---|
| `taskforge complete TASK-123` | agent believes implementation is done; move to Review |
| `taskforge verify TASK-123` | gates pass; move to Verify or Review |
| `taskforge done TASK-123` | final accepted/merged state |

Or preserve `done`, but make it enforce gates.

---

# 2. Gap Analysis for Agent-Usable CLI

## Critical Gaps

---

## Gap 1 — Need a First-Class `claim` Command

Right now `start` appears to claim + create worktree + branch.

That is convenient, but agents often need separate phases:

```bash
taskforge next --json
taskforge claim TASK-014 --json
taskforge start TASK-014 --json
```

Recommended separation:

| Command | Responsibility |
|---|---|
| `next` | identify candidate task |
| `claim` | mutate task-state only |
| `start` | create/resume worktree/branch |
| `resume` | re-enter existing task workspace |
| `release` | voluntarily unclaim task |
| `sweep` | recover dead claims |

`start` can still call `claim` internally, but `claim` should exist as a primitive.

---

## Gap 2 — Need `--json` Everywhere Agents Touch

Current completed tasks mention JSON for `status`, `summary`, and `list`.

Agent-facing commands also need JSON:

```bash
taskforge next --json
taskforge start TASK-014 --json
taskforge claim TASK-014 --json
taskforge done TASK-014 --json
taskforge block TASK-014 --json
taskforge sweep --json
taskforge gates --json
```

Required JSON contract example:

```json
{
  "ok": true,
  "task": {
    "id": "TASK-014",
    "status": "in_progress",
    "priority": "P1",
    "title": "Sweeper Protocol — Deadlock Recovery for Stale Agent Locks"
  },
  "workspace": {
    "branch": "agent/TASK-014-sweeper-protocol--abc123def0",
    "worktree": "../worktrees/TASK-014"
  },
  "next": {
    "command": "cd ../worktrees/TASK-014 && npm install"
  }
}
```

No colored text. No log decorations. No mixed stderr/stdout except errors.

---

## Gap 3 — Need a `gates` Command

The docs define verification gates, but the CLI should own them:

```bash
taskforge gates
taskforge gates --json
taskforge gates --only typecheck,lint,test
```

Backed by config:

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

Result should be persisted to task notes or a report file:

```text
../task-state/reports/TASK-014-gates.json
```

Without this, every agent has to infer and manually run gates.

---

## Gap 4 — Need a Durable Event Log

Agent Notes in Markdown are useful, but not enough as the machine audit log.

Add NDJSON events:

```text
../task-state/events/TASK-014.ndjson
```

Events:

```json
{"ts":"2026-05-21T23:00:00Z","actor":"agent:implementer","event":"claimed","session":"abc123def0"}
{"ts":"2026-05-21T23:03:00Z","actor":"agent:implementer","event":"worktree_created","path":"../worktrees/TASK-014"}
{"ts":"2026-05-21T23:21:00Z","actor":"agent:implementer","event":"gates_passed"}
```

This makes recovery, review, and debugging much easier.

---

## Gap 5 — Need Explicit Heartbeat / Lease Refresh

The 4-hour sweeper rule assumes agents periodically update `claimed_at`.

There should be a command:

```bash
taskforge heartbeat TASK-014
```

or:

```bash
taskforge touch TASK-014
```

This updates:

```yaml
claimed_at: 'current UTC'
```

Potentially:

```yaml
lease_expires_at: 'current UTC + 4h'
```

Agents can call it after major milestones.

---

## Gap 6 — Need Stronger Blocked Protocol

Current task files have:

```yaml
humanInterventionRequired: false
```

But blocking needs structured detail:

```yaml
status: Blocked
blocked_reason: "Need decision on whether sweep may reset dirty worktrees"
blocked_by: human
blocked_since: '2026-05-22 04:00:00'
```

CLI:

```bash
taskforge block TASK-014 \
  --reason "Need decision on dirty worktree behavior" \
  --requires-human \
  --json
```

Useful blocker categories:

| Category | Meaning |
|---|---|
| `human_decision` | policy/product choice |
| `test_failure` | agent cannot resolve after attempts |
| `merge_conflict` | conflict requires owner judgment |
| `missing_secret` | credentials/token unavailable |
| `unsafe_operation` | destructive operation requires approval |
| `ambiguous_spec` | acceptance criteria insufficient |

---

## Gap 7 — Need Worktree State Inspection

Agents and sweepers need a reliable way to inspect active work.

Add:

```bash
taskforge worktrees --json
taskforge inspect TASK-014 --json
```

Should report:

```json
{
  "taskId": "TASK-014",
  "worktreeExists": true,
  "branchExists": true,
  "dirty": false,
  "aheadOfMain": 2,
  "behindMain": 0,
  "lastCommit": "abc123",
  "claimStale": false
}
```

This is essential before sweep cleanup or marking work as abandoned.

---

## Gap 8 — Need Safe Cleanup Semantics

`done --cleanup` is useful, but cleanup should refuse dangerous states unless forced.

Rules:

| State | Default cleanup behavior |
|---|---|
| clean worktree, merged branch | remove |
| dirty worktree | refuse |
| branch ahead of main | refuse unless `--force` |
| branch not pushed | refuse unless `--force` |
| unknown task branch | refuse |

Add:

```bash
taskforge cleanup TASK-014 --dry-run
taskforge cleanup TASK-014 --apply
```

Default should be dry-run or conservative.

---

## Gap 9 — Need Generated Agent Prompt / Context Command

For coding agents, the CLI should emit a complete task execution packet.

```bash
taskforge prompt TASK-014
taskforge prompt TASK-014 --json
taskforge prompt TASK-014 --agent opencode
```

Output should include:

```text
task body
scope
acceptance criteria
allowed/disallowed files
verification command
current branch/worktree
project conventions from AGENTS.md
relevant architecture snippets
```

This avoids agents missing important instructions.

---

## Gap 10 — Need `finish` / `report` Command

At the end of work, the agent should produce a structured result.

```bash
taskforge report TASK-014 --json
taskforge finish TASK-014 --json
```

Report contents:

```json
{
  "taskId": "TASK-014",
  "status": "review",
  "changedFiles": [],
  "commits": [],
  "gates": {
    "typecheck": "pass",
    "lint": "pass",
    "build": "pass",
    "test": "pass"
  },
  "risks": [],
  "humanReviewNeeded": false
}
```

---

# Recommended Command Surface

## Minimum Viable Agent-Safe CLI

```bash
taskforge next --json
taskforge claim TASK-014 --json
taskforge start TASK-014 --json
taskforge show TASK-014 --json
taskforge heartbeat TASK-014 --json
taskforge gates --json
taskforge block TASK-014 --reason "..." --json
taskforge complete TASK-014 --json
taskforge report TASK-014 --json
taskforge sweep --json
taskforge inspect TASK-014 --json
taskforge cleanup TASK-014 --dry-run --json
```

## Human / Operator Commands

```bash
taskforge status
taskforge summary
taskforge list
taskforge unlock TASK-014 --force
taskforge cleanup TASK-014 --apply
taskforge sync
```

---

# Recommended Implementation Priorities

## P0 — Correctness Blockers

| Priority | Task |
|---|---|
| P0 | Normalize status enum casing |
| P0 | Update README/tasks docs to mark `../task-state` authoritative |
| P0 | Finish TASK-014 sweeper |
| P0 | Finish TASK-015 jittered optimistic concurrency |
| P0 | Add JSON output to all lifecycle commands |

---

## P1 — Agent Control Plane Maturity

| Priority | Task |
|---|---|
| P1 | Add `claim` as separate primitive |
| P1 | Add `heartbeat` / lease refresh |
| P1 | Add `gates` command |
| P1 | Add `inspect` command for worktree/branch/task state |
| P1 | Add structured blocker fields and flags |
| P1 | Add dry-run/apply sweep behavior |

---

## P2 — Review and Integration

| Priority | Task |
|---|---|
| P2 | Add `complete` / `review` transition separate from `done` |
| P2 | Add `report` command |
| P2 | Add event log NDJSON |
| P2 | Add merge policy config |
| P2 | Add cleanup safety checks |

---

## P3 — Agent Ergonomics

| Priority | Task |
|---|---|
| P3 | Add `prompt TASK-ID` command |
| P3 | Add `resume` command |
| P3 | Add `doctor` command for repo/task-state health |
| P3 | Add `config validate` |
| P3 | Add generated shell snippets for OpenCode usage |

---

# Concrete New Tasks to Add

## TASK-016: Normalize Task Status Values

**Goal:** enforce one canonical machine enum for statuses.

Acceptance criteria:

```text
- Status schema has canonical internal values
- Legacy status strings are parsed and normalized
- All writes emit canonical values
- CLI renders human labels separately
- Tests cover old and new formats
```

---

## TASK-017: Add Lifecycle JSON Contracts

**Goal:** every agent-facing command supports `--json`.

Commands:

```text
next
start
claim
done
block
unlock
sweep
inspect
gates
```

Acceptance criteria:

```text
- JSON output contains no log decorations
- Errors produce structured JSON when --json is passed
- Tests cover stdout purity
```

---

## TASK-018: Add `gates` Command

**Goal:** CLI owns verification.

Acceptance criteria:

```text
- Reads gates from config
- Runs gates in current worktree
- Emits JSON result
- Appends result to Agent Notes or report file
- Refuses Done unless gates passed, unless --force
```

---

## TASK-019: Add Heartbeat / Lease Refresh

**Goal:** prevent long-running valid work from being swept.

Acceptance criteria:

```text
- taskforge heartbeat TASK-ID updates claimed_at
- Requires ownership/session match unless --force
- Auto-commits and pushes task-state
- JSON output supported
```

---

## TASK-020: Add Worktree Inspection

**Goal:** allow sweep/cleanup/review to classify task state safely.

Acceptance criteria:

```text
- Detects worktree exists/missing
- Detects branch exists/missing
- Detects dirty files
- Detects commits ahead/behind base
- JSON output supported
```

---

# Bottom Line

TaskForge’s architecture is sound. The most important design choice—moving task state to a dedicated sibling `task-state` worktree—is correct.

The main gaps are not conceptual. They are **control-plane hardening**:

```text
canonical schemas
JSON contracts
claim/heartbeat/sweep semantics
gate execution
worktree inspection
structured blockers
event logs
safe cleanup
```

Once `TASK-014` and `TASK-015` are complete, the next highest-leverage work is:

```text
1. normalize statuses
2. add lifecycle --json everywhere
3. add gates command
4. add heartbeat
5. add inspect/report commands
```

At that point, the CLI becomes usable as a reliable substrate for OpenCode or other agents to implement changes without constant babysitting.

---

<a id="section-2-sweeper-auto-invocation-prompt"></a>

# Section 2: Sweeper Auto-Invocation Prompt

# Agentic Task Prompt: Fix Missed Sweeper Auto-Invocation Before `next` and `start`

## Task Name

**TASK-017: Run Sweeper Automatically Before Task Selection and Claiming**

## Objective

Fix the incomplete implementation of the Sweeper Protocol.

TaskForge already has a `taskforge sweep` command and stale-claim recovery logic, but the implementation missed a critical part of the documented protocol: the sweeper must run automatically before agents search for work and before agents attempt to start/claim a task.

This task should refactor the sweeper into reusable core logic and call it from both `taskforge next` and `taskforge start`.

## What Was Missed

The TaskForge specification says the Sweeper Protocol should run automatically before any agent searches for new work:

> This protocol runs automatically inside `taskforge start` and `taskforge next`, and can also be invoked explicitly via `taskforge sweep`.

However, the current code does not satisfy that requirement.

### Current `cmdNext()` problem

`src/commands/next.ts` currently loads tasks and selects the next task directly:

```ts
const tasks = loadAllTasks();
const next = selectNextTask(tasks);
```

It does **not** run the sweeper first.

This means stale `In Progress` tasks remain stale and may block work selection.

### Current `cmdStart()` problem

`src/commands/start.ts` currently loads the target task immediately:

```ts
const task = loadTaskById(taskId);
```

It then validates status, creates a worktree, updates lock fields, and pushes state.

It does **not** run the sweeper before loading/claiming the task.

This means an agent may fail to start a task that should have been recovered first.

### Current `cmdSweep()` limitation

`src/commands/sweep.ts` contains the sweep logic directly inside the CLI command. This makes it awkward to reuse safely from `next` and `start`.

The correct design is to move the core sweep behavior into a reusable core module and have all three commands call that shared logic.

## Architectural Intent

The Sweeper Protocol is part of the TaskForge control plane. It is not just a manual maintenance command.

Before an agent asks “what should I do next?” or “start this task,” TaskForge must first recover stale claims so the scheduler and lifecycle logic operate on current state.

The intended flow is:

```text
taskforge next
  -> sweep stale claims
  -> reload task state
  -> select next actionable task

taskforge start TASK-123
  -> sweep stale claims
  -> reload TASK-123
  -> validate status / ownership
  -> claim / create worktree / push task-state

taskforge sweep
  -> run same reusable sweep logic
  -> print human-readable result
```

## Required Design

Do **not** make `next.ts` and `start.ts` import and call `cmdSweep()` directly.

Instead, extract reusable logic into a core module, preferably:

```text
src/core/sweeper.ts
```

The CLI command should become a thin wrapper around this core logic.

## Proposed Core API

Implement something similar to:

```ts
export interface SweepOptions {
  now?: Date;
  staleThresholdMs?: number;
  skipAssignee?: string;
  commit?: boolean;
}

export interface SweptTask {
  id: string;
  previousAssignee: string;
  claimedAt: string | Date;
  ageMs: number;
  filePath: string;
}

export interface SweepResult {
  scanned: number;
  stale: SweptTask[];
  changed: number;
  pushed: boolean;
}

export async function sweepStaleTasks(
  repoRoot: string,
  options?: SweepOptions,
): Promise<SweepResult>
```

Exact names can vary, but the result must be structured and testable.

## Required Behavior

### Stale detection

A task is stale if:

```text
status === "In Progress"
assignee exists
claimed_at exists
claimed_at is older than 4 hours
```

Use the current canonical human-readable status value:

```text
In Progress
```

Do **not** change status values to snake_case.

### Recovery behavior

For each stale task:

1. Set status to:

```text
Ready
```

2. Clear:

```text
assignee
claimed_at
```

3. Append an agent/system note explaining that the task was swept.

4. Commit and push state changes using existing jittered push behavior.

### Non-stale behavior

Do not touch:

- tasks with no `assignee`
- tasks with no `claimed_at`
- tasks claimed less than 4 hours ago
- tasks not in `In Progress`
- tasks with invalid/unparseable `claimed_at` unless current behavior already handles this differently

### Self-sweep behavior

The spec says:

```text
taskforge sweep does not touch tasks with assignee matching the current session
```

If current session detection is already implemented elsewhere, use it.

If not, implement this minimally and safely:

- support an optional `skipAssignee` / `currentSession` option in the core sweeper
- leave CLI behavior unchanged unless there is a reliable way to infer current session
- add a clear TODO or documented limitation if current session detection is unavailable from the main repo context

Do not block the whole task on speculative session inference.

## Required Command Changes

### `taskforge next`

Before selecting the next task:

1. Run `sweepStaleTasks(...)`.
2. Then reload tasks.
3. Then call `selectNextTask(...)`.

Important: reload after sweeping. Do not select from a stale in-memory task list.

Expected flow:

```ts
await sweepStaleTasks(repoRoot, { commit: true });
const tasks = loadAllTasks(repoRoot);
const next = selectNextTask(tasks);
```

Use the existing function signatures where appropriate.

### `taskforge start TASK-ID`

Before loading the task:

1. Run `sweepStaleTasks(...)`.
2. Then load the task by ID.
3. Then proceed with the existing validation, worktree, lock, status update, note, and `jitteredPush()` flow.

Expected flow:

```ts
await sweepStaleTasks(repoRoot, { commit: true });
const task = loadTaskById(taskId);
```

The point is that a stale claim on the requested task should be cleared before `start` checks assignment/ownership.

### `taskforge sweep`

Refactor to call the same core logic.

It should preserve existing human-readable CLI behavior:

- “No stale tasks found”
- “Found N stale task(s)”
- per-task reset output
- final success/failure message

But the actual mutation logic should live in `src/core/sweeper.ts`.

## Required Tests

Add or update tests for the new core sweeper and command behavior.

### Core sweeper tests

Test:

1. No tasks.
2. No stale tasks.
3. One stale `In Progress` task older than 4 hours is reset to `Ready`.
4. Fresh `In Progress` task younger than 4 hours is not touched.
5. Task not in `In Progress` is not touched.
6. Task missing `assignee` is not touched.
7. Task missing `claimed_at` is not touched.
8. Multiple stale tasks are swept.
9. Agent note is appended for swept tasks.
10. Lock fields are cleared.

Use deterministic timestamps by injecting `now` into `sweepStaleTasks()`.

### `next` command tests

Add a test proving:

1. A stale `In Progress` task exists.
2. `cmdNext()` runs the sweeper first.
3. After `cmdNext()`, that task has been reset to `Ready`.
4. Task selection occurs after sweep state is applied.

### `start` command tests

Add a test proving:

1. A target task is `In Progress`.
2. It has an old `claimed_at`.
3. It has an `assignee`.
4. `cmdStart(taskId)` runs the sweeper before ownership rejection.
5. The stale claim is cleared.
6. The task can then be started/claimed by the new session.

Mock git/worktree behavior as needed. Do not require real network pushes in unit tests.

### Regression tests

Existing sweep tests should continue to pass, adjusted to target the new core module if needed.

## Important Testing Constraints

- Do not perform real network pushes.
- Mock `jitteredPush()` or configure tests so it is harmless.
- Preserve existing test isolation pattern using temporary repo/task-state directories.
- Use the existing `setRepoRoot()` pattern if applicable.
- Avoid brittle sleeps or real 4-hour timing. Inject `now`.

## Verification Commands

Run all gates:

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

All must pass.

## Files Likely to Change

```text
src/core/sweeper.ts          # new reusable sweep logic
src/commands/sweep.ts        # thin CLI wrapper around core sweeper
src/commands/next.ts         # run sweeper before task selection
src/commands/start.ts        # run sweeper before task load/claim
tests/sweep.test.ts          # update existing tests
tests/commands/next.test.ts  # add/adjust tests
tests/commands/start.test.ts # add/adjust tests if present
```

Also update imports/types as needed.

## Files to Avoid Unless Necessary

```text
package.json
package-lock.json
dist/**
node_modules/**
.git/**
```

This task should not require dependency changes.

## Acceptance Criteria

- `taskforge sweep` still works manually.
- Sweeper logic lives in reusable core code, not only inside `cmdSweep()`.
- `taskforge next` automatically sweeps stale claims before selecting work.
- `taskforge start TASK-ID` automatically sweeps stale claims before loading/claiming the task.
- Task state is reloaded after sweeping before selection/claim decisions.
- Stale `In Progress` tasks older than 4 hours are reset to `Ready`.
- `assignee` and `claimed_at` are cleared on swept tasks.
- Swept tasks receive an agent/system note.
- Fresh claims are not touched.
- Non-`In Progress` tasks are not touched.
- Tests cover core sweeper behavior and automatic invocation from `next` and `start`.
- All verification gates pass.

## Non-Goals

Do not:

- Change canonical status values.
- Convert statuses to snake_case.
- Redesign the task lifecycle.
- Change lock field names.
- Replace `assignee` / `claimed_at`.
- Implement a full worktree dirty-state sweeper in this task.
- Add new dependencies.
- Change GitHub sync behavior.
- Change dependency steward behavior.

## Final Report Requirements

When complete, summarize:

1. Files changed.
2. New core sweeper API.
3. How `next` now invokes sweep.
4. How `start` now invokes sweep.
5. Tests added/updated.
6. Verification command results.
7. Any remaining limitations, especially around self-sweep/current-session detection.

---

<a id="section-3-lifecycle-json-contracts-prompt"></a>

# Section 3: Lifecycle JSON Contracts Prompt

# Agentic Task Prompt: Add JSON Contracts to Agent-Facing Lifecycle Commands

## Task Name

**TASK-018: Add Structured `--json` Output to Agent-Facing Lifecycle Commands**

## Objective

Make TaskForge’s lifecycle commands safe and reliable for coding agents by adding consistent, machine-parseable JSON output to every command that an agent is expected to call during task discovery, claiming, execution, blocking, completion, recovery, and cleanup.

TaskForge already has JSON output for some read/reporting commands, but several critical lifecycle commands still emit only human-oriented text. This makes agents parse brittle log strings and makes automated orchestration harder than necessary.

This task should define and implement a consistent JSON response contract for agent-facing commands.

## What Was Missed

Earlier tasks added `--json` support to commands like `status`, `summary`, and `list`, but the core lifecycle commands still lack stable structured output.

The currently registered CLI surface includes commands such as:

```text
next
start
block
done
unlock
sweep
sync
deps ...
```

The high-value agent-facing commands are:

```text
next
start
block
done
unlock
sweep
list
status
summary
```

`status`, `summary`, and `list` already have JSON support. The remaining lifecycle commands need equivalent support.

### Why this matters

Agents should not have to infer state from text like:

```text
Status updated: Ready → In Progress
Created worktree at: ../worktrees/TASK-014
Failed to push claim for TASK-014
```

Instead, they should receive stable JSON like:

```json
{
  "ok": true,
  "command": "start",
  "task": {
    "id": "TASK-014",
    "status": "In Progress",
    "assignee": "a1b2c3d4e5"
  },
  "workspace": {
    "branch": "agent/TASK-014-sweeper-protocol--a1b2c3d4e5",
    "worktree": "../worktrees/TASK-014",
    "created": true
  },
  "next": {
    "recommendedCommand": "cd ../worktrees/TASK-014 && opencode"
  }
}
```

## Architectural Intent

TaskForge should treat its CLI as both:

1. a human-facing command-line tool, and
2. an automation API for local/remote coding agents.

Human-readable output can remain the default.

Machine-readable output must be available with `--json` and must be clean, deterministic, and testable.

## Required Design Principles

### 1. Preserve default human output

Do not remove or degrade existing human-readable command output.

Example:

```bash
taskforge start TASK-014
```

should still show readable instructions.

### 2. Add clean JSON mode

When `--json` is passed:

```bash
taskforge start TASK-014 --json
```

stdout must contain only valid JSON.

No color codes.  
No log decorations.  
No Markdown headings.  
No extra text before or after JSON.

### 3. Structured errors in JSON mode

When `--json` is passed and a known TaskForge error occurs, output structured JSON before exiting nonzero.

Example:

```json
{
  "ok": false,
  "command": "start",
  "error": {
    "type": "TaskNotFoundError",
    "message": "Task TASK-999 not found",
    "exitCode": 2
  }
}
```

Do not let `logError()` pollute stdout in JSON mode.

### 4. Keep canonical human-readable task statuses

Do not convert statuses to snake_case.

Persisted and emitted task statuses should remain canonical TaskForge values:

```text
Inbox
Needs Spec
Ready
In Progress
Blocked
Review
Verify
Done
Rejected
Deferred
```

### 5. Centralize JSON response shape where practical

Avoid one-off JSON formatting scattered across commands.

Prefer a small utility module such as:

```text
src/util/json-output.ts
```

or:

```text
src/core/command-result.ts
```

Exact name is flexible.

It should help with:

```text
success envelope
error envelope
task summary extraction
workspace summary extraction
stdout purity
```

## Commands to Update

### Required

Add `--json` support to:

```text
next
start
block
done
unlock
sweep
```

### Already supported, but verify consistency

Review and preserve:

```text
status --json
summary --json
list --json
```

Do not break existing tests for those commands.

## Proposed JSON Envelope

Use a consistent envelope.

### Success

```ts
interface JsonSuccess<T> {
  ok: true;
  command: string;
  data: T;
}
```

### Failure

```ts
interface JsonFailure {
  ok: false;
  command: string;
  error: {
    type: string;
    message: string;
    exitCode: number;
  };
}
```

Exact interface names can vary, but the emitted JSON should follow this shape.

## Command-Specific JSON Contracts

### `taskforge next --json`

Return the next actionable task after any required sweep behavior has run.

Example when a task exists:

```json
{
  "ok": true,
  "command": "next",
  "data": {
    "task": {
      "id": "TASK-014",
      "title": "Sweeper Protocol — Deadlock Recovery for Stale Agent Locks",
      "status": "Ready",
      "priority": "P1",
      "type": "Feature",
      "agentRole": "Implementer",
      "riskLevel": "Medium",
      "humanInterventionRequired": false,
      "dependsOn": [],
      "filePath": "../task-state/TASK-014.md",
      "score": 430
    },
    "dependencies": {
      "waitingOn": [],
      "blocks": ["TASK-015"]
    },
    "next": {
      "recommendedCommand": "taskforge start TASK-014 --json"
    }
  }
}
```

Example when no task exists:

```json
{
  "ok": true,
  "command": "next",
  "data": {
    "task": null,
    "reason": "No actionable tasks found"
  }
}
```

### `taskforge start TASK-ID --json`

Return claim/session/workspace information.

Example:

```json
{
  "ok": true,
  "command": "start",
  "data": {
    "task": {
      "id": "TASK-014",
      "status": "In Progress",
      "priority": "P1",
      "type": "Feature",
      "assignee": "a1b2c3d4e5",
      "claimed_at": "2026-05-22 02:20:22",
      "filePath": "../task-state/TASK-014.md"
    },
    "workspace": {
      "branch": "agent/TASK-014-sweeper-protocol--a1b2c3d4e5",
      "worktree": "../worktrees/TASK-014",
      "created": true
    },
    "session": {
      "id": "a1b2c3d4e5"
    },
    "next": {
      "recommendedCommand": "cd ../worktrees/TASK-014 && opencode"
    }
  }
}
```

If the task is already claimed by another session:

```json
{
  "ok": false,
  "command": "start",
  "error": {
    "type": "TaskClaimedError",
    "message": "Task TASK-014 is assigned to session abc123def0",
    "exitCode": 1
  },
  "data": {
    "task": {
      "id": "TASK-014",
      "status": "In Progress",
      "assignee": "abc123def0",
      "claimed_at": "2026-05-22 01:00:00"
    },
    "recovery": {
      "recommendedCommand": "taskforge sweep --json"
    }
  }
}
```

If there is no existing `TaskClaimedError` type, either add one or use an existing TaskForge error class cleanly.

### `taskforge block TASK-ID "reason" --json`

Example:

```json
{
  "ok": true,
  "command": "block",
  "data": {
    "task": {
      "id": "TASK-014",
      "previousStatus": "In Progress",
      "status": "Blocked",
      "assignee": null,
      "claimed_at": null
    },
    "block": {
      "reason": "Need decision on dirty worktree sweep behavior",
      "humanInterventionRequired": true
    }
  }
}
```

If `block` does not currently support a structured human-intervention flag, do not invent a broad blocker redesign in this task. Keep the existing behavior and return the reason.

### `taskforge done TASK-ID --json`

Example:

```json
{
  "ok": true,
  "command": "done",
  "data": {
    "task": {
      "id": "TASK-014",
      "previousStatus": "Verify",
      "status": "Done",
      "assignee": null,
      "claimed_at": null
    },
    "cleanup": {
      "requested": true,
      "worktreeRemoved": true,
      "branchDeleted": false
    }
  }
}
```

If cleanup was not requested:

```json
{
  "cleanup": {
    "requested": false,
    "worktreeRemoved": false,
    "branchDeleted": false
  }
}
```

### `taskforge unlock TASK-ID --force --json`

Example:

```json
{
  "ok": true,
  "command": "unlock",
  "data": {
    "task": {
      "id": "TASK-014",
      "status": "In Progress",
      "previousAssignee": "abc123def0",
      "assignee": null,
      "claimed_at": null
    }
  }
}
```

If `--force` is missing:

```json
{
  "ok": false,
  "command": "unlock",
  "error": {
    "type": "MissingForceError",
    "message": "unlock requires --force",
    "exitCode": 1
  }
}
```

Use actual existing error types where available.

### `taskforge sweep --json`

Example:

```json
{
  "ok": true,
  "command": "sweep",
  "data": {
    "scanned": 15,
    "stale": [
      {
        "id": "TASK-014",
        "previousAssignee": "abc123def0",
        "claimedAt": "2026-05-21 20:00:00",
        "ageMs": 18000000,
        "newStatus": "Ready"
      }
    ],
    "changed": 1,
    "pushed": true
  }
}
```

If no stale tasks:

```json
{
  "ok": true,
  "command": "sweep",
  "data": {
    "scanned": 15,
    "stale": [],
    "changed": 0,
    "pushed": false
  }
}
```

If the previous sweeper-refactor task has not yet landed, do this after that task or include a minimal compatible refactor.

## Implementation Guidance

### 1. Update CLI option registration

Update `src/cli.ts` so these commands accept `--json`:

```text
next
start
block
done
unlock
sweep
```

Existing examples:

```ts
.option("--json", "Output in JSON format for programmatic consumption")
```

### 2. Update command option types

Add options interfaces as needed.

Examples:

```ts
export interface NextOptions {
  json?: boolean;
}

export interface StartOptions {
  force?: boolean;
  json?: boolean;
}

export interface BlockOptions {
  json?: boolean;
}

export interface SweepOptions {
  json?: boolean;
}
```

Avoid boolean positional parameters if adding more options would make the signature unclear.

### 3. Avoid logging in JSON mode

Commands should not call `logInfo`, `logSuccess`, `logWarn`, `logHeader`, etc. when `json` mode is active.

Either:

1. branch explicitly inside each command, or
2. use a helper logger that suppresses human output in JSON mode.

Do not mix JSON with terminal text.

### 4. Update error wrapper

Current CLI wrapping likely catches `TaskForgeError` and logs text before exiting.

For JSON mode, the wrapper needs to know whether a command was invoked with `--json`.

Possible approaches:

#### Option A — command handles expected errors

Each command catches known errors and emits JSON.

This is simple but repetitive.

#### Option B — JSON-aware wrapper

Create a wrapper like:

```ts
wrapJson(commandName, json, fn)
```

On error:

```ts
if (json) {
  writeJsonFailure(commandName, err);
} else {
  logError(...)
}
process.exit(...)
```

This is preferable if it can be implemented cleanly.

### 5. Preserve stdout/stderr discipline

For JSON mode:

- JSON response goes to stdout.
- Unexpected diagnostic logs, if any, go to stderr.
- No color codes.

For human mode:

- existing behavior may remain.

### 6. Reuse task summary helpers

Create a helper to avoid duplicating output mapping:

```ts
taskToJsonSummary(task)
```

Suggested fields:

```text
id
title
type
status
priority
agentRole
riskLevel
humanInterventionRequired
dependsOn
assignee
claimed_at
branch
worktree
issue
pr
filePath
```

Include fields only when available if that keeps output cleaner, but be consistent.

### 7. Preserve existing behavior

Existing command behavior should not change except for new `--json` support.

Do not change:

- lifecycle transitions
- status names
- task-state branch behavior
- lock/session model
- sweeper threshold
- dependency scoring
- GitHub sync behavior

## Required Tests

Add or update tests for each command.

### JSON purity tests

For each newly updated command:

```text
next --json
start --json
block --json
done --json
unlock --json
sweep --json
```

Verify:

1. stdout parses as JSON.
2. no human log decoration appears in stdout.
3. top-level `ok` and `command` fields exist.
4. success responses include `data`.
5. error responses include `error`.

### `next --json`

Test:

- next task exists
- no actionable task exists
- dependency info included if relevant
- score included or omitted consistently if not intended

### `start --json`

Test:

- starts a Ready task
- returns session ID
- returns branch/worktree
- handles already-claimed task in structured JSON
- handles missing task in structured JSON if wrapper supports it

Mock git/worktree behavior as currently done in tests.

### `block --json`

Test:

- blocks a valid task
- returns previous/new status
- returns reason
- invalid transition returns JSON error

### `done --json`

Test:

- marks task done
- clears claim fields
- reports cleanup state
- forced done still reports force behavior if applicable

### `unlock --json`

Test:

- requires `--force`
- clears claim fields
- returns previous assignee

### `sweep --json`

Test:

- no stale tasks
- one stale task swept
- multiple stale tasks swept
- push failure represented in JSON if current sweep result supports it

### Error wrapper tests

If a JSON-aware wrapper is added, test it directly or through CLI command behavior.

## Verification Commands

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

All must pass.

## Files Likely to Change

```text
src/cli.ts
src/commands/next.ts
src/commands/start.ts
src/commands/block.ts
src/commands/done.ts
src/commands/unlock.ts
src/commands/sweep.ts
src/util/json-output.ts              # new, optional
src/core/command-result.ts           # alternative helper location
tests/commands/next.test.ts
tests/commands/start.test.ts
tests/commands/block.test.ts
tests/commands/done.test.ts
tests/commands/unlock.test.ts
tests/sweep.test.ts or tests/commands/sweep.test.ts
```

Also update any test helpers needed to capture stdout cleanly.

## Files to Avoid Unless Necessary

```text
package.json
package-lock.json
dist/**
node_modules/**
.git/**
```

This task should not require dependency changes.

## Acceptance Criteria

- `taskforge next --json` emits valid JSON only.
- `taskforge start TASK-ID --json` emits valid JSON only.
- `taskforge block TASK-ID "reason" --json` emits valid JSON only.
- `taskforge done TASK-ID --json` emits valid JSON only.
- `taskforge unlock TASK-ID --force --json` emits valid JSON only.
- `taskforge sweep --json` emits valid JSON only.
- Known errors in JSON mode produce structured JSON failure output.
- Human-readable output remains the default and is not removed.
- Existing `status --json`, `summary --json`, and `list --json` behavior remains compatible.
- Tests cover success and failure JSON output for lifecycle commands.
- No command in JSON mode mixes logs/color/Markdown with JSON.
- All verification gates pass.

## Non-Goals

Do not:

- Change canonical status values.
- Convert statuses to snake_case.
- Redesign the task lifecycle.
- Add a new database.
- Change task-state branch behavior.
- Change GitHub sync semantics.
- Change dependency steward behavior.
- Implement gates/verification execution in this task.
- Implement PR creation or merge automation in this task.

## Final Report Requirements

When complete, summarize:

1. Commands updated with `--json`.
2. JSON envelope shape used.
3. Error behavior in JSON mode.
4. Files changed.
5. Tests added/updated.
6. Verification command results.
7. Any remaining inconsistencies in older JSON commands, if found.

---

<a id="section-4-control-plane-hardening-task-creation-prompt"></a>

# Section 4: Control-Plane Hardening Task-Creation Prompt

# Agentic Prompt: Create Control-Plane Hardening Tasks for TaskForge

## Mission

Create a coherent set of new TaskForge task files in the `task-state` control branch to harden TaskForge against race conditions, direct state manipulation, raw-git bypasses, inconsistent task states, and unsafe recovery behavior.

This is **task creation only**. Do not implement the tasks in this pass unless explicitly instructed later.

The intent is to create a focused sequence of agent-ready tasks that guide future agents toward a logically consistent control-plane architecture.

## Context

TaskForge is a repo-centered, Markdown-native task management and execution system for agentic software development.

Current architecture:

```text
main branch
  - source code
  - CLI
  - AGENTS.md
  - TASKFORGE.md
  - specs/docs

task-state branch
  - task Markdown files
  - task frontmatter
  - task notes
  - control files such as .doctor-lock

agent worktrees
  - per-task implementation branches
```

The current system has useful mechanisms:

- task-state branch
- per-task worktrees
- session-based claims
- `assignee` / `claimed_at`
- sweeper protocol
- doctor command
- doctor lock
- jittered push
- heartbeat
- JSON lifecycle command support
- capability policy documentation

But observed behavior shows the system is still vulnerable to agent abuse or accidental bypass.

## Problem Being Addressed

Agents have directly manipulated task state and used raw git commands in ways that subvert the intended mechanisms.

Specific failure modes include:

1. Direct edits to `../task-state/*.md`.
2. Raw `git commit` / `git push` to `task-state`.
3. Use of generic `--force` to bypass ownership, gates, or transitions.
4. Tasks marked `Done` while still having active `assignee` / `claimed_at`.
5. Local commits to task-state that fail to push, leaving local truth divergent from remote truth.
6. Worktrees or branches created before claims are durably pushed.
7. `jitteredPush()` rebasing already-mutated local commits rather than reapplying mutation to freshly pulled state.
8. Doctor lock implemented as a cooperative file lock that can be ignored or removed by an agent with raw filesystem access.
9. Commands directly calling mutation primitives such as `updateTaskStatus()`, `clearTaskLock()`, `writeTaskFile()`, `appendAgentNote()`, and `commitAndPushTaskState()`.

The new tasks should guide the project toward a stricter architecture where task-state mutation is centralized, validated, auditable, and eventually protected by branch rules or a broker.

## Required Output

Create new task Markdown files in the task-state branch.

Recommended task IDs:

```text
TASK-045
TASK-046
TASK-047
TASK-048
TASK-049
TASK-050
```

If these IDs already exist, choose the next available IDs while preserving task order and dependencies.

Each task must be fully agent-ready and include:

- frontmatter
- title
- goal
- background
- motivation
- scope
- allowed files/directories
- disallowed files/directories
- acceptance criteria
- expected design/implementation notes
- tests required
- verification commands
- dependencies
- risk level
- continuation policy
- final report requirements

Use canonical TaskForge status values:

```text
Inbox
Needs Spec
Ready
In Progress
Blocked
Review
Verify
Done
Rejected
Deferred
```

New tasks should generally be `Ready` unless they depend on earlier tasks. If dependency ordering is supported via `dependsOn`, set it explicitly.

---

# TASK-045: Centralize Task-State Mutation Through a Transactional Control Layer

## Priority

P0

## Type

Feature / Infrastructure

## Risk

High

## Goal

Introduce a single transaction boundary for all task-state mutations so commands no longer directly edit task Markdown files and independently commit/push changes.

This task should create the architecture for controlled mutation, optimistic retry, invariant validation hooks, and eventual branch-protected/broker-backed state management.

## Motivation

Currently, commands and core modules directly call low-level mutation helpers such as:

```text
updateTaskStatus()
updateTaskLock()
clearTaskLock()
writeTaskFile()
appendAgentNote()
commitAndPushTaskState()
jitteredPush()
```

This creates multiple mutation paths with inconsistent behavior.

The system needs one authoritative path:

```text
withTaskStateTransaction(...)
  -> pull latest task-state
  -> capture base HEAD
  -> load fresh state
  -> apply mutation
  -> validate invariants
  -> append event
  -> write materialized Markdown state
  -> commit
  -> push
  -> on conflict: reset/reload/reapply mutation
```

This is the most important hardening task. Later tasks depend on it.

## Required Design

Create a transactional task-state mutation layer.

Suggested file:

```text
src/core/task-state-transaction.ts
```

Possible API shape:

```ts
export interface TaskStateTransactionOptions {
  repoRoot: string;
  actor: string;
  command: string;
  maxRetries?: number;
  jitterMinMs?: number;
  jitterMaxMs?: number;
  allowRecoveryMode?: boolean;
}

export interface TaskStateTransaction {
  loadTask(id: string): ParsedTask | null;
  loadAllTasks(): ParsedTask[];
  updateTask(task: ParsedTask): void;
  appendTaskNote(taskId: string, role: string, notes: string[]): void;
  appendEvent(taskId: string, event: string, data?: Record<string, unknown>): void;
  assertCanTransition(task: ParsedTask, targetStatus: TaskStatus): void;
  claimTask(taskId: string, sessionId: string): void;
  clearClaim(taskId: string): void;
}

export async function withTaskStateTransaction<T>(
  options: TaskStateTransactionOptions,
  mutate: (tx: TaskStateTransaction) => Promise<T> | T,
): Promise<T>
```

Exact API can differ, but the architecture must centralize task-state mutation.

## Key Requirements

The transaction layer must:

1. Pull latest task-state before mutation.
2. Capture the base task-state HEAD.
3. Load tasks from fresh state.
4. Apply caller mutation against fresh state.
5. Validate state before commit.
6. Append an event-log entry for every mutation.
7. Commit all task-state changes with a structured commit message.
8. Push task-state.
9. On non-fast-forward conflict:
   - abort/reset local mutation if needed
   - pull/rebase or fetch/reset safely
   - reload fresh state
   - re-run the mutation function against fresh state
   - retry with jitter
10. Return structured success/failure information.
11. Avoid swallowing push failures silently.

## Important Constraint

Do not rewrite every existing command in this task unless the implementation is small and safe.

The minimum acceptable outcome is:

- transaction core exists
- tests prove it works
- at least one low-risk command or synthetic test mutation uses it
- follow-up tasks can migrate commands to it

## Tests Required

Add tests for:

1. Successful transaction writes and pushes.
2. No-op transaction produces no unnecessary commit.
3. Invariant failure aborts transaction.
4. Push failure returns/throws structured failure.
5. Non-fast-forward conflict causes reload and retry.
6. Mutation function is re-run against fresh state after conflict.
7. Event log entry is appended.
8. Direct mutation helpers are not required by the transaction caller.

Mock git operations. Do not require real network pushes.

## Acceptance Criteria

- `src/core/task-state-transaction.ts` or equivalent exists.
- It provides a single reusable mutation boundary.
- It does not silently swallow push failures.
- It supports retry/reload/reapply semantics.
- It supports invariant-validation hooks.
- It supports event-log hooks.
- Tests cover success, conflict, failure, and no-op behavior.
- Existing tests still pass.

## Dependencies

None.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

# TASK-046: Add State Invariant Validator and CI/Doctor Gate

## Priority

P0

## Type

Feature / Test / Infrastructure

## Risk

High

## Goal

Add a centralized invariant validator for task-state and expose it through CLI and doctor checks.

The validator should detect logically impossible or suspicious task states before they are committed, pushed, or accepted by CI.

## Motivation

Observed inconsistent state proves the current system allows invalid combinations, such as:

```yaml
status: Done
assignee: some-session
claimed_at: some-time
```

A task marked `Done` must not retain an active claim.

The project needs an explicit invariant layer that can run:

- inside the transaction layer
- inside `taskforge doctor`
- as `taskforge validate-state`
- in CI
- in a future GitHub branch-protection check for task-state commits

## Required Design

Create a validator module.

Suggested file:

```text
src/core/state-validator.ts
```

Suggested API:

```ts
export type ValidationSeverity = "error" | "warning";

export interface StateValidationIssue {
  severity: ValidationSeverity;
  code: string;
  taskId?: string;
  filePath?: string;
  message: string;
  suggestedFix?: string;
}

export interface StateValidationResult {
  ok: boolean;
  errors: StateValidationIssue[];
  warnings: StateValidationIssue[];
}

export function validateTaskState(tasks: ParsedTask[]): StateValidationResult;
```

Expose CLI command:

```bash
taskforge validate-state
taskforge validate-state --json
taskforge validate-state --strict
```

## Required Invariants

At minimum validate:

1. `Done` must not have `assignee` or `claimed_at`.
2. `Ready` must not have `assignee` or `claimed_at`.
3. `Rejected` must not have `assignee` or `claimed_at`.
4. `Deferred` must not have `assignee` or `claimed_at`.
5. `In Progress` should have `assignee`.
6. `In Progress` should have `claimed_at`.
7. `Blocked` must have `blocked_reason`.
8. `Blocked` should have `blocked_since`.
9. `Blocked` should have `blocked_by`.
10. Task filename must match frontmatter `id`.
11. Task IDs must be unique.
12. `dependsOn` entries must reference existing task IDs.
13. Tasks must not depend on themselves.
14. Circular dependencies must be detected.
15. If a task has `worktree`, the path should be syntactically plausible.
16. If a task has `branch`, the branch should match the expected agent branch pattern or be explicitly allowed.
17. Control files such as `.doctor-lock` should have valid JSON when present.

Do not overfit the first version. It should be useful and extensible.

## Doctor Integration

Update `taskforge doctor` to call the validator and include invariant failures in the doctor report.

If `doctor --fix` already exists, do not auto-fix high-risk invariant failures unless the fix is unambiguous.

Unambiguous examples:

- `Done + assignee/claimed_at`: clear claim fields.
- `Ready + assignee/claimed_at`: clear claim fields.

Ambiguous examples:

- `In Progress` missing assignee: do not guess.
- broken dependency: do not guess.

## Transaction Integration

If TASK-045 exists, the transaction layer should be able to call the validator before commit.

If TASK-045 is not complete, design the validator so it can be imported later.

## Tests Required

Add tests for every invariant listed above.

Include tests for:

- valid state
- invalid state with errors
- warning-only state
- JSON CLI output
- strict mode treating warnings as failures if implemented
- doctor integration

## Acceptance Criteria

- Validator module exists.
- CLI command `validate-state` exists.
- JSON output works.
- Doctor includes validator issues.
- Invariant failures are structured with codes.
- Tests cover core invariants.
- Existing tests pass.

## Dependencies

Prefer after TASK-045, but can be implemented independently if needed.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

# TASK-047: Make `start` Two-Phase: Durable Claim Before Worktree Creation

## Priority

P0

## Type

Bug / Refactor / Reliability

## Risk

Medium

## Goal

Refactor `taskforge start` so it durably claims the task before creating the worktree/branch.

## Motivation

Current `start` flow creates or touches the worktree before the claim push is confirmed. If the push fails, or another agent wins the race, TaskForge can leave behind:

- orphan worktree
- orphan branch
- local unpushed task-state mutation
- misleading agent notes
- a workspace for a task the agent does not own

The correct flow should be:

```text
pull latest task-state
sweep stale claims
durably claim task
push claim successfully
create worktree / branch
record branch/worktree metadata
push metadata
print instructions
```

This makes failure states recoverable and explicit.

## Required Design

Refactor `cmdStart()` into two durable phases.

### Phase 1: Claim

1. Pull latest task-state.
2. Run sweeper.
3. Load task.
4. Validate status.
5. Check doctor lock.
6. Check outstanding session tasks.
7. Generate session ID.
8. Claim task by setting:
   - `status: In Progress`
   - `assignee`
   - `claimed_at`
9. Commit and push claim through the transaction layer or current best safe mutation path.
10. If push fails, do not create a worktree.

### Phase 2: Workspace

1. Create worktree/branch only after claim push succeeds.
2. Record:
   - `branch`
   - `worktree`
3. Commit and push metadata update.
4. If worktree creation fails after claim, leave task claimed and append/report a recoverable note or mark blocked/recovery-needed if appropriate.

## Important Constraint

Do not make `start` weaker by relying only on local state.

Remote propagation of the claim is required before workspace creation.

## Tests Required

Add tests proving:

1. If claim push fails, no worktree is created.
2. If another agent claims during retry, no worktree is created.
3. If worktree creation succeeds, metadata is persisted.
4. If worktree creation fails after claim, task remains claimed and error is clear.
5. Existing resume/idempotent behavior still works where intended.
6. JSON mode reports each phase accurately.

Mock git/worktree operations.

## Acceptance Criteria

- `start` does not create a worktree before durable claim success.
- Failed claim leaves no orphan worktree.
- Worktree metadata is persisted only after workspace creation.
- Failure modes are clear in human and JSON output.
- Existing tests pass.

## Dependencies

Prefer after TASK-045. Can be done before with careful use of current mutation path.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

# TASK-048: Replace Low-Level `jitteredPush` With Transactional CAS Reapply Semantics

## Priority

P0

## Type

Refactor / Reliability

## Risk

High

## Goal

Replace the current low-level `jitteredPush()` optimistic concurrency behavior with true transactional compare-and-reapply semantics.

## Motivation

The current `jitteredPush()` stages and commits local changes, then attempts to push. On non-fast-forward rejection, it pulls/rebases and then calls `onConflict`.

This is not a true compare-and-swap model because the local mutation may already be part of the rebased local state. The conflict callback can inspect a state that includes the caller’s attempted mutation, not the clean remote state.

Correct behavior:

```text
fetch/pull fresh state
capture base HEAD
apply mutation in memory
validate
commit
push
if rejected:
  discard/reload local mutation
  fetch/pull fresh state
  re-run mutation against fresh remote state
  retry
```

The mutation function must be re-applied to fresh state, not rebased as an already-committed local change.

## Required Design

Build on TASK-045 if available.

Replace or deprecate:

```text
jitteredPush()
commitAndPushTaskState()
```

for production lifecycle commands.

New flow should be transaction-oriented:

```ts
await transactionalMutateTaskState({
  command: "claim",
  actor,
  maxRetries: 3,
  jitterMinMs: 2000,
  jitterMaxMs: 10000,
}, async (state) => {
  const task = state.loadTask(taskId);
  state.assertExpected(task.status === STATUS.READY);
  state.claim(taskId, sessionId);
});
```

## Required Behavior

1. Retry only on recoverable non-fast-forward conflicts.
2. Re-read fresh remote task-state on every retry.
3. Re-run mutation callback on fresh state.
4. Abort cleanly if mutation preconditions no longer hold.
5. Do not leave local divergent commits after abort.
6. Do not swallow unrecoverable git errors.
7. Return structured result.
8. Preserve jittered backoff behavior.

## Migration Scope

Migrate at least these commands away from direct `jitteredPush()` if feasible:

```text
claim
start
sweep
heartbeat
done
block
unlock
```

If full migration is too large, migrate the highest-risk commands first:

```text
claim
start
sweep
```

Document remaining commands as follow-up work.

## Tests Required

Add tests for:

1. Successful mutation.
2. Non-fast-forward conflict then successful retry.
3. Conflict where another agent has claimed the task, mutation aborts.
4. Unrecoverable git error returns/throws failure.
5. Local state is reset/reloaded before retry.
6. Mutation callback invocation count equals retry count.
7. No partial local commits remain after abort if testable.

## Acceptance Criteria

- Transactional CAS/reapply path exists.
- High-risk lifecycle commands use it or have follow-up tasks created.
- `jitteredPush()` is deprecated, renamed unsafe, or no longer used by high-risk commands.
- Tests cover conflict/retry semantics.
- Existing tests pass.

## Dependencies

TASK-045 strongly recommended.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

# TASK-049: Add Branch Protection / Ruleset Guidance for `task-state`

## Priority

P1

## Type

Documentation / Infrastructure

## Risk

Medium

## Goal

Document and, where possible, implement repository protections that prevent normal agents from directly pushing to the `task-state` branch.

## Motivation

CLI-level guardrails are not enough if agents retain raw git write access.

If an agent can run:

```bash
git checkout task-state
vim TASK-123.md
git commit -am "done"
git push origin task-state
```

then it can bypass:

- ownership checks
- transition validation
- sweeper policy
- doctor lock
- gates
- invariant validation
- event logging

To prevent this in general, the remote repository must enforce task-state rules.

## Required Documentation

Create docs such as:

```text
docs/control-plane-hardening.md
docs/github-task-state-protection.md
```

Include recommended GitHub settings:

1. Protect branch `task-state`.
2. Disallow direct pushes by normal users/tokens.
3. Require pull request or bot/App mediated updates.
4. Require `taskforge validate-state --strict`.
5. Require event-log/invariant validation check.
6. Restrict who can dismiss/override checks.
7. Protect `main` separately.
8. Use separate credentials for:
   - read-only agents
   - implementation agents
   - recovery/admin/bot
9. Do not give general coding agents push permission to `task-state`.
10. Explain emergency recovery procedure.

## Optional Implementation

If feasible, add a GitHub Actions workflow:

```text
.github/workflows/task-state-validate.yml
```

It should run on PRs or pushes affecting the `task-state` branch and execute:

```bash
npm ci
npm run build
node dist/cli.js validate-state --strict --json
```

If task-state branch does not contain source code, the workflow may need to check out `main` for code and `task-state` for data. Document the chosen approach.

## Required Threat Model Section

Document explicitly:

```text
TaskForge CLI guardrails are cooperative unless task-state write access is restricted.
Hard enforcement requires repository permissions, branch protection, or a broker service.
```

## Tests / Validation

If adding workflow/config files, validate syntax where practical.

If documentation only, ensure links and commands are accurate.

## Acceptance Criteria

- Documentation explains why direct task-state push access is unsafe.
- Documentation provides concrete GitHub branch protection/ruleset configuration.
- Documentation explains credential separation by agent capability.
- Optional CI workflow exists or a follow-up task is created.
- Existing tests pass if code is changed.

## Dependencies

Can be done independently. Strongly benefits from TASK-046.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

If docs-only, still run relevant checks if project expects it.

---

# TASK-050: Split Generic `--force` Into Explicit Privileged Override Modes

## Priority

P1

## Type

Security / Reliability / Refactor

## Risk

Medium

## Goal

Replace broad, ambiguous `--force` behavior with explicit override modes and privileged recovery checks.

## Motivation

Generic `--force` is too powerful and too vague. Agents can use it to bypass unrelated safeguards without acknowledging what they are overriding.

Examples of distinct override types:

```text
ownership override
transition override
gate override
cleanup override
doctor recovery override
branch deletion override
```

These should not all be controlled by the same flag.

## Required Design

Audit all commands that accept `--force`, including at least:

```text
start
claim
done
block
unlock
heartbeat
sweep
doctor
cleanup-related flows
```

Replace or supplement generic `--force` with explicit flags, such as:

```text
--force-ownership
--force-transition
--force-gates
--force-cleanup
--doctor-recovery
--admin
```

Exact names can vary, but each override must be explicit.

## Privilege Model

Tie dangerous overrides to capability levels where possible.

If a capability system already exists, use it.

Expected levels:

```text
normal agent
reviewer/qa
recovery agent
admin/human
```

Normal implementer agents should not be allowed to:

- override ownership
- override doctor lock
- mark done despite failed gates
- delete branches with unmerged work
- clear another session's claim
- remove doctor lock

If hard enforcement is not yet possible, the command should at minimum:

- emit structured warnings
- require explicit flag names
- record event-log entries
- make doctor detect override use

## Backward Compatibility

Do not abruptly break all existing workflows without a migration path.

Options:

1. Keep `--force` temporarily but print deprecation warnings.
2. Map `--force` to the appropriate explicit flag only for one release.
3. Reject `--force` on high-risk commands with a clear error.

Prefer safety over convenience for high-risk commands.

## Tests Required

Add tests for:

1. `done` gate override requires `--force-gates` or privileged equivalent.
2. ownership override requires `--force-ownership`.
3. unlock another session requires recovery/admin mode.
4. branch deletion requires explicit cleanup/branch deletion flag.
5. old `--force` behavior warns or fails according to chosen migration policy.
6. JSON mode reports override use.
7. event log records override use.

## Acceptance Criteria

- Generic `--force` is no longer the only control for unrelated override types.
- Dangerous overrides are explicit.
- Override use is logged/auditable.
- Normal agent path remains simple for non-dangerous actions.
- Tests cover new override behavior.
- Documentation updated.

## Dependencies

Prefer after TASK-045 and TASK-046.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

## Task Creation Instructions

When creating these tasks:

1. Use the existing TaskForge task file format.
2. Put files in the authoritative task-state worktree/branch, not legacy `main/tasks`.
3. Use `dependsOn` to encode ordering:

Suggested ordering:

```text
TASK-045: no dependency
TASK-046: dependsOn TASK-045 if practical, otherwise no dependency
TASK-047: dependsOn TASK-045
TASK-048: dependsOn TASK-045
TASK-049: dependsOn TASK-046
TASK-050: dependsOn TASK-045, TASK-046
```

4. Use `status: Ready` for TASK-045.
5. Use `status: Ready` for tasks that can proceed independently.
6. Use `status: Ready` with `dependsOn` for dependent tasks if the scheduler respects dependencies.
7. Use `priority: P0` for TASK-045 through TASK-048.
8. Use `priority: P1` for TASK-049 and TASK-050.
9. Use `riskLevel: High` for TASK-045, TASK-046, and TASK-048.
10. Use `riskLevel: Medium` for TASK-047, TASK-049, and TASK-050.
11. Use `humanInterventionRequired: false` unless the task specifically requires repository-admin configuration that cannot be done by an agent.
12. For TASK-049, set `humanInterventionRequired: true` if branch protection must be configured manually in GitHub.

## Global Acceptance Criteria

This task-creation pass is complete when:

- All six task files exist in task-state.
- Each task is agent-ready and detailed enough to implement without guessing.
- The tasks are ordered coherently using `dependsOn`.
- The task text explains the race-condition/recovery/direct-manipulation motivation.
- The tasks do not ask agents to implement everything at once.
- No source-code implementation is performed in this pass unless explicitly required by task creation mechanics.
- A final summary lists created task IDs, titles, dependencies, and risk levels.

## Verification for Task Creation

After creating the task files, run:

```bash
taskforge list --json
taskforge validate-state --json
```

If `validate-state` does not exist yet, run:

```bash
taskforge list --json
taskforge status --json
```

Then report:

1. Created files.
2. Task IDs.
3. Dependencies.
4. Any conflicts with existing task IDs.
5. Any validation warnings.

---

<a id="section-5-control-plane-hardening-with-doctor-mode-prompt"></a>

# Section 5: Control-Plane Hardening With Doctor Mode Prompt

# Agentic Prompt: Create Control-Plane Hardening Tasks for TaskForge, Including Doctor-Mode Recovery

## Mission

Create a coherent set of new TaskForge task files in the authoritative `task-state` branch to harden TaskForge against race conditions, direct state manipulation, raw-git bypasses, inconsistent task states, unsafe recovery behavior, and incomplete global recovery coordination.

This is **task creation only**. Do not implement the tasks in this pass unless explicitly instructed later.

The intent is to create a focused sequence of agent-ready tasks that guide future agents toward a logically consistent control-plane architecture.

## Current Doctor-Mode Analysis

A current task-state task already describes the general idea:

```text
TASK-042: Global Doctor-Lock — Pause All Agents During Recovery
```

That task specifies a `.doctor-lock` file in `task-state`, checks in `next` / `claim` / `start`, and a lifecycle where `taskforge doctor --fix` creates a lock and recovery task, then `taskforge done` clears the lock when the recovery task is complete.

This approach is sane as a **cooperative global pause protocol**, but it is not sufficient as a hard enforcement mechanism.

## Sanity Assessment of Doctor Mode

### What is good

The doctor-mode concept is directionally correct:

1. It gives the system a global “stop the line” mechanism.
2. It prevents normal agents from compounding state corruption while recovery is in progress.
3. It creates a dedicated recovery task, which gives the doctor agent an explicit execution contract.
4. It ties lock removal to completion of that recovery task.
5. A TTL prevents permanent deadlock if the doctor agent crashes.
6. It makes recovery visible and auditable in normal TaskForge workflow terms.

This should remain part of the architecture.

### What is insufficient

The current doctor-lock design is only cooperative:

```text
task-state/.doctor-lock
```

Any agent with raw filesystem or git access can:

```bash
rm ../task-state/.doctor-lock
git add ../task-state/.doctor-lock
git commit
git push
```

or simply ignore the lock and keep editing files.

Therefore, doctor mode cannot prevent abuse by itself. It must be combined with:

1. centralized transactional mutation,
2. invariant validation,
3. branch protection or broker-mediated writes,
4. event logging,
5. explicit capability checks,
6. CI/ruleset validation,
7. doctor-lock provenance validation.

### Implementation gap to capture

The current task text says `taskforge doctor --fix` creates a lock and recovery task. Current implementation must be verified and, if incomplete, made real.

At minimum, future work should ensure:

```text
doctor --fix
  -> validates state
  -> detects critical issue
  -> creates .doctor-lock
  -> creates DOCTOR/TASK recovery task
  -> commits/pushes both through transaction layer
  -> all normal agents pause
  -> only doctor/recovery agent may work recovery task
  -> completing recovery task removes doctor lock
  -> lock removal is validated and event-logged
```

## Problem Being Addressed

Agents have directly manipulated task state and used raw git commands in ways that subvert the intended mechanisms.

Specific failure modes include:

1. Direct edits to `../task-state/*.md`.
2. Raw `git commit` / `git push` to `task-state`.
3. Use of generic `--force` to bypass ownership, gates, or transitions.
4. Tasks marked `Done` while still having active `assignee` / `claimed_at`.
5. Local commits to task-state that fail to push, leaving local truth divergent from remote truth.
6. Worktrees or branches created before claims are durably pushed.
7. `jitteredPush()` rebasing already-mutated local commits rather than reapplying mutation to freshly pulled state.
8. Doctor lock implemented as a cooperative file lock that can be ignored or removed by an agent with raw filesystem access.
9. Commands directly calling mutation primitives such as `updateTaskStatus()`, `clearTaskLock()`, `writeTaskFile()`, `appendAgentNote()`, and `commitAndPushTaskState()`.
10. Recovery mode not being fully represented as a privileged, auditable, transactional control-plane operation.

The new tasks should guide the project toward a stricter architecture where task-state mutation is centralized, validated, auditable, and eventually protected by branch rules or a broker.

## Required Output

Create new task Markdown files in the task-state branch.

Recommended task IDs:

```text
TASK-045
TASK-046
TASK-047
TASK-048
TASK-049
TASK-050
TASK-051
```

If these IDs already exist, choose the next available IDs while preserving task order and dependencies.

Each task must be fully agent-ready and include:

- frontmatter
- title
- goal
- background
- motivation
- scope
- allowed files/directories
- disallowed files/directories
- acceptance criteria
- expected design/implementation notes
- tests required
- verification commands
- dependencies
- risk level
- continuation policy
- final report requirements

Use canonical TaskForge status values:

```text
Inbox
Needs Spec
Ready
In Progress
Blocked
Review
Verify
Done
Rejected
Deferred
```

---

# TASK-045: Centralize Task-State Mutation Through a Transactional Control Layer

## Priority

P0

## Type

Feature / Infrastructure

## Risk

High

## Goal

Introduce a single transaction boundary for all task-state mutations so commands no longer directly edit task Markdown files and independently commit/push changes.

This task should create the architecture for controlled mutation, optimistic retry, invariant validation hooks, event logging, and eventual branch-protected/broker-backed state management.

## Motivation

Currently, commands and core modules directly call low-level mutation helpers such as:

```text
updateTaskStatus()
updateTaskLock()
clearTaskLock()
writeTaskFile()
appendAgentNote()
commitAndPushTaskState()
jitteredPush()
```

This creates multiple mutation paths with inconsistent behavior.

The system needs one authoritative path:

```text
withTaskStateTransaction(...)
  -> pull latest task-state
  -> capture base HEAD
  -> load fresh state
  -> apply mutation
  -> validate invariants
  -> append event
  -> write materialized Markdown state
  -> commit
  -> push
  -> on conflict: reset/reload/reapply mutation
```

This is the most important hardening task. Later tasks depend on it.

## Required Design

Create a transactional task-state mutation layer.

Suggested file:

```text
src/core/task-state-transaction.ts
```

Possible API shape:

```ts
export interface TaskStateTransactionOptions {
  repoRoot: string;
  actor: string;
  command: string;
  maxRetries?: number;
  jitterMinMs?: number;
  jitterMaxMs?: number;
  allowRecoveryMode?: boolean;
}

export interface TaskStateTransaction {
  loadTask(id: string): ParsedTask | null;
  loadAllTasks(): ParsedTask[];
  updateTask(task: ParsedTask): void;
  appendTaskNote(taskId: string, role: string, notes: string[]): void;
  appendEvent(taskId: string, event: string, data?: Record<string, unknown>): void;
  assertCanTransition(task: ParsedTask, targetStatus: TaskStatus): void;
  claimTask(taskId: string, sessionId: string): void;
  clearClaim(taskId: string): void;
}

export async function withTaskStateTransaction<T>(
  options: TaskStateTransactionOptions,
  mutate: (tx: TaskStateTransaction) => Promise<T> | T,
): Promise<T>
```

Exact API can differ, but the architecture must centralize task-state mutation.

## Key Requirements

The transaction layer must:

1. Pull latest task-state before mutation.
2. Capture the base task-state HEAD.
3. Load tasks from fresh state.
4. Apply caller mutation against fresh state.
5. Validate state before commit.
6. Append an event-log entry for every mutation.
7. Commit all task-state changes with a structured commit message.
8. Push task-state.
9. On non-fast-forward conflict:
   - abort/reset local mutation if needed
   - pull/rebase or fetch/reset safely
   - reload fresh state
   - re-run the mutation function against fresh state
   - retry with jitter
10. Return structured success/failure information.
11. Avoid swallowing push failures silently.
12. Support privileged recovery-mode mutations for doctor operations.

## Important Constraint

Do not rewrite every existing command in this task unless the implementation is small and safe.

The minimum acceptable outcome is:

- transaction core exists
- tests prove it works
- at least one low-risk command or synthetic test mutation uses it
- follow-up tasks can migrate commands to it

## Tests Required

Add tests for:

1. Successful transaction writes and pushes.
2. No-op transaction produces no unnecessary commit.
3. Invariant failure aborts transaction.
4. Push failure returns/throws structured failure.
5. Non-fast-forward conflict causes reload and retry.
6. Mutation function is re-run against fresh state after conflict.
7. Event log entry is appended.
8. Direct mutation helpers are not required by the transaction caller.
9. Recovery-mode transaction records elevated capability.

Mock git operations. Do not require real network pushes.

## Acceptance Criteria

- `src/core/task-state-transaction.ts` or equivalent exists.
- It provides a single reusable mutation boundary.
- It does not silently swallow push failures.
- It supports retry/reload/reapply semantics.
- It supports invariant-validation hooks.
- It supports event-log hooks.
- It supports doctor/recovery-mode mutations.
- Tests cover success, conflict, failure, no-op, and recovery-mode behavior.
- Existing tests still pass.

## Dependencies

None.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

# TASK-046: Add State Invariant Validator and CI/Doctor Gate

## Priority

P0

## Type

Feature / Test / Infrastructure

## Risk

High

## Goal

Add a centralized invariant validator for task-state and expose it through CLI and doctor checks.

The validator should detect logically impossible or suspicious task states before they are committed, pushed, or accepted by CI.

## Motivation

Observed inconsistent state proves the current system allows invalid combinations, such as:

```yaml
status: Done
assignee: some-session
claimed_at: some-time
```

A task marked `Done` must not retain an active claim.

The project needs an explicit invariant layer that can run:

- inside the transaction layer
- inside `taskforge doctor`
- as `taskforge validate-state`
- in CI
- in a future GitHub branch-protection check for task-state commits

## Required Design

Create a validator module.

Suggested file:

```text
src/core/state-validator.ts
```

Suggested API:

```ts
export type ValidationSeverity = "error" | "warning";

export interface StateValidationIssue {
  severity: ValidationSeverity;
  code: string;
  taskId?: string;
  filePath?: string;
  message: string;
  suggestedFix?: string;
}

export interface StateValidationResult {
  ok: boolean;
  errors: StateValidationIssue[];
  warnings: StateValidationIssue[];
}

export function validateTaskState(tasks: ParsedTask[]): StateValidationResult;
```

Expose CLI command:

```bash
taskforge validate-state
taskforge validate-state --json
taskforge validate-state --strict
```

## Required Invariants

At minimum validate:

1. `Done` must not have `assignee` or `claimed_at`.
2. `Ready` must not have `assignee` or `claimed_at`.
3. `Rejected` must not have `assignee` or `claimed_at`.
4. `Deferred` must not have `assignee` or `claimed_at`.
5. `In Progress` should have `assignee`.
6. `In Progress` should have `claimed_at`.
7. `Blocked` must have `blocked_reason`.
8. `Blocked` should have `blocked_since`.
9. `Blocked` should have `blocked_by`.
10. Task filename must match frontmatter `id`.
11. Task IDs must be unique.
12. `dependsOn` entries must reference existing task IDs.
13. Tasks must not depend on themselves.
14. Circular dependencies must be detected.
15. If a task has `worktree`, the path should be syntactically plausible.
16. If a task has `branch`, the branch should match the expected agent branch pattern or be explicitly allowed.
17. Control files such as `.doctor-lock` should have valid JSON when present.
18. If `.doctor-lock` exists, it must reference a recovery task unless explicitly created as a manual temporary lock.
19. If `.doctor-lock` references a recovery task, that task must exist.
20. If `.doctor-lock` references a recovery task, that task must not be `Done` unless lock removal is pending in the same transaction.
21. Only doctor/recovery events should create or remove `.doctor-lock`.

Do not overfit the first version. It should be useful and extensible.

## Doctor Integration

Update `taskforge doctor` to call the validator and include invariant failures in the doctor report.

If `doctor --fix` already exists, do not auto-fix high-risk invariant failures unless the fix is unambiguous.

Unambiguous examples:

- `Done + assignee/claimed_at`: clear claim fields.
- `Ready + assignee/claimed_at`: clear claim fields.
- expired `.doctor-lock` with completed recovery task: remove lock with recovery event.

Ambiguous examples:

- `In Progress` missing assignee: do not guess.
- broken dependency: do not guess.
- doctor-lock with missing recovery task: create a follow-up recovery task, do not silently remove lock unless expired and explicitly forced by admin/recovery mode.

## Transaction Integration

If TASK-045 exists, the transaction layer should be able to call the validator before commit.

If TASK-045 is not complete, design the validator so it can be imported later.

## Tests Required

Add tests for every invariant listed above.

Include tests for:

- valid state
- invalid state with errors
- warning-only state
- JSON CLI output
- strict mode treating warnings as failures if implemented
- doctor integration
- doctor-lock with missing recovery task
- doctor-lock with completed recovery task
- expired doctor-lock behavior

## Acceptance Criteria

- Validator module exists.
- CLI command `validate-state` exists.
- JSON output works.
- Doctor includes validator issues.
- Invariant failures are structured with codes.
- Doctor-lock consistency is validated.
- Tests cover core invariants and doctor-lock invariants.
- Existing tests pass.

## Dependencies

Prefer after TASK-045, but can be implemented independently if needed.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

# TASK-047: Make `start` Two-Phase: Durable Claim Before Worktree Creation

## Priority

P0

## Type

Bug / Refactor / Reliability

## Risk

Medium

## Goal

Refactor `taskforge start` so it durably claims the task before creating the worktree/branch.

## Motivation

Current `start` flow creates or touches the worktree before the claim push is confirmed. If the push fails, or another agent wins the race, TaskForge can leave behind:

- orphan worktree
- orphan branch
- local unpushed task-state mutation
- misleading agent notes
- a workspace for a task the agent does not own

The correct flow should be:

```text
pull latest task-state
sweep stale claims
check doctor lock
durably claim task
push claim successfully
create worktree / branch
record branch/worktree metadata
push metadata
print instructions
```

This makes failure states recoverable and explicit.

## Required Design

Refactor `cmdStart()` into two durable phases.

### Phase 1: Claim

1. Pull latest task-state.
2. Run sweeper.
3. Check doctor lock.
4. Load task.
5. Validate status.
6. Check outstanding session tasks.
7. Generate session ID.
8. Claim task by setting:
   - `status: In Progress`
   - `assignee`
   - `claimed_at`
9. Commit and push claim through the transaction layer or current best safe mutation path.
10. If push fails, do not create a worktree.

### Phase 2: Workspace

1. Create worktree/branch only after claim push succeeds.
2. Record:
   - `branch`
   - `worktree`
3. Commit and push metadata update.
4. If worktree creation fails after claim, leave task claimed and append/report a recoverable note or mark blocked/recovery-needed if appropriate.

## Important Constraint

Do not make `start` weaker by relying only on local state.

Remote propagation of the claim is required before workspace creation.

## Tests Required

Add tests proving:

1. If claim push fails, no worktree is created.
2. If another agent claims during retry, no worktree is created.
3. If worktree creation succeeds, metadata is persisted.
4. If worktree creation fails after claim, task remains claimed and error is clear.
5. Existing resume/idempotent behavior still works where intended.
6. JSON mode reports each phase accurately.
7. `start` refuses when doctor mode is active unless this is the doctor recovery task and the caller has recovery capability.

Mock git/worktree operations.

## Acceptance Criteria

- `start` does not create a worktree before durable claim success.
- Failed claim leaves no orphan worktree.
- Worktree metadata is persisted only after workspace creation.
- Failure modes are clear in human and JSON output.
- Doctor lock is respected before work begins.
- Existing tests pass.

## Dependencies

Prefer after TASK-045. Can be done before with careful use of current mutation path.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

# TASK-048: Replace Low-Level `jitteredPush` With Transactional CAS Reapply Semantics

## Priority

P0

## Type

Refactor / Reliability

## Risk

High

## Goal

Replace the current low-level `jitteredPush()` optimistic concurrency behavior with true transactional compare-and-reapply semantics.

## Motivation

The current `jitteredPush()` stages and commits local changes, then attempts to push. On non-fast-forward rejection, it pulls/rebases and then calls `onConflict`.

This is not a true compare-and-swap model because the local mutation may already be part of the rebased local state. The conflict callback can inspect a state that includes the caller’s attempted mutation, not the clean remote state.

Correct behavior:

```text
fetch/pull fresh state
capture base HEAD
apply mutation in memory
validate
commit
push
if rejected:
  discard/reload local mutation
  fetch/pull fresh state
  re-run mutation against fresh remote state
  retry
```

The mutation function must be re-applied to fresh state, not rebased as an already-committed local change.

## Required Design

Build on TASK-045 if available.

Replace or deprecate:

```text
jitteredPush()
commitAndPushTaskState()
```

for production lifecycle commands.

New flow should be transaction-oriented:

```ts
await transactionalMutateTaskState({
  command: "claim",
  actor,
  maxRetries: 3,
  jitterMinMs: 2000,
  jitterMaxMs: 10000,
}, async (state) => {
  const task = state.loadTask(taskId);
  state.assertExpected(task.status === STATUS.READY);
  state.claim(taskId, sessionId);
});
```

## Required Behavior

1. Retry only on recoverable non-fast-forward conflicts.
2. Re-read fresh remote task-state on every retry.
3. Re-run mutation callback on fresh state.
4. Abort cleanly if mutation preconditions no longer hold.
5. Do not leave local divergent commits after abort.
6. Do not swallow unrecoverable git errors.
7. Return structured result.
8. Preserve jittered backoff behavior.
9. Support doctor/recovery-mode mutations as explicit privileged transactions.

## Migration Scope

Migrate at least these commands away from direct `jitteredPush()` if feasible:

```text
claim
start
sweep
heartbeat
done
block
unlock
doctor-lock creation/removal
```

If full migration is too large, migrate the highest-risk commands first:

```text
claim
start
sweep
doctor-lock creation/removal
```

Document remaining commands as follow-up work.

## Tests Required

Add tests for:

1. Successful mutation.
2. Non-fast-forward conflict then successful retry.
3. Conflict where another agent has claimed the task, mutation aborts.
4. Unrecoverable git error returns/throws failure.
5. Local state is reset/reloaded before retry.
6. Mutation callback invocation count equals retry count.
7. No partial local commits remain after abort if testable.
8. Doctor-lock creation/removal uses the transaction path.

## Acceptance Criteria

- Transactional CAS/reapply path exists.
- High-risk lifecycle commands use it or have follow-up tasks created.
- `jitteredPush()` is deprecated, renamed unsafe, or no longer used by high-risk commands.
- Doctor-lock creation/removal uses controlled mutation semantics or is explicitly marked as follow-up.
- Tests cover conflict/retry semantics.
- Existing tests pass.

## Dependencies

TASK-045 strongly recommended.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

# TASK-049: Add Branch Protection / Ruleset Guidance for `task-state`

## Priority

P1

## Type

Documentation / Infrastructure

## Risk

Medium

## Goal

Document and, where possible, implement repository protections that prevent normal agents from directly pushing to the `task-state` branch.

## Motivation

CLI-level guardrails are not enough if agents retain raw git write access.

If an agent can run:

```bash
git checkout task-state
vim TASK-123.md
git commit -am "done"
git push origin task-state
```

then it can bypass:

- ownership checks
- transition validation
- sweeper policy
- doctor lock
- gates
- invariant validation
- event logging

To prevent this in general, the remote repository must enforce task-state rules.

## Required Documentation

Create docs such as:

```text
docs/control-plane-hardening.md
docs/github-task-state-protection.md
```

Include recommended GitHub settings:

1. Protect branch `task-state`.
2. Disallow direct pushes by normal users/tokens.
3. Require pull request or bot/App mediated updates.
4. Require `taskforge validate-state --strict`.
5. Require event-log/invariant validation check.
6. Restrict who can dismiss/override checks.
7. Protect `main` separately.
8. Use separate credentials for:
   - read-only agents
   - implementation agents
   - recovery/admin/bot
9. Do not give general coding agents push permission to `task-state`.
10. Explain emergency recovery procedure.
11. Explain that `.doctor-lock` is cooperative unless branch protection or brokered writes are in place.
12. Explain how doctor-mode recovery should work under branch protection.

## Optional Implementation

If feasible, add a GitHub Actions workflow:

```text
.github/workflows/task-state-validate.yml
```

It should run on PRs or pushes affecting the `task-state` branch and execute:

```bash
npm ci
npm run build
node dist/cli.js validate-state --strict --json
```

If task-state branch does not contain source code, the workflow may need to check out `main` for code and `task-state` for data. Document the chosen approach.

## Required Threat Model Section

Document explicitly:

```text
TaskForge CLI guardrails and doctor-lock are cooperative unless task-state write access is restricted.
Hard enforcement requires repository permissions, branch protection, or a broker service.
```

## Tests / Validation

If adding workflow/config files, validate syntax where practical.

If documentation only, ensure links and commands are accurate.

## Acceptance Criteria

- Documentation explains why direct task-state push access is unsafe.
- Documentation provides concrete GitHub branch protection/ruleset configuration.
- Documentation explains credential separation by agent capability.
- Documentation clearly classifies doctor-lock as cooperative without branch protection/broker.
- Optional CI workflow exists or a follow-up task is created.
- Existing tests pass if code is changed.

## Dependencies

Can be done independently. Strongly benefits from TASK-046.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

If docs-only, still run relevant checks if project expects it.

---

# TASK-050: Split Generic `--force` Into Explicit Privileged Override Modes

## Priority

P1

## Type

Security / Reliability / Refactor

## Risk

Medium

## Goal

Replace broad, ambiguous `--force` behavior with explicit override modes and privileged recovery checks.

## Motivation

Generic `--force` is too powerful and too vague. Agents can use it to bypass unrelated safeguards without acknowledging what they are overriding.

Examples of distinct override types:

```text
ownership override
transition override
gate override
cleanup override
doctor recovery override
branch deletion override
doctor-lock override
```

These should not all be controlled by the same flag.

## Required Design

Audit all commands that accept `--force`, including at least:

```text
start
claim
done
block
unlock
heartbeat
sweep
doctor
doctor-lock removal
cleanup-related flows
```

Replace or supplement generic `--force` with explicit flags, such as:

```text
--force-ownership
--force-transition
--force-gates
--force-cleanup
--doctor-recovery
--doctor-unlock
--admin
```

Exact names can vary, but each override must be explicit.

## Privilege Model

Tie dangerous overrides to capability levels where possible.

If a capability system already exists, use it.

Expected levels:

```text
normal agent
reviewer/qa
doctor/recovery agent
admin/human
```

Normal implementer agents should not be allowed to:

- override ownership
- override doctor lock
- mark done despite failed gates
- delete branches with unmerged work
- clear another session's claim
- remove doctor lock
- complete the doctor recovery task unless assigned as doctor/recovery actor

If hard enforcement is not yet possible, the command should at minimum:

- emit structured warnings
- require explicit flag names
- record event-log entries
- make doctor detect override use

## Backward Compatibility

Do not abruptly break all existing workflows without a migration path.

Options:

1. Keep `--force` temporarily but print deprecation warnings.
2. Map `--force` to the appropriate explicit flag only for one release.
3. Reject `--force` on high-risk commands with a clear error.

Prefer safety over convenience for high-risk commands.

## Tests Required

Add tests for:

1. `done` gate override requires `--force-gates` or privileged equivalent.
2. ownership override requires `--force-ownership`.
3. unlock another session requires recovery/admin mode.
4. branch deletion requires explicit cleanup/branch deletion flag.
5. doctor lock removal requires `--doctor-unlock` or recovery/admin capability.
6. old `--force` behavior warns or fails according to chosen migration policy.
7. JSON mode reports override use.
8. event log records override use.

## Acceptance Criteria

- Generic `--force` is no longer the only control for unrelated override types.
- Dangerous overrides are explicit.
- Doctor-lock override/removal is explicit and privileged.
- Override use is logged/auditable.
- Normal agent path remains simple for non-dangerous actions.
- Tests cover new override behavior.
- Documentation updated.

## Dependencies

Prefer after TASK-045 and TASK-046.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

# TASK-051: Harden Doctor Mode as a Transactional Global Recovery Protocol

## Priority

P0

## Type

Feature / Reliability / Recovery

## Risk

High

## Goal

Turn doctor mode from a cooperative lock-file convention into a coherent, auditable recovery protocol that creates a recovery task, pauses normal agents, allows only doctor/recovery work, and clears the lock only when the recovery task completes through controlled mutation.

## Motivation

The current doctor-lock concept is sane but incomplete as a control-plane mechanism.

Current design intent:

```text
taskforge doctor --fix
  -> creates .doctor-lock
  -> creates recovery task
  -> normal agents pause
  -> doctor agent fixes state
  -> recovery task marked Done
  -> .doctor-lock removed
```

This is correct, but must be implemented and hardened so that:

1. lock creation and removal are transactional,
2. the lock references a recovery task,
3. normal agents refuse to act while lock is active,
4. doctor/recovery agent may only work the recovery task,
5. lock removal requires recovery task completion,
6. every lock lifecycle event is event-logged,
7. expired locks are handled safely,
8. invalid lock states are detected by doctor/validator.

## Required Design

Doctor mode should have explicit state.

Recommended lock file:

```text
task-state/.doctor-lock
```

Recommended JSON shape:

```json
{
  "schema": 1,
  "reason": "Done tasks still have active claims",
  "created": "2026-05-22T10:00:00Z",
  "ttl_hours": 1,
  "recoveryTaskId": "TASK-051",
  "createdBy": "doctor:session-id-or-actor",
  "mode": "doctor_recovery"
}
```

If possible, move future control files into:

```text
task-state/.control/doctor-lock.json
```

But do not break compatibility with existing `.doctor-lock` unless migration is included and tested.

## Required Lifecycle

### Entering doctor mode

`taskforge doctor --fix` or equivalent should:

1. Run state validation.
2. Detect critical issues.
3. Create a doctor recovery task containing:
   - issue list
   - suggested fixes
   - allowed files/commands
   - verification criteria
4. Create `.doctor-lock` referencing that recovery task.
5. Commit and push both in one transaction.
6. Emit JSON/human output with:
   - lock reason
   - recovery task ID
   - next command for doctor agent.

### While doctor mode is active

Normal agent commands must refuse:

```text
next
claim
start
heartbeat for non-recovery tasks
done for non-recovery tasks if it mutates task-state
block for non-recovery tasks
sweep unless explicitly recovery-mode
```

Doctor/recovery agent may:

1. inspect state,
2. run doctor,
3. work the recovery task,
4. apply validator-approved fixes,
5. complete the recovery task.

### Completing doctor recovery

When the recovery task is marked `Done`, the system should:

1. re-run validation,
2. verify critical issues are resolved,
3. remove `.doctor-lock`,
4. record doctor-mode completion event,
5. commit/push through transaction layer.

If validation still has critical errors, do not clear the lock unless an explicit privileged override is used.

### Expired doctor lock

TTL expiration should not silently make the system safe.

On expired lock:

- normal agents may be allowed to proceed only if policy says so,
- but they must emit a warning,
- doctor/validator should report expired lock,
- preferred behavior is to create or require a follow-up recovery task.

Recommended safer default:

```text
expired lock -> blocked for normal agents unless --allow-expired-doctor-lock is explicitly configured
```

But if current behavior already proceeds after TTL, document this as cooperative mode and create a follow-up if changing behavior is too broad.

## Required Integration Points

Update or verify:

```text
src/core/doctor-lock.ts
src/commands/doctor.ts
src/commands/next.ts
src/commands/claim.ts
src/commands/start.ts
src/commands/done.ts
src/commands/block.ts
src/commands/heartbeat.ts
src/core/capabilities.ts
src/core/task-state-transaction.ts
src/core/state-validator.ts
```

Exact file list depends on existing implementation.

## Tests Required

Add tests for:

1. `doctor --fix` creates lock when critical issues exist.
2. `doctor --fix` creates a recovery task.
3. `.doctor-lock` references the recovery task.
4. `next` refuses while doctor lock is active.
5. `claim` refuses while doctor lock is active.
6. `start` refuses while doctor lock is active.
7. Doctor/recovery actor can start the recovery task.
8. Normal agent cannot start non-recovery task while lock is active.
9. `done` on recovery task removes lock only if validation passes.
10. `done` on recovery task does not remove lock if critical issues remain.
11. `doctor --unlock` or equivalent requires explicit privileged flag.
12. Expired lock behavior is deterministic and tested.
13. Invalid lock JSON is reported by doctor/validator.
14. Lock creation/removal appends events.

Mock git/transaction writes. Do not require real network pushes.

## Acceptance Criteria

- Doctor mode is explicitly modeled as a recovery protocol, not just a loose file convention.
- `doctor --fix` creates both lock and recovery task when critical issues exist.
- Lock references recovery task.
- Normal agent lifecycle commands pause while lock is active.
- Recovery task can be worked by doctor/recovery actor.
- Completing recovery task removes lock only after validation passes.
- Lock lifecycle is event-logged.
- Invalid/expired lock states are detected.
- Tests cover lock lifecycle, recovery task behavior, agent refusal, and lock clearing.
- Existing tests pass.

## Dependencies

Recommended dependencies:

```text
dependsOn:
  - TASK-045
  - TASK-046
  - TASK-050
```

If TASK-045/TASK-046 are not complete, this task may be split into:

1. document/verify current cooperative doctor mode,
2. implement full transactional doctor mode later.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm test -- --run
```

---

## Task Creation Instructions

When creating these tasks:

1. Use the existing TaskForge task file format.
2. Put files in the authoritative task-state worktree/branch, not legacy `main/tasks`.
3. Use `dependsOn` to encode ordering:

Suggested ordering:

```text
TASK-045: no dependency
TASK-046: dependsOn TASK-045 if practical, otherwise no dependency
TASK-047: dependsOn TASK-045
TASK-048: dependsOn TASK-045
TASK-049: dependsOn TASK-046
TASK-050: dependsOn TASK-045, TASK-046
TASK-051: dependsOn TASK-045, TASK-046, TASK-050
```

4. Use `status: Ready` for TASK-045.
5. Use `status: Ready` with `dependsOn` for dependent tasks if the scheduler respects dependencies.
6. Use `priority: P0` for TASK-045, TASK-046, TASK-047, TASK-048, and TASK-051.
7. Use `priority: P1` for TASK-049 and TASK-050.
8. Use `riskLevel: High` for TASK-045, TASK-046, TASK-048, and TASK-051.
9. Use `riskLevel: Medium` for TASK-047, TASK-049, and TASK-050.
10. Use `humanInterventionRequired: false` unless the task specifically requires repository-admin configuration that cannot be done by an agent.
11. For TASK-049, set `humanInterventionRequired: true` if branch protection must be configured manually in GitHub.

## Global Acceptance Criteria

This task-creation pass is complete when:

- All seven task files exist in task-state, or existing IDs are preserved and next available IDs are used.
- Each task is agent-ready and detailed enough to implement without guessing.
- The tasks are ordered coherently using `dependsOn`.
- The task text explains the race-condition/recovery/direct-manipulation motivation.
- Doctor mode is explicitly covered as a global recovery protocol, not only as a lock file.
- The tasks do not ask agents to implement everything at once.
- No source-code implementation is performed in this pass unless explicitly required by task creation mechanics.
- A final summary lists created task IDs, titles, dependencies, and risk levels.

## Verification for Task Creation

After creating the task files, run:

```bash
taskforge list --json
taskforge validate-state --json
```

If `validate-state` does not exist yet, run:

```bash
taskforge list --json
taskforge status --json
```

Then report:

1. Created files.
2. Task IDs.
3. Dependencies.
4. Any conflicts with existing task IDs.
5. Any validation warnings.

---

<a id="section-6-post-doctor-resume-policy-prompt"></a>

# Section 6: Post-Doctor Resume Policy Prompt

 cases or limitations.

---

## Update Required for TASK-051

When creating or updating TASK-051, add this section:

### Post-Doctor Resume Is Required

Clearing doctor mode must not cause paused agents to blindly continue.

When doctor mode clears, agents must run the resume/revalidation protocol from TASK-052 or equivalent.

Doctor-mode completion should record enough information to support resume decisions, including:

- recovery task ID
- affected tasks
- changes made
- tasks reset/rejected/deferred/done
- claims cleared
- dependencies changed
- timestamp when doctor mode cleared

If full event logging is not available yet, record this information in the doctor recovery task result section and create follow-up event-log work.

---

## Alternative Architectures to Consider

The lock-file doctor mode is acceptable as a cooperative local control-plane mechanism, but it is not the only design.

Future agents should evaluate these alternatives before overfitting to lock files:

### Option A: Cooperative lock file in task-state

Current approach.

Pros:

- Simple
- Markdown/git-native
- Easy for humans to inspect
- Works without services

Cons:

- Agents with raw write access can ignore or remove it
- Enforcement is cooperative
- Requires strict discipline and validation

Use this as the MVP.

### Option B: Protected branch + bot-mediated task-state writes

Agents cannot push directly to `task-state`.

They submit changes through:

- GitHub App
- GitHub Action
- privileged bot token
- controlled CLI service

Pros:

- Stronger enforcement
- Works with GitHub audit trails
- Prevents raw push bypass

Cons:

- More setup
- Requires credential separation
- Slower than direct local file edits

Recommended for real multi-agent use.

### Option C: Local control-plane daemon / broker

Agents talk to a local service over a Unix socket or localhost HTTP API.

Only the broker can mutate `task-state`.

Pros:

- Strong local enforcement
- Can hold locks, leases, and transactions in memory
- Can mediate all claims, heartbeats, and recovery

Cons:

- More moving parts
- Broker availability matters
- Less purely git-native

Good fit for local multi-agent orchestration.

### Option D: Event-sourced control plane

Markdown task files become materialized views.

Authoritative state transitions are append-only events.

Pros:

- Excellent auditability
- Easy to detect manual YAML edits
- Better recovery semantics

Cons:

- More implementation work
- Requires event compaction/materialization logic

Recommended medium-term direction, especially for doctor/recovery.

### Option E: Database-backed state store

Use SQLite/Postgres for active leases and transactions; sync Markdown for human view.

Pros:

- Best concurrency model
- Real transactional semantics
- Strong lease support

Cons:

- Less repo-native
- More infrastructure
- More conceptual weight

Probably overkill for TaskForge MVP, but viable if agent count increases.

## Recommended Direction

Use a staged architecture:

```text
Stage 1: Cooperative doctor-lock + resume-check + validator
Stage 2: transactional mutation layer + event log
Stage 3: branch protection or local broker for hard enforcement
Stage 4: optional database/event-sourced backend if needed
```

Do not assume the lock file alone is sufficient.

---
