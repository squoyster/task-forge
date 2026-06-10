---
id: TASK-237
type: Task
status: Rejected
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
spec_hash: 2e7fc293318e91c3
---

# TASK-237: Enforce worktree-only edits, auto-pull on advancement, and block on pending PRs

## Goal

Agents must never modify files on main. All edits happen in worktrees. When task-state or main advances, agents must pull before continuing. Pending PRs must be flagged and require human approval before agents proceed with dependent work.

## Required Changes

### 1. Worktree-Only Edit Enforcement
- Agents must ONLY modify files within their assigned worktree directory (../worktrees/<project>/TASK-NNN)
- Agents must NEVER edit files directly on main branch
- Add validation to commands that would modify main (e.g., prevent `taskforge done` from writing to main)
- Document this invariant in AGENTS.md and docs/architecture/

### 2. Auto-Pull on Advancement Detection
- When task-state is behind origin (git log shows new commits), automatically pull before proceeding
- When main has new commits merged, agents should pull in their worktree before continuing
- Add explicit guidance: if `git status` shows behind, run `git pull` first
- Update AGENTS.md to include this as a mandatory pre-condition before any task operation

### 3. Pending PR Flagging and Human Approval Gate
- Before starting new work or marking tasks done, check for open PRs on the repo
- If open PRs exist that haven't been approved by a human, flag this and block auto-continuation
- Add a check: `gh pr list --state open --json number,title,mergeStateStatus`
- If any PR has `mergeStateStatus: UNSTABLE` or is pending review, warn and request human input
- Document this in the agent workflow

## Acceptance Criteria

- [ ] AGENTS.md explicitly states agents must only modify files in worktree, never on main
- [ ] AGENTS.md includes mandatory git pull when behind on task-state or main
- [ ] Implementation detects when task-state is behind and auto-pulls or warns
- [ ] Implementation detects when worktree is behind main and warns agent
- [ ] Open PRs are detected and flagged before starting new work
- [ ] Pending/unapproved PRs block auto-continuation and require human approval
- [ ] Test coverage for behind-detection and PR-flagging logic

## Acceptance Criteria

- [ ]

## Agent Notes
