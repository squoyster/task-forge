---
id: TASK-107
type: Refactor
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-107: Consolidate git execution behind native GitPort

## Goal

## Rationalization Roadmap: TASK-RAT-002

### Objective
Make git the only required operational substrate. Remove direct core dependency on simple-git and execa by routing all git execution through a single native CLI implementation.

### Implementation
1. Implement CliGitPort in src/infrastructure/git/cli-git-port.ts using child_process
2. Replace direct simple-git and execa usage in core services
3. Centralize non-fast-forward detection
4. Centralize git command logging to audit events
5. Remove simple-git and execa from runtime dependencies

### Acceptance Criteria
- No direct simple-git or execa imports in core code
- Worktree add/remove/list works
- Commit no-op handled without error
- Push rejection classification tested
- Pull/rebase failure returns actionable next-action guidance

## Acceptance Criteria

- [ ]

## Agent Notes
