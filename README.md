# task-forge

TaskForge Autonomous Coding Board — a repo-centered task management and execution system for agentic software development.

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
tasks/                # Legacy task specs (backward-compatible only)
src/                  # TypeScript CLI source
scripts/              # Thin Bash wrapper → TypeScript CLI
specs/                # Design specifications
docs/decisions/       # Architecture decision records
logs/taskforge/       # Task execution logs
tests/                # Vitest test suite
../task-state/        # Authoritative task state (shared sibling worktree)
../worktrees/         # Per-task isolated agent workspaces
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
| `taskforge next` | Return highest-priority safe task |
| `taskforge start TASK-123` | Set up worktree, branch, begin task |
| `taskforge status` | Show project status summary |
| `taskforge summary` | Show full project summary |
| `taskforge list` | List and filter tasks (--status, --priority, --search) |
| `taskforge block TASK-123 "reason"` | Mark task as blocked |
| `taskforge done TASK-123` | Mark task as done (--cleanup, --delete-branch) |
| `taskforge unlock TASK-123 --force` | Force-unlock a stale claim |
| `taskforge sweep` | Sweeper Protocol — recover stale in-progress tasks |
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
