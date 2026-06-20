# task-forge

TaskForge Autonomous Coding Board — a repo-centered task management and execution system for agentic software development.

The canonical current workflow for agents and humans is [docs/workflow.md](../docs/workflow.md). Historical specs in this directory may describe gaps, task packs, or planned behavior; prefer the live CLI and workflow contract for operation.

## Overview

TaskForge combines:

- A human-visible task board
- Repo-native Markdown task specifications
- Isolated agent workspaces using git worktrees
- Task branches and pull requests
- Automatic continuation policies
- Explicit human-intervention gates
- Project status summaries

## Quick Start

```bash
# View next actionable task
taskforge next

# List all tasks with filters
taskforge list
taskforge list --status "In Progress" --json

# View project status
taskforge status

# View full summary
taskforge summary

# Start a task (creates worktree + branch + locks task)
taskforge start TASK-001

# Extend lease on active task (prevents sweeper reclaim)
taskforge heartbeat TASK-001

# Recover tasks from crashed agents
taskforge sweep

# Mark task as done (cleans worktree)
taskforge done TASK-001 --cleanup

# Run dependency health scan
taskforge deps scan
```

## Structure

```
TASKFORGE.md          # System specification
src/                  # TypeScript CLI source
scripts/              # Thin Bash wrapper → TypeScript CLI
specs/                # Design specifications
docs/decisions/       # Architecture decision records
logs/taskforge/       # Task execution logs
tests/                # Vitest test suite
../task-state/        # Authoritative task state (shared sibling worktree)
../worktrees/          # Per-task isolated agent workspaces (sibling, git-required)
```

> **Note:** The authoritative task state lives in `../task-state/`, a dedicated git worktree on the `task-state` branch. The `tasks/` directory on `main` is legacy/backward-compatible only. Agents must never create or modify `main/tasks/*.md` — use `taskforge start TASK-NNN` which manages task files through the task-state worktree automatically. See [TASKFORGE.md](TASKFORGE.md) for full details.

## Task Workflow

```
Inbox → Needs Spec → Ready → In Progress → Review → Verify → Done
                         ↓
                      Blocked
```

Task state files live on the dedicated `task-state` branch (shared sibling worktree at `../task-state/`). This branch is the single source of truth — every agent reads from and writes to it. Task state changes are auto-committed and auto-pushed to enable multi-agent coordination.

See [TASKFORGE.md](TASKFORGE.md) for the full specification, including the Sweeper Protocol (auto-recovery of stale >4h claims) and optimistic concurrency (jittered retry on push rejection).

## CLI Commands

| Command | Description |
|---|---|
| `taskforge init` | Initialize TaskForge in this repo |
| `taskforge init --agent-framework opencode` | Init with OpenCode agent policy |
| `taskforge next` | Return highest-priority safe task |
| `taskforge claim TASK-N` | Claim a task (set assignee) without creating worktree |
| `taskforge start TASK-N` | Set up worktree, branch, begin task |
| `taskforge resume TASK-N` | Re-enter an existing task workspace |
| `taskforge gates` | Run verification gates |
| `taskforge status` | Show project status summary |
| `taskforge summary` | Show full project summary |
| `taskforge list` | List and filter tasks (--status, --priority, --search) |
| `taskforge inspect TASK-N` | Inspect worktree/branch/dirty state |
| `taskforge gates` | Run verification gates (typecheck, lint, build, test) |
| `taskforge heartbeat TASK-N` | Extend Sweeper lease on active task |
| `taskforge block TASK-N "reason"` | Mark task as blocked |
| `taskforge done TASK-N` | Mark task as done (--cleanup, --delete-branch) |
| `taskforge promote TASK-N` | Advance a task through the status state machine (--to) |
| `taskforge release TASK-N` | Voluntarily release a claim |
| `taskforge unlock TASK-N` | Manually unlock a task (requires --force, human/doctor) |
| `taskforge update TASK-N` | Update editable task spec fields (--from-file) |
| `taskforge agents --recover` | Mark stale registry entries as crashed |
| `taskforge reject TASK-N "reason"` | Mark a task as rejected (obsolete, won't implement) |
| `taskforge sweep` | Sweeper Protocol — recover stale in-progress tasks |
| `taskforge validate-state` | Validate task-state for invariant violations |
| `taskforge doctor` | Run diagnostic checks on repo health |
| `taskforge prompt TASK-N` | Emit agent execution packet |
| `taskforge config-validate` | Validate .taskforge/config.json |
| `taskforge cleanup TASK-N` | Remove task worktree and branch safely |
| `taskforge report TASK-N` | Generate structured completion report |
| `taskforge new "Title"` | Create a new task file |
| `taskforge audit TASK-N` | Show audit events for a task |
| `taskforge transcript TASK-N` | Show readable transcript for a task |
| `taskforge timeline TASK-N` | Show event timeline summary for a task |
| `taskforge ac-check [TASK-N]` | Scan task files for acceptance criteria issues |
| `taskforge mcp` | Start a Model Context Protocol (MCP) server for TaskForge |
| `taskforge guard status` | Show mutation boundary enforcement status |
| `taskforge guard override TASK-N COMMAND "reason"` | Issue a time-limited mutation override (doctor only) |
| `taskforge sync` | Sync with external issue tracker |
| `taskforge deps scan` | Run broad dependency health checks |
| `taskforge deps audit` | Run package-manager-native audit |
| `taskforge deps outdated` | Report outdated direct dependencies |
| `taskforge deps deprecated` | Check for deprecated packages |
| `taskforge deps plan` | Produce a dependency remediation plan |
| `taskforge deps create-tasks` | Create dependency tasks from findings |
| `taskforge deps pr` | Create focused dependency update PRs |
| `taskforge deps summary` | Produce a dependency health summary |

## Tech Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript
- **CLI**: Commander.js
- **Git**: simple-git + execa
- **Schema**: zod
- **Markdown**: gray-matter (YAML frontmatter)
- **Tests**: vitest
- **Build**: tsup

See [TASKFORGE.md](TASKFORGE.md) for the full specification.

## Documentation

- `docs/deployment/container-runtime.md` — Container-first deployment guide
- `docs/agent-framework-integration.md` — Agent framework adapter system, audit events, generated files, hooks, plugins, and extension author workflow. Read this when integrating TaskForge with a new coding agent framework.
- `docs/control-plane-hardening.md` — Security threat model and hardening
- `docs/architecture/` — Architectural decisions
- `docs/decisions/` — Architecture decision records
