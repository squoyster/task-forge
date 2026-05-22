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
