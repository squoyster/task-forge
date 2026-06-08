---
id: TASK-271
type: Feature
status: Implementation Complete
priority: P1
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: agent
claimed_at: '2026-06-08 17:35:21'
branch: agent/TASK-271-add-mcp-command
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-271
---

# TASK-271: Add MCP command to TaskForge CLI

## Goal

Implement a `taskforge mcp` CLI command that acts as a Model Context Protocol (MCP) server, exposing TaskForge functionality as MCP tools that can be called by MCP clients (like opencode).

## Context

The local `opencode.json` already configures an MCP server for taskforge with the command `npx taskforge mcp --config .taskforge/config.json`.

## Scope

- Add `@modelcontextprotocol/sdk` as a dependency
- Implement `src/commands/mcp.ts` as a stdio-based MCP server
- Register the `mcp` command in the CLI
- Expose core TaskForge commands as MCP tools with JSON Schema parameters
- Support at minimum: status, next, start, done, checkpoint, submit, gates
- Read `--config` flag to locate `.taskforge/config.json`
- Wire into existing command infrastructure (no duplicate logic)
- Add tests for MCP server initialization, tool listing, and tool execution

## Out of Scope

- MCP client functionality (calling external MCP servers)
- Transport other than stdio (no SSE/WebSocket)
- Authentication (inherits from TaskForge config)

## Acceptance Criteria

- [ ] `taskforge mcp` starts a stdio MCP server advertising tools
- [ ] `--version` flag returns version info
- [ ] Exposed tools: taskforge_status, taskforge_next, taskforge_start, taskforge_done, taskforge_checkpoint, taskforge_submit, taskforge_gates
- [ ] Each tool has proper JSON Schema parameter definitions
- [ ] Tool calls execute corresponding TaskForge command and return structured results
- [ ] Errors returned as proper MCP error responses
- [ ] `--config` flag respected when locating config
- [ ] All existing tests pass
- [ ] New tests cover the MCP command
- [ ] `npm run typecheck`, `build`, `lint` pass

## Dependencies

- `@modelcontextprotocol/sdk` (npm package)
- Reuses existing command implementations

## Agent Notes

### 2026-06-08T00:00:00Z System
- Report generated — task moved to Implementation Complete
- Changed files: none
- Commits: none
- AC section: present
- AC has unchecked items
