# TaskForge Autonomous Coding Board

A repo-centered task management and execution system for agentic software development.

## Core Mission

TaskForge exists to manage software work for an agentic coding team. It combines:

- A human-visible task board
- Repo-native Markdown task specifications
- Isolated agent workspaces using git worktrees
- Task branches and pull requests
- Automatic continuation policies
- Explicit human-intervention gates
- Project status summaries

## Operating Model

Three layers:

1. **Human-visible board** — GitHub Issues/Projects, Plane, Linear, Jira, or repo-native Markdown
2. **Repo-native task specs** — the execution contract (these Markdown files)
3. **Agent execution in isolated worktrees** — the isolation boundary

The board is for visibility. The Markdown task spec is the execution contract. The worktree/branch is the isolation boundary. The pull request is the review boundary. The test suite and CI are the verification boundary.

## Architecture

```
Human Interface
  ├─ GitHub Issues / GitHub Projects
  ├─ Plane
  ├─ Linear
  ├─ Jira
  └─ Repo-native Markdown task files

Main Branch (source code, specs, docs)
  ├─ TASKFORGE.md          (this file)
  ├─ AGENTS.md             (if present)
  ├─ specs/
  ├─ docs/decisions/
  ├─ tests/
  ├─ logs/taskforge/
  └─ scripts/
      └─ taskforge              (thin wrapper → TypeScript CLI)

Task State (on dedicated task-state branch, see §Task State Storage below)
  ../task-state/
  ├─ README.md
  ├─ TEMPLATE.md
  └─ TASK-NNN.md / FEATURE-NNN.md / BUG-NNN.md / etc.

Agent Worktrees (per-task git worktrees)
  ../worktrees/
  └─ TASK-NNN/                 (one per active task)

Execution Layer
  ├─ OpenCode or compatible CLI coding agent
  ├─ Git worktrees
  ├─ Task branches
  ├─ Local tests
  ├─ CI
  └─ Pull requests
```

## Task State Storage

**This section is the authoritative description of how task files are stored. It supersedes any earlier references to a `tasks/` directory on the `main` branch.**

### Ground Truth

Task files live on a dedicated **`task-state`** git branch, **not** on `main`. The `task-state` branch is the single source of truth:

- **Location**: A git worktree at `../task-state/` (sibling to the main repo)
- **Contents**: Only task Markdown files (`TASK-NNN.md`, `FEATURE-NNN.md`, `BUG-NNN.md`, etc.), a `README.md`, and `TEMPLATE.md`
- **Accessible from**: The main repo checkout and every agent worktree (all are siblings of `../task-state/`)
- **Initialized by**: `taskforge init` — creates the branch, seeds template files, sets up the worktree

```
/Volumes/Transcend/devel/
  ├── task-forge/               (main branch — source code)
  ├── task-state/               (task-state branch — task data only)
  └── worktrees/
      └── TASK-NNN/             (agent worktree branches)
```

### Propagation Model

Every mutation to a task file triggers an immediate **auto-commit + auto-push** to the `task-state` branch:

| Operation | What happens |
|---|---|
| `taskforge start TASK-123` | Writes `assignee`/`claimed_at` → commits + pushes |
| `taskforge done TASK-123` | Clears `assignee`/`claimed_at`, updates status → commits + pushes |
| `taskforge block TASK-123` | Clears `assignee`/`claimed_at`, updates status → commits + pushes |
| `taskforge unlock TASK-123 --force` | Clears `assignee`/`claimed_at` → commits + pushes |
| `taskforge sync` | Updates from GitHub → commits + pushes |
| Dependency task creation | Creates file → commits + pushes |

This ensures state propagates instantly to all agents. No agent ever reads stale data.

### Why Not `main`'s `tasks/` Directory?

The previous design stored task files in `tasks/` on `main`. This broke when agent worktrees were created before new tasks were committed — the worktree was a git snapshot and couldn't see task files created later. The `task-state` branch decouples task data from code history, making it accessible from any git context.

### Field Names

Task frontmatter uses the following lock-related fields:

| Field | Type | Description |
|---|---|---|
| `assignee` | string (optional) | Session GUID (10-char hex) of the agent currently working on this task. This is a **session identifier**, not a durable human/agent identity. The exact same value is embedded in the branch name (`--<sessionId>`) for ownership verification. |
| `claimed_at` | string or Date (optional) | UTC timestamp when the task was claimed (`YYYY-MM-DD HH:MM:SS` format, YAML-safe). js-yaml may auto-parse this as a Date object; the schema accepts both. |

These fields replace the earlier `lockedBy`/`lockedAt` naming convention.

### The Sweeper Protocol (Deadlock Recovery)

Because agents can crash or disconnect, a deadlock recovery mechanism runs **before** any agent searches for new work:

1. **Scan**: Read all tasks with `status: in_progress` from the `task-state` branch
2. **Check**: For each, compare `claimed_at` against the current UTC time
3. **Threshold**: If `claimed_at` is older than **4 hours**, the agent is presumed dead
4. **Recover**: Reset the task to `status: Ready`, clear `assignee`/`claimed_at`
5. **Propagate**: Commit and push the state change (via `commitAndPushTaskState()`)

The 4-hour threshold assumes no single sub-task takes longer than 4 hours without a status update. Agents that need more time should periodically update their task's `claimed_at` to reset the clock.

This protocol runs automatically inside `taskforge start` and `taskforge next`, and can also be invoked explicitly via `taskforge sweep`.

### Optimistic Concurrency with Jittered Retries

When multiple agents compete for the same task, the claiming process uses optimistic concurrency:

1. Update frontmatter (`assignee`, `claimed_at`, `status: in_progress`)
2. Commit and push to the `task-state` branch
3. **If push rejected** (non-fast-forward):
   - `git pull --rebase` to catch up with the latest state
   - Wait a random **2–10 second jitter** period
   - Re-read the task status from the rebased state
   - If still `Ready`: retry the push
   - If another agent claimed it: drop the task, find another in the Ready queue
4. Up to **3 retries** before giving up

This pattern (common in Kubernetes controllers and etcd-based systems) prevents split-brain without requiring a central lock server.

## Task Types

| Type | Description |
|---|---|
| Epic | Large body of work containing multiple features and tasks |
| Feature | User-visible or system-visible capability |
| Task | Concrete implementation unit |
| Bug | Incorrect behavior requiring reproduction, fix, and regression protection |
| Chore | Maintenance, cleanup, dependency update, or minor infrastructure |
| Research / Spike | Investigation producing a decision memo and follow-up tasks |
| Refactor | Internal structure improvement with no intended behavior change |
| Test | Test coverage, validation harness, regression tests |
| Documentation | README, runbooks, architecture notes, inline docs |
| Infrastructure | Build system, deployment, local environment, CI/CD |
| Security | Auth, permissions, secrets, vulnerabilities |
| Release | Versioning, changelog, deployment packaging, release notes |
| Dependency | Package update, deprecation replacement, version drift |
| Maintenance | Lockfile cleanup, SBOM generation, dependency policy |

## Task Statuses

| Status | Description |
|---|---|
| Inbox | Raw human idea, unprocessed request |
| Needs Spec | Not yet specific enough for implementation |
| Ready | Has sufficient scope, acceptance criteria, and verification strategy |
| In Progress | An agent or human is actively working on it |
| Blocked | Cannot continue without human input or unresolved failure |
| Review | Code or output is ready for review |
| Verify | Implementation done but needs validation or manual confirmation |
| Done | Merged, accepted, and completed |
| Rejected | Invalid, duplicate, not useful, or intentionally closed |
| Deferred | Valid but postponed |

## Board Columns

```
Inbox → Needs Spec → Ready → In Progress → Review → Verify → Done
                         ↓
                      Blocked
```

## Agent Roles

| Role | Purpose |
|---|---|
| Intake Agent | Convert raw human requests into structured task records |
| Planner Agent | Decompose epics/features into safe executable tasks |
| Implementer Agent | Implement one task at a time in isolated worktree |
| QA Agent | Validate behavior, run tests, verify acceptance criteria |
| Reviewer Agent | Review code, scope compliance, correctness, security |
| Continuation Agent | Keep work moving automatically through safe steps |
| Release/Summary Agent | Maintain human-visible project state |
| Dependency Steward Agent | Track dependency health, detect vulnerabilities/deprecations, propose safe fixes |

## Workspace Strategy

Three separate git worktree areas coexist:

### Task State Worktree (`../task-state/`)

A permanent worktree on the `task-state` branch containing only task Markdown files. Created by `taskforge init`. All task read/write operations target this worktree. Every mutation is auto-committed and auto-pushed. See §**Task State Storage** for details.

### Agent Worktrees (`../worktrees/TASK-NNN/`)

Per-task isolated worktrees where implementation happens:

```bash
git worktree add ../worktrees/TASK-123 -b agent/TASK-123-short-title
cd ../worktrees/TASK-123
```

Branch pattern: `agent/TASK-ID-short-description`

Examples:
- `agent/TASK-123-folder-watcher`
- `agent/BUG-042-token-refresh-retry`
- `agent/FEATURE-018-transcript-search`

Do not work directly on `main`, `master`, `develop`, `release/*`, or `production/*` unless explicitly instructed.

## Priority System

| Priority | Description |
|---|---|
| P0 | Urgent correctness, production, security, data-loss, or blocking issue |
| P1 | Important feature or major bug |
| P2 | Normal planned work |
| P3 | Cleanup, polish, documentation, minor improvement |

Work selection rules:
1. Continue already-started safe tasks before starting new ones
2. Prefer unblocking tasks
3. Prefer P0 > P1 > P2 > P3
4. Prefer tasks with clear acceptance criteria
5. Prefer smaller tasks when priority is equal
6. Avoid starting tasks with unresolved dependencies
7. Avoid parallel work that touches the same files

## Automatic Continuation Policy

Continue automatically when the next action is:
- Safe, local, reversible
- Within task scope
- Consistent with acceptance criteria
- Not cost-incurring, destructive, or security-sensitive

### Continue Without Asking For:
- Reading repository files
- Searching the codebase
- Creating task files, branches, worktrees
- Editing files within declared scope
- Adding/updating tests
- Running local tests, linters, formatters, static analysis
- Re-running failed tests after code changes
- Fixing compile errors caused by the task
- Refactoring within scope when needed
- Committing changes
- Opening draft PRs
- Updating task notes and status
- Splitting oversized tasks into proposed subtasks
- Marking tasks blocked with exact reasons

### Stop For Human Intervention:
- Ambiguous product behavior that changes user-visible semantics
- Conflicting requirements
- Destructive data operation
- Production deployment
- External paid API usage
- Cloud resource creation with cost impact
- Credential, token, key, or secret access
- Security-sensitive change outside explicit scope
- Legal/compliance-sensitive decision
- Database migration that may lose or rewrite production data
- Broad architecture change outside task scope
- Dependency or license change with material implications
- Repeated failure after reasonable retries
- Test failure that appears unrelated and cannot be safely isolated
- Missing information that cannot be inferred and materially affects correctness

### Do Not Stop For:
- Unfamiliar codebase
- Tedious work
- Need to discover tests
- Need to add a small helper abstraction
- Need to add a test
- Formatting requirements
- Single local command failure
- Messy existing code
- Multiple reasonable implementation details when one is clearly low-risk
- Obvious and reversible next steps

## Continuation Loop

1. Inspect current task board or task files
2. Find highest-priority task in Ready, In Progress, Verify, or Review
3. Prefer continuing existing In Progress work
4. Check dependencies
5. Check whether the next action is safe
6. If safe, execute the next step
7. Run relevant verification
8. Update task notes
9. Commit focused changes if code changed
10. Open or update draft PR if appropriate
11. Update board/task status
12. Select next safe task
13. Stop only when a real stopping condition exists

## Failure Handling

Reasonable retries:
- 1 retry for transient command/environment failure
- 2-3 iterations for task-caused test or compile failure
- 0 retries for destructive or cost-incurring operations

## Definition of Ready

A task is Ready only when:
- Goal is clear
- Scope is bounded
- Acceptance criteria exist
- Verification method exists
- Dependencies are known
- Risk is identified
- Human intervention is not currently required

## Definition of Done

A task is Done only when:
- Acceptance criteria are satisfied
- Required tests pass or exceptions are documented
- Code changes are committed
- PR is merged or deliverable is accepted
- Task notes are updated
- Board status is updated
- Result summary exists
- Follow-up tasks are created if needed

### Done Command Invariants

The `taskforge done` command enforces these hard pre-conditions. Violation means the task is NOT ready for Done:

1. **Clean worktree**: The task's worktree must have zero uncommitted/dirty files. Uncommitted work means the implementation is incomplete.
2. **Pushed branch**: The task's branch must not be ahead of the remote. Unpushed commits mean the work is not durably stored.
3. **Gates pass**: All verification gates (typecheck, lint, build, test) must pass.
4. **Ownership match**: The current session must own the task claim.
5. **Control files unchanged**: AGENTS.md, TASKFORGE.md, etc. must not have changed since task start.
6. **Acceptance criteria verified**: The AC section exists, is not blank, and all items are checked with evidence.

These invariants are enforced in `cmdDone` and documented here so agents cannot bypass them without `--force` (human/doctor authority only).

## Safe Autonomy Rules

### Agents Have Authority To:
- Continue local development
- Modify in-scope code
- Add tests
- Improve task-local structure
- Commit changes
- Open draft PRs
- Update task files
- Move task status forward when criteria are satisfied
- Move task status backward when validation fails
- Mark tasks Blocked when necessary

### Agents Do Not Have Authority To:
- Deploy to production
- Spend money
- Use paid cloud resources
- Access secrets without explicit approval
- Perform destructive data operations
- Make major architectural changes outside task scope
- Change licensing posture
- Suppress failing tests
- Merge their own PR unless explicitly allowed
- Mark Done without verification

## Integration Preference Order

1. GitHub Issues + GitHub Projects + repo task files
2. Plane + repo task files
3. Linear + repo task files
4. Jira + repo task files
5. Markdown-only repo task files

Always keep repo-native task specs even when using an external issue tracker.

## CLI Commands

| Command | Description |
|---|---|
| `taskforge init` | Initialize TaskForge in this repo |
| `taskforge next` | Return highest-priority safe task to continue |
| `taskforge start TASK-123` | Set up worktree, branch, and begin task |
| `taskforge status` | Show project status summary |
| `taskforge block TASK-123 "reason"` | Mark task as blocked |
| `taskforge done TASK-123` | Mark task as done |
| `taskforge unlock TASK-123 --force` | Manually unlock a task (requires --force) |
| `taskforge sweep` | Sweeper Protocol — detect and recover stale locks |
| `taskforge summary` | Show full project summary |
| `taskforge sync` | Sync with external issue tracker |
| `taskforge deps scan` | Run broad dependency health checks |
| `taskforge deps audit` | Run package-manager-native audit |
| `taskforge deps outdated` | Report outdated direct dependencies |
| `taskforge deps deprecated` | Check for deprecated packages |
| `taskforge deps plan` | Produce a dependency remediation plan |
| `taskforge deps create-tasks` | Create dependency tasks from findings |
| `taskforge deps pr` | Create focused dependency update PRs |
| `taskforge deps summary` | Produce a dependency health summary |

## OpenCode Session Prompt

When launching an OpenCode session:

```
You are operating under TaskForge Autonomous Coding Board.

Read TASKFORGE.md, AGENTS.md if present, and the relevant task file from the task-state worktree (../task-state/).

Use `taskforge start TASK-ID` to create isolated worktrees. Normal agents should not use git directly — use `taskforge checkpoint`, `taskforge submit`, `taskforge diff` instead.

Continue automatically through safe local steps:
- inspect, implement, test, fix, retest, commit
- update task notes
- open/update draft PR if available

Stop only for real human-intervention conditions.

Do not ask for permission between safe steps.

Before ending, always update the task file with:
- what changed
- tests run
- current status
- blockers, if any
- recommended next action
```

## Control-Plane Architecture (v0.2+)

### Transactional Mutation Layer

All task-state mutations flow through `withTaskStateTransaction()`, which provides:

1. **Pull** latest task-state before mutation
2. **Load** fresh state
3. **Apply** mutation via typed transaction API
4. **Validate** invariants before commit
5. **Commit** with structured message
6. **Push** to remote task-state
7. **On conflict**: reload fresh state, re-apply mutation, retry with jitter

This replaces the older `jitteredPush()` for high-risk commands (claim, start, sweep, done).

### Session Guardrails

Before `next`, `claim`, or `start`, the system enforces:

- **Outstanding task check**: You cannot start new work while you own an unclosed task
- **Doctor lock check**: All agents pause when a `.doctor-lock` is active (global recovery)
- **Control-file change detection**: `done` refuses if AGENTS.md, TASKFORGE.md, etc. changed since task start

### Doctor Mode

When `taskforge doctor --fix` detects critical inconsistencies, it creates a `.doctor-lock` file and recovery task. All normal agents pause. Only the recovery agent may work the recovery task. Completing it removes the lock.

### Worktree Path Qualification

Worktrees are qualified with the project name to prevent collisions across repos:
```
../worktrees/<project-name>/TASK-NNN/
```

### State Invariant Validator

`taskforge validate-state` checks for impossible state combinations (Done+assignee, Ready+assignee, Blocked without reason, broken dependencies, circular references, etc.) and runs in CI via `.github/workflows/task-state-validate.yml`.

### CLI Command Surface (complete)

| Command | Category |
|---------|----------|
| `next`, `claim`, `start`, `resume` | Task discovery and claiming |
| `done`, `release`, `reject`, `block`, `unlock` | Lifecycle transitions |
| `status`, `summary`, `list`, `inspect`, `prompt` | Read operations |
| `sweep`, `heartbeat`, `cleanup`, `report` | Maintenance |
| `gates`, `validate-state`, `doctor`, `config-validate` | Quality and health |
| `deps scan/audit/outdated/plan/pr/summary` | Dependency management |
| `new`, `sync` | Task creation and external sync |

## Extension Documentation

- [Agent Framework Integration](docs/agent-framework-integration.md) — How to integrate TaskForge with a new coding agent framework. Covers the adapter system, audit events, generated files, hooks, plugins, and extension author workflow.
