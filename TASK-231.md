---
id: TASK-231
type: Task
status: In Progress
priority: P0
agentRole: Implementer
riskLevel: Low
humanInterventionRequired: false
assignee: f66160bc82
claimed_at: '2026-05-28 05:59:53'
context_hash: 2d29281e59408ea2
branch: agent/TASK-231-implement-distributed-agent-registry-wit--f66160bc82
worktree: /Volumes/Transcend/devel/worktrees/task-forge/TASK-231
---

# TASK-231: Implement distributed agent registry with heartbeat tracking and crash recovery

## Goal

Create a distributed agent coordination system that tracks active agents across machines using task-state as the shared source of truth.

## Problem

TaskForge runs agents on multiple machines for the same project. Currently there is no shared registry of active agents, so:
- Cannot determine if another agent is still running or has crashed
- Cannot safely take over tasks from crashed agents
- No visibility into concurrent agent capacity
- Stale claims rely on time-based sweepers without agent context

## Solution

Maintain an agent registry file in task-state (e.g., 'agent-registry.json') that tracks:
- session_id: The unique session identifier
- agent_id: Machine-scoped identifier (hostname + process or configurable)
- last_heartbeat: Timestamp of last heartbeat
- current_task: Task ID being worked on (null if idle)
- status: active | idle | stale | crashed
- worktree_path: Absolute path to worktree (machine-local)
- registered_at: When the agent first registered

## High Watermark Tracking

Track the maximum number of concurrent agents seen for the project:
- max_concurrent_agents: Highest number of active agents at once
- agent_history: List of known agent IDs (for audit trail)
- Used to detect when agents have disappeared (active < max)
- Enables capacity planning and anomaly detection

## Crash Detection

An agent is considered crashed/stale when:
- last_heartbeat is older than a configurable threshold (default: 15 minutes)
- No heartbeat updates despite having an In Progress task
- Other agents can detect this via the registry

## Recovery Flow

1. Agent registers on claim/start with status 'active'
2. Heartbeat command updates last_heartbeat timestamp
3. On done/release, agent sets status to 'idle' or removes entry
4. Other agents check registry before claiming tasks
5. If an agent is stale, its claimed tasks can be recovered:
   - Verify no heartbeat within threshold
   - Check if worktree has uncommitted changes
   - If stale with no recent activity, safe to take over
   - Update registry to mark agent as 'crashed'

## Reconciliation with Architecture

- Uses task-state branch as shared source (git-backed, distributed)
- Integrates with existing session ID system (session.ts)
- Works with existing sweeper for stale task recovery
- Maintains invariant: one In Progress task per active agent
- Agent registry is committed to task-state with each heartbeat
- Uses existing jitteredPush for optimistic concurrency on registry updates

## Implementation

1. Create AgentRegistry interface and schema (zod)
2. Create registry file I/O utilities (read/write with locking)
3. Update claim/start to register agent
4. Update heartbeat to refresh last_heartbeat
5. Update done/release to deregister or mark idle
6. Add 'taskforge agents' command to list active agents
7. Add crash detection logic to next/claim commands
8. Add stale agent recovery to sweeper
9. Update doctor to validate registry consistency

## Acceptance Criteria

- [ ] Agent registry file created and maintained in task-state
- [ ] Agents register on claim/start
- [ ] Heartbeat updates registry timestamp
- [ ] Agents deregister on done/release
- [ ] 'taskforge agents' shows active agents
- [ ] Crash detection works with configurable threshold
- [ ] Stale agent tasks can be safely recovered
- [ ] High watermark tracking works correctly
- [ ] Registry validated by doctor command
- [ ] All verification gates pass: typecheck, lint, build, test

## Agent Notes

### 2026-05-28 System
- Worktree created: /Volumes/Transcend/devel/worktrees/task-forge/TASK-231

### 2026-05-28 System
- Task claimed via taskforge start TASK-231
- Session: f66160bc82
- Branch: agent/TASK-231-implement-distributed-agent-registry-wit--f66160bc82
