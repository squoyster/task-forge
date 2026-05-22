import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdStart } from "../../src/commands/start.js";
import { setRepoRoot } from "../../src/util/paths.js";

// Mock modules
vi.mock("../../src/core/sweeper.js", () => ({
  sweepStaleTasks: vi.fn().mockResolvedValue({
    scanned: 0,
    stale: [],
    changed: 0,
    pushed: true,
  }),
}));

vi.mock("../../src/core/task-store.js", () => ({
  loadTaskById: vi.fn(),
  updateTaskLock: vi.fn(),
  updateTaskStatus: vi.fn(),
  appendAgentNote: vi.fn(),
  clearTaskLock: vi.fn(),
}));

vi.mock("../../src/core/session.js", () => ({
  generateSessionId: vi.fn().mockReturnValue("test-session-123"),
}));

vi.mock("../../src/core/git.js", () => ({
  createWorktree: vi.fn().mockResolvedValue({
    path: "/tmp/worktree/TASK-001",
    branch: "agent/TASK-001-test",
    created: true,
  }),
  jitteredPush: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../src/core/status-transition.js", () => ({
  validateTransition: vi.fn().mockReturnValue(null),
}));

// Import mocked functions
import { sweepStaleTasks } from "../../src/core/sweeper.js";
import { loadTaskById } from "../../src/core/task-store.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-start-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);

  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdStart", () => {
  it("calls sweepStaleTasks before loading task", async () => {
    const mockTask = {
      id: "TASK-001",
      status: "Ready",
      priority: "P2",
      type: "Task",
      agentRole: "Implementer",
      riskLevel: "Low",
      humanInterventionRequired: false,
      filePath: path.join(stateDir, "TASK-001.md"),
      body: "# TASK-001: Test\n\n## Goal\nTest",
      assignee: undefined,
      claimed_at: undefined,
      branch: undefined,
      worktree: undefined,
    };

    (loadTaskById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTask);

    await cmdStart("TASK-001");

    expect(sweepStaleTasks).toHaveBeenCalled();
  });

  it("passes commit:true to sweepStaleTasks", async () => {
    const mockTask = {
      id: "TASK-001",
      status: "Ready",
      priority: "P2",
      type: "Task",
      agentRole: "Implementer",
      riskLevel: "Low",
      humanInterventionRequired: false,
      filePath: path.join(stateDir, "TASK-001.md"),
      body: "# TASK-001: Test\n\n## Goal\nTest",
      assignee: undefined,
      claimed_at: undefined,
      branch: undefined,
      worktree: undefined,
    };

    (loadTaskById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTask);

    await cmdStart("TASK-001");

    expect(sweepStaleTasks).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ commit: true }),
    );
  });
});
