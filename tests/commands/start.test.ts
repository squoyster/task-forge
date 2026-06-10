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
  loadAllTasks: vi.fn().mockReturnValue([]),
  updateTaskLock: vi.fn(),
  updateTaskStatus: vi.fn(),
  appendAgentNote: vi.fn(),
  clearTaskLock: vi.fn(),
  parseTaskFile: vi.fn(),
  writeTaskFile: vi.fn(),
}));

let currentSessionId = "test-session-123";

vi.mock("../../src/core/session.js", () => ({
  resolveSessionId: vi.fn().mockResolvedValue("test-session-123"),
  generateSessionId: vi.fn().mockImplementation(() => currentSessionId),
  parseSessionIdFromBranch: vi.fn().mockImplementation((branch: string) => {
    const match = branch.match(/--([a-f0-9]{10})$/);
    return match ? match[1] : null;
  }),
  checkOutstandingSessionTasks: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/core/git.js", () => ({
  createWorktree: vi.fn().mockResolvedValue({
    path: "/tmp/worktree/TASK-001",
    branch: "agent/TASK-001-test",
    created: true,
  }),
  jitteredPush: vi.fn(),
  pullTaskState: vi.fn().mockResolvedValue(true),
  checkUncommittedWorktrees: vi.fn().mockResolvedValue([]),
  getCurrentBranch: vi.fn().mockResolvedValue("agent/TASK-001-test--test-session-123"),
}));

vi.mock("../../src/core/status-transition.js", () => ({
  validateTransition: vi.fn().mockReturnValue(null),
}));

vi.mock("../../src/core/doctor-lock.js", () => ({
  isDoctorLocked: vi.fn().mockReturnValue({ locked: false }),
}));

vi.mock("../../src/core/control-files.js", () => ({
  hashControlFiles: vi.fn().mockReturnValue("hash-123"),
}));

vi.mock("../../src/core/task-state-transaction.js", () => ({
  withTaskStateTransaction: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../src/core/authority.js", () => ({
  resolveAuthority: vi.fn().mockReturnValue("human"),
  assertCanForce: vi.fn(),
  getForceRejectionNextActions: vi.fn().mockReturnValue([]),
  ForceRequiresHumanOrDoctorError: class extends Error {},
}));

// Import mocked functions
import { sweepStaleTasks } from "../../src/core/sweeper.js";
import { loadTaskById } from "../../src/core/task-store.js";
import { resolveSessionId } from "../../src/core/session.js";
import { createWorktree } from "../../src/core/git.js";

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

  it("allows starting a task claimed by the current session", async () => {
    const mockTask = {
      id: "TASK-001",
      status: "In Progress",
      priority: "P2",
      type: "Task",
      agentRole: "Implementer",
      riskLevel: "Low",
      humanInterventionRequired: false,
      filePath: path.join(stateDir, "TASK-001.md"),
      body: "# TASK-001: Test\n\n## Goal\nTest",
      assignee: "test-session-123",
      claimed_at: "2026-05-27 10:00:00",
      branch: "agent/TASK-001-test",
      worktree: undefined,
    };

    (loadTaskById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTask);

    // Should not throw — same session re-entry is allowed
    await expect(cmdStart("TASK-001")).resolves.not.toThrow();
    expect(createWorktree).toHaveBeenCalled();
  });

  it("allows starting a Verify task selected for QA", async () => {
    const mockTask = {
      id: "TASK-001",
      status: "Verify",
      priority: "P2",
      type: "Task",
      agentRole: "QA",
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

    await expect(cmdStart("TASK-001")).resolves.not.toThrow();
    expect(createWorktree).toHaveBeenCalled();
  });

  it("rejects starting a task claimed by a different session", async () => {
    const mockTask = {
      id: "TASK-001",
      status: "In Progress",
      priority: "P2",
      type: "Task",
      agentRole: "Implementer",
      riskLevel: "Low",
      humanInterventionRequired: false,
      filePath: path.join(stateDir, "TASK-001.md"),
      body: "# TASK-001: Test\n\n## Goal\nTest",
      assignee: "other-session-456",
      claimed_at: "2026-05-27 10:00:00",
      branch: undefined,
      worktree: undefined,
    };

    (loadTaskById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTask);

    let capturedOutput = "";
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      capturedOutput = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    });

    // Should reject — different session without --force
    await cmdStart("TASK-001", { json: true });

    logSpy.mockRestore();
    const output = JSON.parse(capturedOutput);
    expect(output.ok).toBe(false);
    expect(output.code).toBe("ALREADY_ASSIGNED");
    expect(createWorktree).not.toHaveBeenCalled();
  });

  it("allows starting with --force when task is claimed by different session", async () => {
    const mockTask = {
      id: "TASK-001",
      status: "In Progress",
      priority: "P2",
      type: "Task",
      agentRole: "Implementer",
      riskLevel: "Low",
      humanInterventionRequired: false,
      filePath: path.join(stateDir, "TASK-001.md"),
      body: "# TASK-001: Test\n\n## Goal\nTest",
      assignee: "other-session-456",
      claimed_at: "2026-05-27 10:00:00",
      branch: undefined,
      worktree: undefined,
    };

    (loadTaskById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTask);

    // Should succeed with --force
    await expect(cmdStart("TASK-001", { force: true })).resolves.not.toThrow();
    expect(createWorktree).toHaveBeenCalled();
  });

  it("reuses existing branch session ID when already in a task worktree", async () => {
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

    expect(resolveSessionId).toHaveBeenCalled();
  });

  it("already-assigned error does not recommend --force as valid action", async () => {
    const mockTask = {
      id: "TASK-001",
      status: "In Progress",
      priority: "P2",
      type: "Task",
      agentRole: "Implementer",
      riskLevel: "Low",
      humanInterventionRequired: false,
      filePath: path.join(stateDir, "TASK-001.md"),
      body: "# TASK-001: Test\n\n## Goal\nTest",
      assignee: "other-session-456",
      claimed_at: "2026-05-27 10:00:00",
      branch: undefined,
      worktree: undefined,
    };

    (loadTaskById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockTask);

    let capturedOutput = "";
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      capturedOutput = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    });

    await cmdStart("TASK-001", { json: true });

    logSpy.mockRestore();
    const output = JSON.parse(capturedOutput);
    expect(output.ok).toBe(false);
    expect(output.code).toBe("ALREADY_ASSIGNED");
    // Guidance must not recommend using --force as a valid action
    expect(output.error).not.toMatch(/use 'taskforge.*--force'/i);
    expect(output.error).not.toMatch(/use.*--force.*to override/i);
    expect(output.error).toContain("taskforge resume");
    expect(output.error).toContain("taskforge doctor");
  });
});
