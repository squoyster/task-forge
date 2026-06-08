---
id: TASK-258
type: Feature
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: aa5153ce41
claimed_at: '2026-06-08 13:21:11'
context_hash: 98789b0cbdd97405
branch: agent/TASK-258-enforce-the-taskforge-mutation-boundary--aa5153ce41
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-258
---

# TASK-258: ENFORCE THE TASKFORGE MUTATION BOUNDARY

## Goal

Describe the desired outcome.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-06-08T00:00:00Z System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-258

### 2026-06-08T00:00:00Z System
- Task claimed via taskforge start TASK-258
- Session: aa5153ce41
- Branch: agent/TASK-258-enforce-the-taskforge-mutation-boundary--aa5153ce41


## Problem

Agents can ignore TaskForge guidance and perform raw Git mutation or direct task-state edits. Printed instructions are advisory and do not constitute a guardrail.

## Task Description

Implement enforceable command and filesystem boundaries for TaskForge-managed agent sessions.

When TaskForge agent mode is active, implementation agents must use TaskForge lifecycle commands for repository mutation. Read-only Git inspection remains available. Exceptional recovery requires a distinct authority and an auditable override.

## Agentic Implementation Prompt

> Implement defense-in-depth enforcement that prevents implementation agents from bypassing TaskForge\'s lifecycle commands.
>
> The primary rule is:
>
> When TASK_FORGE_ACTIVE indicates a managed agent session, raw repository mutation is denied.
>
> Enforce this at more than one practical layer where possible:
>
> - generated agent/tool permissions,
> - command wrapper or hook,
> - repository hooks where applicable,
> - task-state filesystem validation,
> - TaskForge session environment.
>
> Do not invert the environment-variable condition. Managed sessions are the sessions that require restriction.
>
> Keep read-only Git diagnostics available. Define and implement a separate Human/Doctor override path for exceptional recovery. Every override must include reason, identity, task, affected repository, command, and before/after SHAs.
>
> Avoid brittle string matching as the sole enforcement mechanism. Account for aliases, absolute executable paths, shell wrappers, and compound commands to the extent supported by the execution environment.

## Required Denied Mutations

At minimum: git commit, git push, git merge, git rebase, git cherry-pick, git reset, git worktree add, git worktree remove, git branch -d, git branch -D, git update-ref, direct writes to managed task-state files.

## Required Allowed Diagnostics

At minimum: git status, git diff, git log, git show, git branch --show-current, git rev-parse, git merge-base, git ls-remote, git fetch (only if policy explicitly classifies it as safe).

## Acceptance Criteria

1. Managed implementer sessions cannot execute the listed raw Git mutations.
2. Read-only Git operations remain usable.
3. Enforcement works when Git is invoked through its absolute path.
4. Enforcement addresses shell aliases or wrappers where the host integration permits.
5. Direct modification of managed task-state files is detected and rejected.
6. TaskForge\'s own authorized child processes can perform required mutations without exposing a general bypass token to the agent.
7. A Human/Doctor override exists and is disabled by default for implementers.
8. Overrides require structured reason and authenticated authority.
9. Overrides produce immutable audit events.
10. Error output identifies the correct TaskForge replacement command.
11. The guard does not prevent unrelated Git operations outside the managed repository unless explicitly configured.
12. The condition associated with TASK_FORGE_ACTIVE has regression tests proving it is not inverted.
13. Generated OpenCode or agent permissions reflect the same policy.
14. Attempts to bypass the boundary are surfaced as security-relevant findings.

## Required Tests

- Each denied command.
- Each allowed command.
- Environment variable set and unset.
- Absolute Git path.
- Compound shell command.
- TaskForge-internal authorized mutation.
- Doctor override.
- Direct task-state edit.
- Managed versus unmanaged repository.

## Completion Evidence

- Enforcement architecture.
- Threat model and known limitations.
- Agent permission configuration example.
- Audit event example.
- Regression test proving managed sessions deny raw commit and push.

---

_Source: docs/taskforge-agentic-workflow-hardening-tasks.md_
