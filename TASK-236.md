---
id: TASK-236
type: Task
status: Implementation Complete
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 0745b779f5
claimed_at: '2026-06-15 19:59:54'
context_hash: 86c2d0ddbd80d3ed
spec_hash: 2e7fc293318e91c3
branch: agent/TASK-236-enforce-worktree-only-edits-auto-pull-on--0745b779f5
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-236
---

# TASK-236: Enforce worktree-only edits, auto-pull on advancement, and block on pending PRs

## Goal

Agents must never modify files on main. All edits happen in worktrees. When task-state or main advances, agents must pull before continuing. Pending PRs must be flagged and require human approval before agents proceed with dependent work.

## Required Changes

### 1. Worktree-Only Edit Enforcement
- Agents must ONLY modify files within their assigned worktree directory (../worktrees/<project>/TASK-NNN)
- Agents must NEVER edit files directly on main branch
- Add validation to commands that would modify main (e.g., prevent `taskforge done\> from writing to main)
- Document this invariant in AGENTS.md and docs/architecture/

### 2. Auto-Pull on Advancement Detection
- When task-state is behind origin (git log shows new commits), automatically pull before proceeding
- When main has new commits merged, agents should pull in their worktree before continuing
- Add explicit guidance: if `git status\> shows behind, run `git pull\> first
- Update AGENTS.md to include this as a mandatory pre-condition before any task operation

### 3. Pending PR Flagging and Human Approval Gate
- Before starting new work or marking tasks done, check for open PRs on the repo
- If open PRs exist that haven't been approved by a human, flag this and block auto-continuation
- Add a check: `gh pr list --state open --json number,title,mergeStateStatus\>
- If any PR has `mergeStateStatus: UNSTABLE\> or is pending review, warn and request human input
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

### 2026-06-15T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: AGENTS.md, package-lock.json, src/commands/git-facade.ts, src/commands/new.ts, src/commands/next.ts, src/commands/resume.ts, src/commands/start.ts, src/commands/sync.ts, src/core/closure-task.ts, src/core/command-result.ts, src/core/command-states.ts, src/core/git.ts, src/core/next-command-maps.ts, src/core/pending-publish.ts, src/core/result-builder.ts, src/core/result-renderer.ts, src/integrations/github/service.ts, src/util/logging.ts, tests/closure-task.test.ts, tests/command-result.test.ts, tests/command-states.test.ts, tests/commands/new.test.ts, tests/commands/next.test.ts, tests/git-facade.test.ts, tests/git.test.ts, tests/pending-publish.test.ts, tests/resume.test.ts
- Commits: 9bb3041 TASK-236: Enforce worktree-only edits, auto-pull, pending PR blocking
- AC section: present
- AC has unchecked items

### 2026-06-15T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-236

### 2026-06-15T00:00:00Z System
- Task claimed via taskforge start TASK-236
- Session: 0745b779f5
- Branch: agent/TASK-236-enforce-worktree-only-edits-auto-pull-on--0745b779f5
