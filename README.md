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

# View project status
taskforge status

# View full summary
taskforge summary

# Start a task (creates worktree + branch)
taskforge start TASK-001

# Run dependency health scan
taskforge deps scan
```

## Structure

```
TASKFORGE.md          # System specification
tasks/                # Repo-native task specifications
src/                  # TypeScript CLI source
scripts/              # Thin Bash wrapper → TypeScript CLI
specs/                # Design specifications
docs/decisions/       # Architecture decision records
logs/taskforge/       # Task execution logs
tests/                # Vitest test suite
```

## Task Workflow

```
Inbox → Needs Spec → Ready → In Progress → Review → Verify → Done
                         ↓
                      Blocked
```

## CLI Commands

| Command | Description |
|---|---|
| `taskforge init` | Initialize TaskForge in this repo |
| `taskforge next` | Return highest-priority safe task |
| `taskforge start TASK-123` | Set up worktree, branch, begin task |
| `taskforge status` | Show project status summary |
| `taskforge summary` | Show full project summary |
| `taskforge block TASK-123 "reason"` | Mark task as blocked |
| `taskforge done TASK-123` | Mark task as done |
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
