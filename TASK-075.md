---
id: TASK-075
type: Feature
status: In Progress
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: 2e90d35199
claimed_at: '2026-05-23 00:32:28'
context_hash: 6eb8f67de42c153d
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-075
---

# TASK-075: Extend config schema for agent framework integration

## Goal

Add agentFramework section to .taskforge/config.json with zod validation. Shape: agentFramework.id (opencode|generic), .policy (permissive|managed|locked-down), .installHooks, .audit, .guard, .policyVersion. Apply sensible defaults. Make config available to init, doctor, audit, hooks, and generated plugin templates. Support future frameworks without schema churn. Existing configs without agentFramework must load with defaults. Invalid policy values fail clearly. AC: config load, defaulting, validation, save all tested.

## Acceptance Criteria

- [ ]

## Agent Notes

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-075

### 2026-05-23 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-075

### 2026-05-23 System
- Task claimed via taskforge start TASK-075
- Session: 2e90d35199
- Branch: agent/TASK-075-extend-config-schema-for-agent-framework--2e90d35199

### 2026-05-23 System
- Task claimed via taskforge start TASK-075
- Session: 2e90d35199
- Branch: agent/TASK-075-extend-config-schema-for-agent-framework--2e90d35199
