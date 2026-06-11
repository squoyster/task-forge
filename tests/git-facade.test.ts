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

const task = {
  id: "TASK-285",
  status: "In Progress",
  priority: "P1",
  type: "Bug",
  agentRole: "Implementer",
  riskLevel: "Low",
  humanInterventionRequired: false,
  filePath: "/tmp/TASK-285.md",
  body: "# TASK-285\n",
  branch: "agent/TASK-285-test",
  worktree: "/tmp/taskforge/TASK-285",
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

  it("returns failed when branch is not mergeable with origin/main", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "abc123\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: "CONFLICT (add/add): Merge conflict in src/commands/update.ts\n",
        stderr: "",
        exitCode: 1,
      });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.status).toBe("failed");
    expect(output.code).toBe("NOT_MERGEABLE");
    expect(output.error).toContain("does not merge cleanly with origin/main");
    expect(output.error).toContain("src/commands/update.ts");
    expect(run).toHaveBeenCalledTimes(3);
    expect(appendTaskTranscript).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns noop when branch is already submitted and mergeable", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "abc123\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "deadbeef\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: "= refs/heads/agent/TASK-285-test:refs/heads/agent/TASK-285-test [up to date]\n",
        stderr: "",
        exitCode: 0,
      });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.status).toBe("noop");
    expect(output.guidance).toContain("already submitted and merges cleanly with origin/main");
    expect(appendTaskTranscript).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns success when branch push occurs and branch is mergeable", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "abc123\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "deadbeef\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: "  refs/heads/agent/TASK-285-test:refs/heads/agent/TASK-285-test abc123..def456\n",
        stderr: "",
        exitCode: 0,
      });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.guidance).toContain("Pushed branch agent/TASK-285-test to origin");
    expect(output.guidance).toContain("merges cleanly with origin/main");
    expect(appendTaskTranscript).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns failed when mergeability preflight cannot be verified", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(run).mockResolvedValueOnce({
      stdout: "",
      stderr: "fatal: could not read from remote repository",
      exitCode: 128,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.code).toBe("MERGEABILITY_CHECK_FAILED");
    expect(output.error).toContain("Could not verify whether");
    expect(output.error).toContain("fatal: could not read from remote repository");

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
