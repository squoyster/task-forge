---
id: TASK-112
type: Maintenance
status: In Progress
priority: P2
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 0a5bb1985a
claimed_at: '2026-05-23 18:14:48'
context_hash: f3613895c8a77f2e
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-112
---

# TASK-112: Modularize CLI command registration

## Goal

Reduce cli.ts into a small bootstrapper and move command registration into modules. Suggested modules: taskCommands, workspaceCommands, gateCommands, auditCommands, providerCommands, dependencyCommands, configCommands.

## Background

Rationalization Roadmap: TASK-RAT-011

## Acceptance Criteria

- [ ] cli.ts only builds app context, registers modules, and parses args
- [ ] Existing command names remain compatible
- [ ] Plugin commands can be registered without editing core CLI bootstrap

## Agent Notes

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-112

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-112

### 2026-05-23 System
- Task claimed via taskforge start TASK-112
- Session: 0a5bb1985a
- Branch: agent/TASK-112-modularize-cli-command-registration--0a5bb1985a

### 2026-05-23 System
- Task claimed via taskforge start TASK-112
- Session: 0a5bb1985a
- Branch: agent/TASK-112-modularize-cli-command-registration--0a5bb1985a
