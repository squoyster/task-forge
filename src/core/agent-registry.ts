import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import { getRepoRoot } from "../util/paths.js";

export const AGENT_REGISTRY_FILE = "agent-registry.json";

export const AgentStatusSchema = z.enum(["active", "idle", "stale", "crashed"]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentEntrySchema = z.object({
  session_id: z.string(),
  agent_id: z.string(),
  last_heartbeat: z.string(),
  current_task: z.string().nullable(),
  status: AgentStatusSchema,
  worktree_path: z.string().nullable(),
  registered_at: z.string(),
});
export type AgentEntry = z.infer<typeof AgentEntrySchema>;

export const AgentRegistrySchema = z.object({
  agents: z.array(AgentEntrySchema),
  max_concurrent_agents: z.number().default(0),
  agent_history: z.array(z.string()).default([]),
  last_updated: z.string(),
});
export type AgentRegistry = z.infer<typeof AgentRegistrySchema>;

function getRegistryPath(repoRoot?: string): string {
  const root = repoRoot ?? getRepoRoot();
  return path.join(root, ".taskforge", AGENT_REGISTRY_FILE);
}

function getAgentId(): string {
  const hostname = os.hostname();
  const pid = process.pid;
  return `${hostname}:${pid}`;
}

/**
 * Read the agent registry file. Returns an empty registry if not found.
 */
export function readAgentRegistry(repoRoot?: string): AgentRegistry {
  const registryPath = getRegistryPath(repoRoot);
  if (!fs.existsSync(registryPath)) {
    return {
      agents: [],
      max_concurrent_agents: 0,
      agent_history: [],
      last_updated: new Date().toISOString(),
    };
  }

  try {
    const content = fs.readFileSync(registryPath, "utf-8");
    const parsed = JSON.parse(content);
    return AgentRegistrySchema.parse(parsed);
  } catch {
    return {
      agents: [],
      max_concurrent_agents: 0,
      agent_history: [],
      last_updated: new Date().toISOString(),
    };
  }
}

/**
 * Write the agent registry file.
 */
export function writeAgentRegistry(registry: AgentRegistry, repoRoot?: string): void {
  const registryPath = getRegistryPath(repoRoot);
  const dir = path.dirname(registryPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  registry.last_updated = new Date().toISOString();
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf-8");
}

/**
 * Register a new agent in the registry.
 */
export function registerAgent(
  sessionId: string,
  taskId: string | null,
  worktreePath: string | null,
  repoRoot?: string,
): AgentEntry {
  const registry = readAgentRegistry(repoRoot);
  const agentId = getAgentId();
  const now = new Date().toISOString();

  const entry: AgentEntry = {
    session_id: sessionId,
    agent_id: agentId,
    last_heartbeat: now,
    current_task: taskId,
    status: "active",
    worktree_path: worktreePath,
    registered_at: now,
  };

  // Remove existing entry for this session_id if present
  registry.agents = registry.agents.filter((a) => a.session_id !== sessionId);
  registry.agents.push(entry);

  // Update history
  if (!registry.agent_history.includes(agentId)) {
    registry.agent_history.push(agentId);
  }

  // Update max concurrent agents
  const activeCount = registry.agents.filter((a) => a.status === "active").length;
  if (activeCount > registry.max_concurrent_agents) {
    registry.max_concurrent_agents = activeCount;
  }

  writeAgentRegistry(registry, repoRoot);
  return entry;
}

/**
 * Update an agent's heartbeat timestamp.
 */
export function updateAgentHeartbeat(sessionId: string, repoRoot?: string): void {
  const registry = readAgentRegistry(repoRoot);
  const agent = registry.agents.find((a) => a.session_id === sessionId);
  if (!agent) return;

  agent.last_heartbeat = new Date().toISOString();
  agent.status = "active";
  writeAgentRegistry(registry, repoRoot);
}

/**
 * Update an agent's current task.
 */
export function updateAgentTask(sessionId: string, taskId: string | null, repoRoot?: string): void {
  const registry = readAgentRegistry(repoRoot);
  const agent = registry.agents.find((a) => a.session_id === sessionId);
  if (!agent) return;

  agent.current_task = taskId;
  agent.last_heartbeat = new Date().toISOString();
  writeAgentRegistry(registry, repoRoot);
}

/**
 * Mark an agent as idle (task completed/released).
 */
export function markAgentIdle(sessionId: string, repoRoot?: string): void {
  const registry = readAgentRegistry(repoRoot);
  const agent = registry.agents.find((a) => a.session_id === sessionId);
  if (!agent) return;

  agent.status = "idle";
  agent.current_task = null;
  agent.last_heartbeat = new Date().toISOString();
  writeAgentRegistry(registry, repoRoot);
}

/**
 * Remove an agent from the registry.
 */
export function removeAgent(sessionId: string, repoRoot?: string): void {
  const registry = readAgentRegistry(repoRoot);
  registry.agents = registry.agents.filter((a) => a.session_id !== sessionId);
  writeAgentRegistry(registry, repoRoot);
}

/**
 * Find stale agents (heartbeat older than threshold).
 */
export function findStaleAgents(thresholdMinutes: number = 15, repoRoot?: string): AgentEntry[] {
  const registry = readAgentRegistry(repoRoot);
  const threshold = Date.now() - thresholdMinutes * 60 * 1000;

  return registry.agents.filter((agent) => {
    if (agent.status !== "active") return false;
    const heartbeatTime = new Date(agent.last_heartbeat).getTime();
    return heartbeatTime < threshold;
  });
}

/**
 * Mark stale agents as crashed.
 */
export function markStaleAgentsAsCrashed(thresholdMinutes: number = 15, repoRoot?: string): AgentEntry[] {
  const registry = readAgentRegistry(repoRoot);
  const threshold = Date.now() - thresholdMinutes * 60 * 1000;
  const crashed: AgentEntry[] = [];

  for (const agent of registry.agents) {
    if (agent.status !== "active") continue;
    const heartbeatTime = new Date(agent.last_heartbeat).getTime();
    if (heartbeatTime < threshold) {
      agent.status = "crashed";
      crashed.push(agent);
    }
  }

  if (crashed.length > 0) {
    writeAgentRegistry(registry, repoRoot);
  }

  return crashed;
}

/**
 * Get active agents count.
 */
export function getActiveAgentCount(repoRoot?: string): number {
  const registry = readAgentRegistry(repoRoot);
  return registry.agents.filter((a) => a.status === "active").length;
}

/**
 * Get agent by session ID.
 */
export function getAgentBySession(sessionId: string, repoRoot?: string): AgentEntry | undefined {
  const registry = readAgentRegistry(repoRoot);
  return registry.agents.find((a) => a.session_id === sessionId);
}
