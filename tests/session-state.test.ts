import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writeSessionState, readSessionState, removeSessionState, updateSessionHeartbeat } from "../src/core/session-state.js";

describe("session-state", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-state-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("writeSessionState", () => {
    it("writes session state file with correct content", () => {
      const state = {
        session_id: "abc123",
        task_id: "TASK-001",
        claimed_at: "2024-01-01T00:00:00.000Z",
        worktree_path: "/tmp/test-worktree",
        last_heartbeat: "2024-01-01T00:00:00.000Z",
      };

      writeSessionState(tmpDir, state);

      const filePath = path.join(tmpDir, ".taskforge-session.json");
      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(content).toEqual(state);
    });

    it("creates directory if it doesn't exist", () => {
      const nestedPath = path.join(tmpDir, "nested", "dir");
      const state = {
        session_id: "abc123",
        task_id: "TASK-001",
        claimed_at: "2024-01-01T00:00:00.000Z",
        worktree_path: nestedPath,
        last_heartbeat: "2024-01-01T00:00:00.000Z",
      };

      writeSessionState(nestedPath, state);

      const filePath = path.join(nestedPath, ".taskforge-session.json");
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("readSessionState", () => {
    it("reads session state file correctly", () => {
      const state = {
        session_id: "abc123",
        task_id: "TASK-001",
        claimed_at: "2024-01-01T00:00:00.000Z",
        worktree_path: "/tmp/test-worktree",
        last_heartbeat: "2024-01-01T00:00:00.000Z",
      };

      writeSessionState(tmpDir, state);
      const read = readSessionState(tmpDir);

      expect(read).toEqual(state);
    });

    it("returns null when file doesn't exist", () => {
      const read = readSessionState(tmpDir);
      expect(read).toBeNull();
    });

    it("returns null when file is invalid JSON", () => {
      const filePath = path.join(tmpDir, ".taskforge-session.json");
      fs.writeFileSync(filePath, "not valid json", "utf-8");

      const read = readSessionState(tmpDir);
      expect(read).toBeNull();
    });

    it("returns null when required fields are missing", () => {
      const filePath = path.join(tmpDir, ".taskforge-session.json");
      fs.writeFileSync(filePath, JSON.stringify({ task_id: "TASK-001" }), "utf-8");

      const read = readSessionState(tmpDir);
      expect(read).toBeNull();
    });
  });

  describe("removeSessionState", () => {
    it("removes session state file", () => {
      const state = {
        session_id: "abc123",
        task_id: "TASK-001",
        claimed_at: "2024-01-01T00:00:00.000Z",
        worktree_path: "/tmp/test-worktree",
        last_heartbeat: "2024-01-01T00:00:00.000Z",
      };

      writeSessionState(tmpDir, state);
      removeSessionState(tmpDir);

      const filePath = path.join(tmpDir, ".taskforge-session.json");
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it("does nothing when file doesn't exist", () => {
      // Should not throw
      expect(() => removeSessionState(tmpDir)).not.toThrow();
    });
  });

  describe("updateSessionHeartbeat", () => {
    it("updates last_heartbeat timestamp", () => {
      const state = {
        session_id: "abc123",
        task_id: "TASK-001",
        claimed_at: "2024-01-01T00:00:00.000Z",
        worktree_path: "/tmp/test-worktree",
        last_heartbeat: "2024-01-01T00:00:00.000Z",
      };

      writeSessionState(tmpDir, state);
      updateSessionHeartbeat(tmpDir);

      const read = readSessionState(tmpDir);
      expect(read).not.toBeNull();
      expect(read!.last_heartbeat).not.toBe(state.last_heartbeat);
      expect(new Date(read!.last_heartbeat).getTime()).toBeGreaterThan(new Date(state.last_heartbeat).getTime());
    });

    it("does nothing when session file doesn't exist", () => {
      // Should not throw
      expect(() => updateSessionHeartbeat(tmpDir)).not.toThrow();
    });
  });
});
