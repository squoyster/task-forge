---
id: TASK-106
type: Refactor
status: Ready
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
---

# TASK-106: Introduce core ports and provider boundaries

## Goal

## Rationalization Roadmap: TASK-RAT-001

### Objective
Separate TaskForge core from concrete integrations. GitHub, OpenCode, and package-manager behavior must move behind explicit provider interfaces.

### Required ports
- BoardProvider: id, capabilities, syncTask, updateTask, syncStatus
- AgentProvider: id, renderStartInstructions, renderPromptPacket, detectTranscriptExport
- GitPort: revParseTopLevel, currentBranch, worktreeList/Add/Remove, addAll, commit, pullRebase, push
- AuditSink: append, readByTask

### Implementation
1. Create src/core/ports/ interfaces
2. Create provider registry for board and agent providers
3. Move GitHub sync behind GitHubBoardProvider
4. Move OpenCode output behind OpenCodeAgentProvider
5. Add GenericAgentProvider as default
6. Ensure src/core has no imports from provider-specific modules

### Acceptance Criteria
- Core compiles without GitHub-specific imports
- Existing GitHub sync still works when GitHub provider enabled
- Generic Markdown-only mode works with no GitHub config
- Tests prove provider selection is config-driven

## Acceptance Criteria

- [ ]

## Agent Notes
