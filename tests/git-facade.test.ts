import { beforeEach, describe, expect, it, vi } from "vitest";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("../src/core/task-store.js", () => ({
  loadTaskById: vi.fn(),
  writeTaskFile: vi.fn(),
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

vi.mock("../src/core/git.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getBranchCommitsBehind: vi.fn().mockResolvedValue(0),
  };
});

import { cmdCheckpoint, cmdPr, cmdSubmit } from "../src/commands/git-facade.js";
import { appendTaskTranscript } from "../src/core/audit.js";
import { TaskForgeError } from "../src/core/errors.js";
import { assertTaskOwnership } from "../src/core/session.js";
import { loadTaskById } from "../src/core/task-store.js";
import { run } from "../src/util/exec.js";
import { getBranchCommitsBehind } from "../src/core/git.js";

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
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: "Auto-merging src/commands/update.ts\nCONFLICT (add/add): Merge conflict in src/commands/update.ts\n",
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
    expect(run).toHaveBeenCalledTimes(2);
    expect(appendTaskTranscript).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns noop when branch is already submitted and mergeable", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })
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
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(getBranchCommitsBehind).mockResolvedValue(0);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })   // fetch
      .mockResolvedValueOnce({ stdout: "deadbeef\n", stderr: "", exitCode: 0 })  // merge-tree
      .mockResolvedValueOnce({
        stdout: "  refs/heads/agent/TASK-285-test:refs/heads/agent/TASK-285-test abc123..def456\n",
        stderr: "",
        exitCode: 0,
      })  // push
      .mockResolvedValueOnce({ stdout: "abc123def\n", stderr: "", exitCode: 0 });  // rev-parse HEAD
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

  it("returns failed when merge-tree check fails", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })   // fetch succeeds
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "fatal: Not a valid object name: origin/main",
        exitCode: 128,
      });  // merge-tree fails
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.code).toBe("MERGEABILITY_CHECK_FAILED");
    expect(output.error).toContain("Could not verify whether");
    expect(output.error).toContain("Not a valid object name");

    logSpy.mockRestore();
  });

  it("returns failed with BRANCH_BEHIND when branch is behind integration branch", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(getBranchCommitsBehind).mockResolvedValue(3);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 });  // fetch
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.status).toBe("failed");
    expect(output.code).toBe("BRANCH_BEHIND");
    expect(output.error).toContain("3 commit(s) behind origin/main");
    expect(output.error).toContain("rebase");
    expect(run).toHaveBeenCalledTimes(1);
    expect(appendTaskTranscript).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns failed with FETCH_FAILED when initial fetch fails", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run).mockResolvedValueOnce({
      stdout: "",
      stderr: "fatal: could not read from remote repository",
      exitCode: 128,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.code).toBe("FETCH_FAILED");
    expect(output.error).toContain("Could not fetch origin/main");
    expect(run).toHaveBeenCalledTimes(1);

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

  it("cmdCheckpoint uses target task context even when invoked outside the task worktree", async () => {
    vi.mocked(loadTaskById).mockReturnValue({
      id: "TASK-001",
      assignee: "a1b2c3d4f5",
      branch: "agent/TASK-001-fix--a1b2c3d4f5",
      worktree: "/tmp/worktrees/TASK-001",
    });
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "agent/TASK-001-fix--a1b2c3d4f5\n" })
      .mockResolvedValueOnce({ stdout: " M src/core/session.ts\n" })
      .mockResolvedValueOnce({ stdout: "" })
      .mockResolvedValueOnce({ stdout: "" });

    await expect(cmdCheckpoint("TASK-001", "fix ownership")).resolves.toBeUndefined();

    expect(assertTaskOwnership).toHaveBeenCalledWith(
      expect.objectContaining({ id: "TASK-001", worktree: "/tmp/worktrees/TASK-001" }),
      expect.any(String),
    );
    expect(run).toHaveBeenCalledWith(
      "git",
      ["-C", "/tmp/worktrees/TASK-001", "rev-parse", "--abbrev-ref", "HEAD"],
      expect.any(String),
    );
  });

  it("cmdSubmit enforces ownership against the target task context", async () => {
    vi.mocked(loadTaskById).mockReturnValue({
      id: "TASK-001",
      assignee: "a1b2c3d4f5",
      branch: "agent/TASK-001-fix--a1b2c3d4f5",
      worktree: "/tmp/worktrees/TASK-001",
    });
    vi.mocked(assertTaskOwnership).mockRejectedValue(
      new TaskForgeError("target task context mismatch", "OWNERSHIP_MISMATCH"),
    );

    await expect(cmdSubmit("TASK-001")).rejects.toThrow("target task context mismatch");
    expect(run).not.toHaveBeenCalledWith(
      "git",
      ["-C", "/tmp/worktrees/TASK-001", "push", "origin", "agent/TASK-001-fix--a1b2c3d4f5"],
      expect.any(String),
    );
  });

  it("returns failed when audit transcript write fails after a successful commit", async () => {
    vi.mocked(loadTaskById).mockReturnValue({
      id: "TASK-001",
      assignee: "a1b2c3d4f5",
      branch: "agent/TASK-001-fix--a1b2c3d4f5",
      worktree: "/tmp/worktrees/TASK-001",
    });
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "agent/TASK-001-fix--a1b2c3d4f5\n" })
      .mockResolvedValueOnce({ stdout: " M src/core/session.ts\n" })
      .mockResolvedValueOnce({ stdout: "" })
      .mockResolvedValueOnce({ stdout: "" });
    vi.mocked(appendTaskTranscript).mockImplementation(() => {
      throw new Error("EACCES: transcript append denied");
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdCheckpoint("TASK-001", "fix ownership", true);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.status).toBe("failed");
    expect(output.code).toBe("CHECKPOINT_AUDIT_WRITE_FAILED");
    expect(output.error).toContain("Commit succeeded for TASK-001");
    expect(output.error).toContain("EACCES: transcript append denied");
    expect(output.recovery.required).toBe(true);

    logSpy.mockRestore();
  });
});
