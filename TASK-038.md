---
id: TASK-038
type: Feature
status: Ready
priority: P2
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
---

# TASK-038: Harden `doctor` — Integrate Inspect and Add Consistency Validation

## Goal

Upgrade `taskforge doctor` from a shallow existence checker into a comprehensive inconsistency detector. Integrate `inspectTask` for deep per-task worktree analysis, add cross-reference validation, and detect impossible or suspicious state combinations.

## Background

The current `doctor` (TASK-032) only checks existence:
- Task-state worktree present? yes/no
- Config valid JSON? yes/no
- Orphan worktrees? yes/no
- Stale locks? yes/no
- Duplicate IDs? yes/no
- Sweepable count

It does **not** detect logically impossible states, broken references, or mixed-state anomalies. A proper inconsistency detector should catch these before they cause agent confusion or data loss.

## Checks to Add

### 1. Deep Worktree Inspection (via `inspectTask`)
For every `In Progress` task:
- [ ] Worktree dirty but task not recently heartbeated → warn (agent may have crashed mid-edit)
- [ ] Branch ahead of main but task languishing → suggest moving to Review
- [ ] Worktree exists but branch doesn't → inconsistent

### 2. Impossible State Combinations
- [ ] `Done` + `assignee` set → should have been cleared
- [ ] `Ready` + `assignee` set → task was swept but lock not cleared
- [ ] `In Progress` + no `assignee` → claimed but session lost
- [ ] `Blocked` + no `blocked_reason` → missing required metadata
- [ ] `Review` + `assignee` set → review tasks shouldn't be claimed

### 3. Broken References
- [ ] `dependsOn` referencing non-existent task IDs
- [ ] `branch` field pointing to a branch that doesn't exist
- [ ] `worktree` field pointing to a path that doesn't exist on disk but task says In Progress

### 4. Orphan Detection (extended)
- [ ] Branches without corresponding task files
- [ ] Worktrees without corresponding task files (already done)
- [ ] Task files on `task-state` branch that are duplicates of `tasks/` on main (stale migration artifacts)

### 5. Sweeper Recommendations (enhanced)
- [ ] For each sweepable task, show what the sweeper *would* do (dry-run classification)
- [ ] Flag dirty sweepable tasks that the sweeper would skip

### Output

```bash
taskforge doctor                 # Full inconsistency report
taskforge doctor --json           # Machine-parseable with severity levels
taskforge doctor --fix            # Auto-fix safe issues
```

JSON output should include `severity` per issue: `error` (definitely broken), `warn` (suspicious), `info` (recommendation).

## Acceptance Criteria

- [ ] `doctor` runs `inspectTask` on every `In Progress` task
- [ ] Detects all impossible state combinations listed above
- [ ] Detects broken `dependsOn` references
- [ ] Detects orphan branches (not just worktrees)
- [ ] Reports branch/worktree mismatch per task
- [ ] `--json` output includes structured issues with severity
- [ ] Sweepable task report shows what sweeper would classify each as (reset/review/skip)
- [ ] Tests cover: each impossible state, broken references, orphan branches, JSON output

## Dependencies

TASK-020 (inspect), TASK-026 (safe sweep classification)

## Risk Level

Medium — adds new checks but doesn't mutate state.

## Continuation Policy

Auto-continue.
