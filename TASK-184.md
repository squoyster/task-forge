---
id: TASK-184
type: Bug
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
pr: 1
---

# TASK-184: Fix getRepoRoot to discover git root instead of using cwd

## Goal

`getRepoRoot()` was using `process.cwd()` which caused taskforge commands in other projects to show task-forge's tasks. Fix it to discover the actual git repo root.

## Acceptance Criteria

- [x] `getRepoRoot()` uses `git rev-parse --show-toplevel` to find the actual git repo root — `src/util/paths.ts` `discoverRepoRoot()`: calls git to find repo root, falls back to cwd if not in a git repo
- [x] `taskforge list` in another project shows that project's tasks, not task-forge's — Tested in `/tmp/test-project` after `taskforge init`
- [x] `taskforge init` creates a new task-state branch — Verified in fresh git repo
- [x] PR created for the fix — https://github.com/squoyster/task-forge/pull/1

## Agent Notes

### 2026-05-25 Implementer
- Fixed `getRepoRoot()` in `src/util/paths.ts` to use `git rev-parse --show-toplevel`
- Tested in fresh project: `taskforge init` creates task-state branch, `taskforge list` shows correct tasks
- PR created at https://github.com/squoyster/task-forge/pull/1
