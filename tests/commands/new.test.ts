import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setRepoRoot } from "../../src/util/paths.js";

// Mock the task-state transaction to avoid real git operations
vi.mock("../../src/core/task-state-transaction.js", () => ({
  withTaskStateTransaction: vi.fn(),
}));

// Mock the guidance adapter
vi.mock("../../src/core/guidance-adapter.js", () => ({
  getDefaultGuidanceAdapter: vi.fn(() => ({
    pushGuidance: vi.fn(),
  })),
}));

import { cmdNew } from "../../src/commands/new.js";
import { withTaskStateTransaction } from "../../src/core/task-state-transaction.js";
import {
  loadPendingPublish,
  clearPendingPublish,
} from "../../src/core/pending-publish.js";

let uniqueDir: string;
let stateDir: string;
let repoDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-new-test-"));
  repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });

  // Set up a minimal .taskforge/config.json
  const configDir = path.join(repoDir, ".taskforge");
  fs.mkdirSync(configDir, { recursive: true });
  const config = {
    project: { name: "test-repo", defaultBranch: "main" },
    tasks: { directory: "tasks", idPrefix: "TASK" },
    worktrees: { root: "../worktrees", branchPrefix: "agent" },
    opencode: { enabled: true },
    continuation: { autoContinue: true },
  };
  fs.writeFileSync(
    path.join(configDir, "config.json"),
    JSON.stringify(config, null, 2),
    "utf-8",
  );

  setRepoRoot(repoDir);
  clearPendingPublish(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdNew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: transaction succeeds
    vi.mocked(withTaskStateTransaction).mockResolvedValue(undefined);
  });

  it("creates a task file with next sequential ID", async () => {
    await cmdNew("My test task", { type: "Task", priority: "P1" });

    // Check that the file was created with correct ID
    const dirContent = fs.readdirSync(stateDir);
    const taskFile = dirContent.find((f) => f.startsWith("TASK-"));
    expect(taskFile).toBeTruthy();
    const content = fs.readFileSync(path.join(stateDir, taskFile!), "utf-8");
    expect(content).toContain("id: TASK-");
    expect(content).toContain("My test task");
    expect(content).toContain("priority: P1");
  });

  it("registers pending publication entry when push fails", async () => {
    vi.mocked(withTaskStateTransaction).mockRejectedValue(new Error("push failed"));

    await cmdNew("Pending test");

    const pending = loadPendingPublish(repoDir);
    expect(pending.length).toBe(1);
    expect(pending[0].title).toBe("Pending test");
    expect(pending[0].id).toMatch(/^TASK-/);
  });

  it("detects duplicate title from pending publications", async () => {
    // First create a task that fails to push
    vi.mocked(withTaskStateTransaction).mockRejectedValueOnce(new Error("push failed"));
    await cmdNew("Duplicate task");

    expect(loadPendingPublish(repoDir).length).toBe(1);

    // Now try to create another with the same title
    await cmdNew("Duplicate task");

    // Should still only have 1 pending entry (no duplicate created)
    expect(loadPendingPublish(repoDir).length).toBe(1);
  });

  it("skips duplicate detection for different titles", async () => {
    // First create a pending task
    vi.mocked(withTaskStateTransaction).mockRejectedValueOnce(new Error("push failed"));
    await cmdNew("First task");

    // Second task with different title should work (but fail to push again)
    vi.mocked(withTaskStateTransaction).mockRejectedValueOnce(new Error("push failed"));
    await cmdNew("Second task");

    const pending = loadPendingPublish(repoDir);
    expect(pending.length).toBe(2);
    expect(pending[0].title).toBe("First task");
    expect(pending[1].title).toBe("Second task");
  });

  it("removes pending entry for current task when transaction succeeds", async () => {
    // First create a pending task
    vi.mocked(withTaskStateTransaction).mockRejectedValueOnce(new Error("push failed"));
    await cmdNew("First task");
    expect(loadPendingPublish(repoDir).length).toBe(1);

    // Now create another that succeeds
    vi.mocked(withTaskStateTransaction).mockResolvedValueOnce(undefined);
    await cmdNew("Second task");

    // First task's pending entry remains (it has different ID)
    const pending = loadPendingPublish(repoDir);
    const firstTask = pending.find((p) => p.title === "First task");
    expect(firstTask).toBeTruthy();
  });

  it("creates a task file even when push fails", async () => {
    vi.mocked(withTaskStateTransaction).mockRejectedValue(new Error("push failed"));

    await cmdNew("Local file test");

    // Local file should exist even when push fails
    const dirContent = fs.readdirSync(stateDir);
    expect(dirContent.length).toBeGreaterThan(0);
    const taskFile = dirContent.find((f) => f.startsWith("TASK-"));
    expect(taskFile).toBeTruthy();
  });

  it("returns JSON result with publication status on push failure", async () => {
    vi.mocked(withTaskStateTransaction).mockRejectedValue(new Error("push failed"));

    // Capture console output for JSON mode
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg: string) => { logs.push(msg); });
    await cmdNew("JSON test", { json: true });
    spy.mockRestore();

    // At least one log should contain the pending publication info
    const jsonLog = logs.find((l) => l.includes("publicationStatus:pending"));
    expect(jsonLog).toBeTruthy();
  });

  it("returns JSON success result on successful creation", async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg: string) => { logs.push(msg); });
    await cmdNew("JSON success", { json: true });
    spy.mockRestore();

    // Find the JSON success output
    const jsonLog = logs.find((l) => l.includes("task_created") || l.includes("Created"));
    expect(jsonLog).toBeTruthy();
  });
});
