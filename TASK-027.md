---
id: TASK-027
type: Feature
status: Done
priority: P2
agentRole: Implementer
riskLevel: Medium
humanInterventionRequired: false
spec_hash: 5c1c2f9d4fc6bd30
---

# TASK-027: Add `report` / `finish` Command — Structured Completion Report

## Goal

Add `taskforge report TASK-ID` that produces a structured completion report: changed files, commit list, gate results, risks found, and human-review-needed flag. The command should optionally transition the task to `Review`.

## Background

Per the gap analysis, "done" should mean more than "agent says done." The current `done` command jumps directly to `Done`, but the recommended flow is:

```
In Progress → Review → Verify → Done
```

A `report` command gives agents a way to produce a structured result that a reviewer (human or automated) can evaluate before final acceptance.

## Usage

```bash
taskforge report TASK-023                  # Generate report, stay In Progress
taskforge report TASK-023 --complete        # Generate report + move to Review
taskforge report TASK-023 --json            # Structured machine output
```

## Report Contents

```json
{
  "taskId": "TASK-023",
  "status": "review",
  "changedFiles": ["src/cli.ts", "src/commands/...", "tests/..."],
  "commits": ["abc123", "def456"],
  "gates": { "typecheck": "pass", "lint": "pass", "build": "pass", "test": "pass" },
  "risks": [],
  "humanReviewNeeded": false
}
```

## Acceptance Criteria

- [ ] `taskforge report TASK-ID` generates a structured report from git log, gate results, and task metadata
- [ ] `--complete` flag transitions task to `Review` after generating report
- [ ] `--json` output follows the report contract
- [ ] Report is appended to Agent Notes as a machine-parseable block
- [ ] Detects changed files via `git diff --name-only main..HEAD`
- [ ] Detects commits via `git log --oneline main..HEAD`
- [ ] Tests cover: report generation, --complete transition, JSON output

## Dependencies

TASK-017 (JSON contracts), TASK-018 (gates command), TASK-020 (inspect)

## Risk Level

Medium — adds a new lifecycle command that interacts with git and gates.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task started via taskforge start TASK-027
- Session: 95971d8dcc
- Branch: agent/TASK-027-add-report-finish-command-structured-com--95971d8dcc
- Worktree: /Volumes/Transcend/devel/worktrees/TASK-027
