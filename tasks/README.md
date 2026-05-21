# TaskForge Tasks

This directory contains repo-native task specifications for TaskForge Autonomous Coding Board.

The external project board is for visibility. These Markdown files are the agent execution contracts.

## Status Flow

```
Inbox → Needs Spec → Ready → In Progress → Review → Verify → Done
                         ↓
                      Blocked
```

## Rules

- Agents may only implement tasks in `Ready` or `In Progress`.
- Vague items must be converted into agent-ready specs before implementation.
- Each implementation task should use its own branch.
- Use git worktrees by default.
- Update Agent Notes before ending a session.
- Do not mark Done without verification.
- Stop for human input only when required by the Human Intervention policy in `TASKFORGE.md`.

## Task ID Format

- `EPIC-NNN` — Epic
- `FEATURE-NNN` — Feature
- `TASK-NNN` — Task
- `BUG-NNN` — Bug
- `CHORE-NNN` — Chore
- `RESEARCH-NNN` — Research / Spike
- `REFACTOR-NNN` — Refactor
- `TEST-NNN` — Test
- `DOC-NNN` — Documentation
- `INFRA-NNN` — Infrastructure
- `SECURITY-NNN` — Security
- `RELEASE-NNN` — Release

## File Naming

Each task file is named by its ID:

```
tasks/TASK-001.md
tasks/FEATURE-001.md
tasks/BUG-001.md
```
