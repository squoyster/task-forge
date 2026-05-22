# Legacy Task Directory — DEPRECATED

> **Authoritative task state now lives in `../task-state/`, a dedicated git worktree on the `task-state` branch.**
>
> This `tasks/` directory on `main` is retained for backward-compatible reference only.
> **Agents must never create or modify files in `main/tasks/`** — use `taskforge start TASK-NNN` which manages task files through the task-state worktree.
>
> See [TASKFORGE.md](../TASKFORGE.md) for the full specification.

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

Each task file on the `task-state` branch is named by its ID:

```
task-state/TASK-001.md
task-state/FEATURE-001.md
task-state/BUG-001.md
```
