import { beforeEach, describe, expect, it, vi } from "vitest";
import { cmdCheckpoint, cmdSubmit, cmdPr } from "../src/commands/git-facade.js";
import { TaskForgeError } from "../src/core/errors.js";

const mocks = vi.hoisted(() => ({
  loadTaskById: vi.fn(),
  assertTaskOwnership: vi.fn(),
  run: vi.fn(),
  loadConfig: vi.fn(),
  appendTaskTranscript: vi.fn(),
  createTaskEvent: vi.fn(),
}));

vi.mock("../src/core/task-store.js", () => ({
  loadTaskById: mocks.loadTaskById,
}));

vi.mock("../src/core/session.js", () => ({
  assertTaskOwnership: mocks.assertTaskOwnership,
}));

vi.mock("../src/util/exec.js", () => ({
  run: mocks.run,
}));

vi.mock("../src/core/config.js", () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock("../src/core/audit.js", () => ({
  appendTaskTranscript: mocks.appendTaskTranscript,
  createTaskEvent: mocks.createTaskEvent,
}));

describe("git facade commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadConfig.mockReturnValue({});
    mocks.createTaskEvent.mockReturnValue({});
  });

  it("cmdCheckpoint throws for non-existent task", async () => {
    mocks.loadTaskById.mockReturnValue(undefined);
    await expect(cmdCheckpoint("TASK-999", "test")).rejects.toThrow();
  });

  it("cmdSubmit throws for non-existent task", async () => {
    mocks.loadTaskById.mockReturnValue(undefined);
    await expect(cmdSubmit("TASK-999")).rejects.toThrow();
  });

  it("cmdPr throws for non-existent task", async () => {
    await expect(cmdPr("TASK-999")).rejects.toThrow();
  });

  it("rejects commit trailers format", () => {
    const message = "feat: add feature";
    const fullMessage = [
      message,
      "",
      "Task: TASK-001",
      "TaskForge-Managed: true",
    ].join("\n");
    expect(fullMessage).toContain("Task: TASK-001");
    expect(fullMessage).toContain("TaskForge-Managed: true");
    expect(fullMessage).toContain("feat: add feature");
  });

  it("cmdCheckpoint uses target task context even when invoked outside the task worktree", async () => {
    mocks.loadTaskById.mockReturnValue({
      id: "TASK-001",
      assignee: "a1b2c3d4f5",
      branch: "agent/TASK-001-fix--a1b2c3d4f5",
      worktree: "/tmp/worktrees/TASK-001",
    });
    mocks.assertTaskOwnership.mockResolvedValue(undefined);
    mocks.run
      .mockResolvedValueOnce({ stdout: "agent/TASK-001-fix--a1b2c3d4f5\n" })
      .mockResolvedValueOnce({ stdout: " M src/core/session.ts\n" })
      .mockResolvedValueOnce({ stdout: "" })
      .mockResolvedValueOnce({ stdout: "" });

    await expect(cmdCheckpoint("TASK-001", "fix ownership")).resolves.toBeUndefined();

    expect(mocks.assertTaskOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ id: "TASK-001", worktree: "/tmp/worktrees/TASK-001" }),
      expect.any(String),
    );
    expect(mocks.run).toHaveBeenCalledWith(
      "git",
      ["-C", "/tmp/worktrees/TASK-001", "rev-parse", "--abbrev-ref", "HEAD"],
      expect.any(String),
    );
  });

  it("cmdSubmit enforces ownership against the target task context", async () => {
    mocks.loadTaskById.mockReturnValue({
      id: "TASK-001",
      assignee: "a1b2c3d4f5",
      branch: "agent/TASK-001-fix--a1b2c3d4f5",
      worktree: "/tmp/worktrees/TASK-001",
    });
    mocks.assertTaskOwnership.mockRejectedValue(
      new TaskForgeError("target task context mismatch", "OWNERSHIP_MISMATCH"),
    );

    await expect(cmdSubmit("TASK-001")).rejects.toThrow("target task context mismatch");
    expect(mocks.run).not.toHaveBeenCalledWith(
      "git",
      ["-C", "/tmp/worktrees/TASK-001", "push", "origin", "agent/TASK-001-fix--a1b2c3d4f5"],
      expect.any(String),
    );
  });
});
