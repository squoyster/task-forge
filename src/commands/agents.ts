import { readAgentRegistry, findStaleAgents, markStaleAgentsAsCrashed, type AgentEntry } from "../core/agent-registry.js";
import { getRepoRoot } from "../util/paths.js";
import { logHeader, logSub, logDivider, logSuccess, logInfo } from "../util/logging.js";
import { printJson, jsonOk } from "../util/json-result.js";

export interface AgentsOptions {
  json?: boolean;
  stale?: boolean;
  recover?: boolean;
  threshold?: number;
}

function formatAge(heartbeat: string): string {
  const now = Date.now();
  const heartbeatTime = new Date(heartbeat).getTime();
  const diffMs = now - heartbeatTime;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export async function cmdAgents(options?: AgentsOptions): Promise<void> {
  const repoRoot = getRepoRoot();

  if (options?.recover) {
    const threshold = options.threshold ?? 15;
    const crashed = markStaleAgentsAsCrashed(threshold, repoRoot);
    if (options.json) {
      printJson(jsonOk({
        recovered: crashed.map((a) => ({
          sessionId: a.session_id,
          agentId: a.agent_id,
          currentTask: a.current_task,
        })),
        count: crashed.length,
      }));
    } else {
      if (crashed.length === 0) {
        logSuccess("No stale agents found.");
      } else {
        logHeader(`## Stale Agents Marked as Crashed: ${crashed.length}`);
        for (const agent of crashed) {
          logSub(`- **${agent.session_id}** (${agent.agent_id}) — Task: ${agent.current_task ?? "none"} — Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
        }
      }
    }
    return;
  }

  if (options?.stale) {
    const threshold = options.threshold ?? 15;
    const stale = findStaleAgents(threshold, repoRoot);
    if (options.json) {
      printJson(jsonOk({
        stale: stale.map((a) => ({
          sessionId: a.session_id,
          agentId: a.agent_id,
          currentTask: a.current_task,
          lastHeartbeat: a.last_heartbeat,
          age: formatAge(a.last_heartbeat),
        })),
        count: stale.length,
        thresholdMinutes: threshold,
      }));
    } else {
      if (stale.length === 0) {
        logSuccess("No stale agents found.");
      } else {
        logHeader(`## Stale Agents (>${options.threshold ?? 15}m): ${stale.length}`);
        for (const agent of stale) {
          logSub(`- **${agent.session_id}** (${agent.agent_id}) — Task: ${agent.current_task ?? "none"} — Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
        }
        logDivider();
        logInfo("Run 'taskforge agents --recover' to mark stale agents as crashed.");
      }
    }
    return;
  }

  const registry = readAgentRegistry(repoRoot);
  const active = registry.agents.filter((a) => a.status === "active");
  const idle = registry.agents.filter((a) => a.status === "idle");
  const crashed = registry.agents.filter((a) => a.status === "crashed");

  if (options?.json) {
    printJson(jsonOk({
      registry: {
        active: active.map(formatAgentEntry),
        idle: idle.map(formatAgentEntry),
        crashed: crashed.map(formatAgentEntry),
        maxConcurrentAgents: registry.max_concurrent_agents,
        agentHistoryCount: registry.agent_history.length,
        lastUpdated: registry.last_updated,
      },
      summary: {
        total: registry.agents.length,
        active: active.length,
        idle: idle.length,
        crashed: crashed.length,
      },
    }));
    return;
  }

  logHeader("## Agent Registry");
  logSub(`**Max Concurrent Agents:** ${registry.max_concurrent_agents}`);
  logSub(`**Last Updated:** ${formatAge(registry.last_updated)}`);
  logDivider();

  if (active.length > 0) {
    logHeader(`### Active Agents: ${active.length}`);
    for (const agent of active) {
      logSub(`- **${agent.session_id}** (${agent.agent_id}) — Task: ${agent.current_task ?? "none"} — Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
    }
    logDivider();
  }

  if (idle.length > 0) {
    logHeader(`### Idle Agents: ${idle.length}`);
    for (const agent of idle) {
      logSub(`- **${agent.session_id}** (${agent.agent_id}) — Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
    }
    logDivider();
  }

  if (crashed.length > 0) {
    logHeader(`### Crashed Agents: ${crashed.length}`);
    for (const agent of crashed) {
      logSub(`- **${agent.session_id}** (${agent.agent_id}) — Task: ${agent.current_task ?? "none"} — Last heartbeat: ${formatAge(agent.last_heartbeat)}`);
    }
    logDivider();
  }

  if (registry.agents.length === 0) {
    logInfo("No agents registered yet.");
    logSub("Agents are registered when they claim or start a task.");
  }

  logSuccess(`Total: ${registry.agents.length} agents (${active.length} active, ${idle.length} idle, ${crashed.length} crashed)`);
}

function formatAgentEntry(agent: AgentEntry) {
  return {
    sessionId: agent.session_id,
    agentId: agent.agent_id,
    status: agent.status,
    currentTask: agent.current_task,
    worktreePath: agent.worktree_path,
    registeredAt: agent.registered_at,
    lastHeartbeat: agent.last_heartbeat,
    age: formatAge(agent.last_heartbeat),
  };
}
