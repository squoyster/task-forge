import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { recordCliInvocation, readTaskInvocations, readGlobalInvocations, getCurrentSessionId } from "../src/core/cli-audit.js";

describe("cli-audit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-audit-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("recordCliInvocation", () => {
    it("records a successful invocation to global log", () => {
      recordCliInvocation(tmpDir, "start", ["TASK-001"], { json: true }, 0, 100, null);

      const globalPath = path.join(tmpDir, "logs", "taskforge", "audit", "invocations.jsonl");
      expect(fs.existsSync(globalPath)).toBe(true);

      const content = fs.readFileSync(globalPath, "utf-8");
      const record = JSON.parse(content.trim());
      expect(record.command).toBe("start");
      expect(record.args).toEqual(["TASK-001"]);
      expect(record.exitCode).toBe(0);
      expect(record.duration).toBe(100);
      expect(record.error).toBeNull();
    });

    it("records a failed invocation", () => {
      recordCliInvocation(tmpDir, "done", ["TASK-002"], {}, 1, 50, "gates failed");

      const globalPath = path.join(tmpDir, "logs", "taskforge", "audit", "invocations.jsonl");
      const content = fs.readFileSync(globalPath, "utf-8");
      const record = JSON.parse(content.trim());
      expect(record.command).toBe("done");
      expect(record.exitCode).toBe(1);
      expect(record.error).toBe("gates failed");
    });

    it("records invocation to per-task transcript for task commands", () => {
      recordCliInvocation(tmpDir, "start", ["TASK-001"], {}, 0, 100, null);

      const transcriptPath = path.join(tmpDir, "logs", "taskforge", "tasks", "TASK-001", "transcript.jsonl");
      expect(fs.existsSync(transcriptPath)).toBe(true);

      const content = fs.readFileSync(transcriptPath, "utf-8");
      const event = JSON.parse(content.trim());
      expect(event.metadata.type).toBe("cli.invocation");
      expect(event.metadata.command).toBe("start");
    });

    it("does not write per-task transcript for global commands", () => {
      recordCliInvocation(tmpDir, "next", [], { json: true }, 0, 50, null);

      // No task-specific transcript should be created
      const taskDir = path.join(tmpDir, "logs", "taskforge", "tasks");
      if (fs.existsSync(taskDir)) {
        const tasks = fs.readdirSync(taskDir);
        expect(tasks).toHaveLength(0);
      }
    });
  });

  describe("readTaskInvocations", () => {
    it("reads invocations from task transcript", () => {
      recordCliInvocation(tmpDir, "start", ["TASK-001"], {}, 0, 100, null);
      recordCliInvocation(tmpDir, "checkpoint", ["TASK-001"], { message: "fix" }, 0, 200, null);

      const invocations = readTaskInvocations(tmpDir, "TASK-001");
      expect(invocations).toHaveLength(2);
      expect(invocations[0].command).toBe("start");
      expect(invocations[1].command).toBe("checkpoint");
    });

    it("returns empty array for task with no invocations", () => {
      const invocations = readTaskInvocations(tmpDir, "TASK-999");
      expect(invocations).toHaveLength(0);
    });
  });

  describe("readGlobalInvocations", () => {
    it("reads all invocations from global log", () => {
      recordCliInvocation(tmpDir, "start", ["TASK-001"], {}, 0, 100, null);
      recordCliInvocation(tmpDir, "next", [], {}, 0, 50, null);
      recordCliInvocation(tmpDir, "done", ["TASK-001"], {}, 0, 150, null);

      const invocations = readGlobalInvocations(tmpDir);
      expect(invocations).toHaveLength(3);
      expect(invocations.map((i) => i.command)).toEqual(["start", "next", "done"]);
    });

    it("returns empty array when no global log exists", () => {
      const invocations = readGlobalInvocations(tmpDir);
      expect(invocations).toHaveLength(0);
    });
  });

  describe("getCurrentSessionId", () => {
    it("returns TASKFORGE_ACTOR env var when set", () => {
      const original = process.env.TASKFORGE_ACTOR;
      process.env.TASKFORGE_ACTOR = "human";

      const sessionId = getCurrentSessionId(tmpDir);
      expect(sessionId).toBe("human");

      process.env.TASKFORGE_ACTOR = original;
    });

    it("returns null when not in git repo and no env var", () => {
      const original = process.env.TASKFORGE_ACTOR;
      delete process.env.TASKFORGE_ACTOR;

      const sessionId = getCurrentSessionId(tmpDir);
      expect(sessionId).toBeNull();

      process.env.TASKFORGE_ACTOR = original;
    });
  });
});
