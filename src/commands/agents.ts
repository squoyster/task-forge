import { readAgentRegistry, findStaleAgents, markStaleAgentsAsCrashed } from "../core/agent-registry.js";
import { getRepoRoot } from "../util/paths.js";
import { logHeader, logSub, logDivider, logSuccess, logInfo } from "../util/logging.js";
import { successResult } from "../core/result-builder.js";
import { writeResult } from "../util/write-command-result.js";

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

function serializeAgent(agent: ReturnType<typeof readAgentRegistry>["agents"][number]) {
  return {
    session_id: agent.session_id,
    agent_id: agent.agent_id,
    last_heartbeat: agent.last_heartbeat,
    last_heartbeat_age: formatAge(agent.last_heartbeat),
    current_task: agent.current_task,
    status: agent.status,
    worktree_path: agent.worktree_path,
    registered_at: agent.registered_at,
  };
}

export async function cmdAgents(options?: AgentsOptions): Promise<void> {
  const repoRoot = getRepoRoot();

  if (options?.recover) {
    const threshold = options.threshold ?? 15;
    const crashed = markStaleAgentsAsCrashed(threshold, repoRoot);
    if (options.json) {
      const result = successResult({
        command: "agents",
        guidance: crashed.length === 0
          ? "No stale agents found."
          : `Marked ${crashed.length} stale agent(s) as crashed.`,
      });
      result.data = {
        recovered: crashed.map(serializeAgent),
        thresholdMinutes: threshold,
      };
      writeResult(result, options.json);
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
      const result = successResult({
        command: "agents",
        guidance: stale.length === 0
          ? "No stale agents found."
          : `Found ${stale.length} stale agent(s) (threshold: ${threshold}m). Run 'taskforge agents --recover' to mark them as crashed.`,
      });
      result.data = {
        stale: stale.map(serializeAgent),
        thresholdMinutes: threshold,
      };
      writeResult(result, options.json);
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
    const result = successResult({
      command: "agents",
      guidance: registry.agents.length === 0
        ? "No agents registered yet. Agents are registered when they claim or start a task."
        : `Agent registry: ${registry.agents.length} total, ${active.length} active, ${idle.length} idle, ${crashed.length} crashed.`,
    });
    result.data = {
      max_concurrent_agents: registry.max_concurrent_agents,
      last_updated: registry.last_updated,
      counts: {
        total: registry.agents.length,
        active: active.length,
        idle: idle.length,
        crashed: crashed.length,
      },
      agents: registry.agents.map(serializeAgent),
    };
    writeResult(result, options.json);
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
