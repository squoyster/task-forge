import { beforeEach, describe, expect, it, vi } from "vitest";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("../src/core/task-store.js", () => ({
  loadTaskById: vi.fn(),
}));

vi.mock("../src/core/session.js", () => ({
  assertTaskOwnership: vi.fn(),
}));

vi.mock("../src/util/exec.js", () => ({
  run: vi.fn(),
}));

vi.mock("../src/core/audit.js", () => ({
  createTaskEvent: vi.fn().mockImplementation((taskId: string, type: string, data: unknown) => ({
    taskId,
    type,
    data,
  })),
  appendTaskTranscript: vi.fn(),
}));

vi.mock("../src/core/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({}),
}));

vi.mock("../src/integrations/github/service.js", () => ({
  createPullRequest: vi.fn(),
}));

vi.mock("../src/core/git.js", () => ({
  getBranchCommitsAhead: vi.fn(),
}));

vi.mock("../src/util/logging.js", () => ({
  logInfo: vi.fn(),
  logHeader: vi.fn(),
  logSuccess: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { cmdCheckpoint, cmdPr, cmdSubmit } from "../src/commands/git-facade.js";
import { loadTaskById } from "../src/core/task-store.js";
import { run } from "../src/util/exec.js";
import { appendTaskTranscript } from "../src/core/audit.js";
import { getBranchCommitsAhead } from "../src/core/git.js";

const task = {
  id: "TASK-281",
  status: "In Progress",
  priority: "P2",
  type: "Task",
  agentRole: "Implementer",
  riskLevel: "Medium",
  humanInterventionRequired: false,
  filePath: "/tmp/TASK-281.md",
  body: "# TASK-281\n",
  branch: "agent/TASK-281-test",
  worktree: "/tmp/taskforge/TASK-281",
};

describe("git facade commands", () => {
  beforeEach(() => {
    setRepoRoot("/tmp/taskforge-repo");
    vi.clearAllMocks();
  });

  it("cmdCheckpoint throws for non-existent task", async () => {
    vi.mocked(loadTaskById).mockReturnValue(null);
    await expect(cmdCheckpoint("TASK-999", "test")).rejects.toThrow();
  });

  it("cmdSubmit throws for non-existent task", async () => {
    vi.mocked(loadTaskById).mockReturnValue(null);
    await expect(cmdSubmit("TASK-999")).rejects.toThrow();
  });

  it("cmdPr throws for non-existent task", async () => {
    vi.mocked(loadTaskById).mockReturnValue(null);
    await expect(cmdPr("TASK-999")).rejects.toThrow();
  });

  it("returns noop when branch is already up to date on origin", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(run).mockResolvedValueOnce({ stdout: "abc\trefs/heads/agent/TASK-281-test\n", stderr: "", exitCode: 0 });
    vi.mocked(getBranchCommitsAhead).mockResolvedValue(0);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-281", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.status).toBe("noop");
    expect(output.guidance).toContain("already up to date on origin");
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalledWith(
      "git",
      ["-C", task.worktree, "push", "origin", task.branch],
      "/tmp/taskforge-repo",
    );
    expect(appendTaskTranscript).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns success when branch push actually occurs for an existing remote branch", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "abc\trefs/heads/agent/TASK-281-test\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });
    vi.mocked(getBranchCommitsAhead).mockResolvedValue(2);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-281", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.guidance).toContain(`Pushed branch ${task.branch} to origin`);
    expect(output.guidance).not.toContain("No changes to submit");
    expect(run).toHaveBeenCalledWith(
      "git",
      ["-C", task.worktree, "push", "origin", task.branch],
      "/tmp/taskforge-repo",
    );
    expect(appendTaskTranscript).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("pushes a new branch when no remote branch exists yet", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-281", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.status).toBe("success");
    expect(output.guidance).toContain(`Pushed branch ${task.branch} to origin`);
    expect(getBranchCommitsAhead).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledWith(
      "git",
      ["-C", task.worktree, "push", "origin", task.branch],
      "/tmp/taskforge-repo",
    );

    logSpy.mockRestore();
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
});
