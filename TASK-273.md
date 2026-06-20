---
id: TASK-273
type: Feature
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 750d9840917a2ab9
---

# TASK-273: Streamline completion lifecycle: CLI transitions, cleanup command fixes, and task-store field preservation

## Goal

## Goal

Make the task completion pipeline work end-to-end via CLI commands without requiring direct task-state file edits or workarounds.

## Problems Identified

### 1. Missing CLI transition commands
The status transition table allows `Implementation Complete → Review` and `Implementation Complete → Verify`, but **no CLI command performs these transitions**. The only way to progress a task from `Implementation Complete` to `Done` is to manually edit the task-state file's frontmatter.

**Fix needed:** Add a `taskforge review` or `taskforge verify` command, or add a `--to` flag to existing commands to allow status transitions.

### 2. `writeTaskFile` drops extension fields
`src/core/task-store.ts` → `writeTaskFile()` only writes a hardcoded set of known fields. Extension fields like `code_task`, `submitted_sha`, `pr_merged`, `pr_head_sha`, `pr_base_branch`, and `submitted_at` are **silently dropped** when any command rewrites the file.

**Fix needed:** Either dynamically include all parsed frontmatter fields, or add the missing fields to the whitelist.

### 3. Gate → log → dirty worktree cycle
`taskforge done` runs gates, which generate audit log entries in `logs/taskforge/audit/`. These tracked-but-gitignored files dirty the worktree, causing `done` to fail with \uncommitted

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-20T00:00:00Z System
- Task rejected: Backlog cleared to focus queue on TaskForge Slimming Refactor (TASK-307..315). Superseded, descoped, or obsoleted by refactor per specs/taskforge-slimming-refactor.md. Task record retained as historical reference; re-evaluate post-refactor.
