import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  readAgentRegistry,
  writeAgentRegistry,
  registerAgent,
  updateAgentHeartbeat,
  updateAgentTask,
  markAgentIdle,
  removeAgent,
  findStaleAgents,
  markStaleAgentsAsCrashed,
  getActiveAgentCount,
  getAgentBySession,
  type AgentRegistry,
} from "../src/core/agent-registry.js";

describe("agent-registry", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-registry-test-"));
    // Create .taskforge directory
    fs.mkdirSync(path.join(tmpDir, ".taskforge"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("readAgentRegistry", () => {
    it("returns empty registry when file doesn't exist", () => {
      const registry = readAgentRegistry(tmpDir);
      expect(registry.agents).toEqual([]);
      expect(registry.max_concurrent_agents).toBe(0);
      expect(registry.agent_history).toEqual([]);
    });

    it("reads existing registry file", () => {
      const registry: AgentRegistry = {
        agents: [],
        max_concurrent_agents: 5,
        agent_history: ["agent1", "agent2"],
        last_updated: new Date().toISOString(),
      };
      writeAgentRegistry(registry, tmpDir);

      const read = readAgentRegistry(tmpDir);
      expect(read.max_concurrent_agents).toBe(5);
      expect(read.agent_history).toEqual(["agent1", "agent2"]);
    });

    it("returns empty registry on invalid JSON", () => {
      const registryPath = path.join(tmpDir, ".taskforge", "agent-registry.json");
      fs.writeFileSync(registryPath, "not valid json", "utf-8");

      const registry = readAgentRegistry(tmpDir);
      expect(registry.agents).toEqual([]);
    });
  });

  describe("registerAgent", () => {
    it("registers a new agent", () => {
      const entry = registerAgent("session1", "TASK-001", "/tmp/worktree", tmpDir);
      expect(entry.session_id).toBe("session1");
      expect(entry.current_task).toBe("TASK-001");
      expect(entry.status).toBe("active");

      const registry = readAgentRegistry(tmpDir);
      expect(registry.agents).toHaveLength(1);
      expect(registry.agent_history).toContain(entry.agent_id);
    });

    it("updates existing agent with same session_id", () => {
      registerAgent("session1", "TASK-001", "/tmp/worktree1", tmpDir);
      registerAgent("session1", "TASK-002", "/tmp/worktree2", tmpDir);

      const registry = readAgentRegistry(tmpDir);
      expect(registry.agents).toHaveLength(1);
      expect(registry.agents[0].current_task).toBe("TASK-002");
    });

    it("updates max_concurrent_agents", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      registerAgent("session2", "TASK-002", null, tmpDir);
      registerAgent("session3", "TASK-003", null, tmpDir);

      const registry = readAgentRegistry(tmpDir);
      expect(registry.max_concurrent_agents).toBe(3);
    });
  });

  describe("updateAgentHeartbeat", () => {
    it("updates heartbeat timestamp", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      const registry1 = readAgentRegistry(tmpDir);
      const originalHeartbeat = registry1.agents[0].last_heartbeat;

      // Small delay to ensure timestamp changes
      const start = Date.now();
      while (Date.now() - start < 10) { /* busy wait */ }

      updateAgentHeartbeat("session1", tmpDir);
      const registry2 = readAgentRegistry(tmpDir);

      expect(registry2.agents[0].last_heartbeat).not.toBe(originalHeartbeat);
      expect(registry2.agents[0].status).toBe("active");
    });

    it("does nothing for unknown session", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      expect(() => updateAgentHeartbeat("unknown", tmpDir)).not.toThrow();
    });
  });

  describe("updateAgentTask", () => {
    it("updates current task", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      updateAgentTask("session1", "TASK-002", tmpDir);

      const registry = readAgentRegistry(tmpDir);
      expect(registry.agents[0].current_task).toBe("TASK-002");
    });

    it("sets task to null", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      updateAgentTask("session1", null, tmpDir);

      const registry = readAgentRegistry(tmpDir);
      expect(registry.agents[0].current_task).toBeNull();
    });
  });

  describe("markAgentIdle", () => {
    it("marks agent as idle and clears task", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      markAgentIdle("session1", tmpDir);

      const registry = readAgentRegistry(tmpDir);
      expect(registry.agents[0].status).toBe("idle");
      expect(registry.agents[0].current_task).toBeNull();
    });
  });

  describe("removeAgent", () => {
    it("removes agent from registry", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      removeAgent("session1", tmpDir);

      const registry = readAgentRegistry(tmpDir);
      expect(registry.agents).toHaveLength(0);
    });
  });

  describe("findStaleAgents", () => {
    it("finds agents with old heartbeats", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);

      // Manually set old heartbeat
      const registry = readAgentRegistry(tmpDir);
      registry.agents[0].last_heartbeat = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      writeAgentRegistry(registry, tmpDir);

      const stale = findStaleAgents(15, tmpDir);
      expect(stale).toHaveLength(1);
      expect(stale[0].session_id).toBe("session1");
    });

    it("ignores non-active agents", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      markAgentIdle("session1", tmpDir);

      const registry = readAgentRegistry(tmpDir);
      registry.agents[0].last_heartbeat = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      writeAgentRegistry(registry, tmpDir);

      const stale = findStaleAgents(15, tmpDir);
      expect(stale).toHaveLength(0);
    });

    it("returns empty array when no stale agents", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      const stale = findStaleAgents(15, tmpDir);
      expect(stale).toHaveLength(0);
    });
  });

  describe("markStaleAgentsAsCrashed", () => {
    it("marks stale agents as crashed", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);

      const registry = readAgentRegistry(tmpDir);
      registry.agents[0].last_heartbeat = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      writeAgentRegistry(registry, tmpDir);

      const crashed = markStaleAgentsAsCrashed(15, tmpDir);
      expect(crashed).toHaveLength(1);
      expect(crashed[0].status).toBe("crashed");

      const updated = readAgentRegistry(tmpDir);
      expect(updated.agents[0].status).toBe("crashed");
    });
  });

  describe("getActiveAgentCount", () => {
    it("returns count of active agents", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      registerAgent("session2", "TASK-002", null, tmpDir);
      markAgentIdle("session2", tmpDir);

      expect(getActiveAgentCount(tmpDir)).toBe(1);
    });
  });

  describe("getAgentBySession", () => {
    it("returns agent by session ID", () => {
      registerAgent("session1", "TASK-001", null, tmpDir);
      const agent = getAgentBySession("session1", tmpDir);
      expect(agent).toBeDefined();
      expect(agent?.session_id).toBe("session1");
    });

    it("returns undefined for unknown session", () => {
      const agent = getAgentBySession("unknown", tmpDir);
      expect(agent).toBeUndefined();
    });
  });
});
