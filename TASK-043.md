---
id: TASK-043
type: Documentation
status: Done
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-043: Document Agent Discipline Policy — No Direct Git, Doctor Mode Protocol

## Goal

Update `AGENTS.md` and `TASKFORGE.md` to codify the agent discipline policy: agents must use TaskForge CLI commands exclusively, must not manipulate git or task-state files directly, and must respect the doctor-lock protocol.

## Policy to Document

### 1. No Direct Git Manipulation
Agents must not run `git` commands directly on the task-state worktree or main repo. All state changes flow through taskforge CLI commands:
- `taskforge claim` / `start` — claim a task
- `taskforge done` — mark complete
- `taskforge release` — abandon a claim
- `taskforge block` — mark blocked
- `taskforge heartbeat` — extend lease

The only exception is `git push/pull` on the agent's own feature branch within the worktree.

### 2. No Direct Task-State File Editing
Agents must never edit `../task-state/*.md` files directly (no `sed`, no manual YAML editing). Status changes must go through the CLI lifecycle commands. Manual edits create stale assignees and inconsistent states.

### 3. Doctor Mode Protocol
When inconsistency is detected:
1. Agent runs `taskforge doctor` to diagnose
2. If critical errors found, doctor creates a `.doctor-lock` (pauses all agents)
3. Doctor agent creates a recovery task and works it
4. Recovery complete → doctor removes the lock
5. All agents pull and resume

### 4. Guardrail Compliance
Agents must check for:
- Outstanding session tasks before starting new work (TASK-040)
- Doctor lock before taking action (TASK-042)
- Control-file changes before marking Done (TASK-039)

## Acceptance Criteria

- [ ] `AGENTS.md` codifies the "no direct git" and "no direct task-state editing" rules
- [ ] `AGENTS.md` documents the doctor-mode protocol
- [ ] `AGENTS.md` lists all required guardrail checks
- [ ] `TASKFORGE.md` references the policy for system-level enforcement
- [ ] Examples show correct workflows and common mistakes

## Dependencies

TASK-040, TASK-042

## Risk Level

Low — documentation only.

## Continuation Policy

Auto-continue.

## Agent Notes

### 2026-05-22 System
- Task marked Done (forced)

### 2026-05-22 System
- Task started via taskforge start TASK-043
- Session: 02d3d81ec5
- Branch: agent/TASK-043-document-agent-discipline-policy-no-dire--02d3d81ec5
- Worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-043
