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
  findPullRequestByHead: vi.fn(),
}));

vi.mock("../src/util/logging.js", () => ({
  logInfo: vi.fn(),
  logHeader: vi.fn(),
  logSuccess: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { cmdCheckpoint, cmdPr, cmdSubmit } from "../src/commands/git-facade.js";
import { appendTaskTranscript } from "../src/core/audit.js";
import { loadConfig } from "../src/core/config.js";
import { TaskForgeError } from "../src/core/errors.js";
import { assertTaskOwnership } from "../src/core/session.js";
import { loadTaskById } from "../src/core/task-store.js";
import { createPullRequest, findPullRequestByHead } from "../src/integrations/github/service.js";
import { run } from "../src/util/exec.js";

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

  it("returns noop when branch is already on remote and no GitHub configured", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })               // fetch origin main
      .mockResolvedValueOnce({ stdout: "deadbeef\n", stderr: "", exitCode: 0 })     // merge-tree
      .mockResolvedValueOnce({                                                      // ls-remote → remote exists
        stdout: "abc123def456789abc123def456789abc123def4\trefs/heads/agent/TASK-285-test\n",
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: "abc123def456789abc123def456789abc123def4\n", exitCode: 0 })  // rev-parse HEAD
      .mockResolvedValueOnce({ stdout: "0\n", stderr: "", exitCode: 0 });           // rev-list (0 ahead)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.status).toBe("noop");
    expect(output.guidance).toContain("on remote");
    expect(output.guidance).toContain("create a pull request");
    expect(appendTaskTranscript).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns success when branch is missing remote and push occurs", async () => {
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })               // fetch origin main
      .mockResolvedValueOnce({ stdout: "deadbeef\n", stderr: "", exitCode: 0 })     // merge-tree
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })               // ls-remote → empty (no remote)
      .mockResolvedValueOnce({ stdout: "abc123def456789abc123def456789abc123def4\n", exitCode: 0 })  // rev-parse HEAD
      .mockResolvedValueOnce({                                                      // push → success
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

  it("returns success and creates PR when remote branch exists with no PR", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      github: { enabled: true, owner: "test-owner", repo: "test-repo" },
    });
    vi.mocked(findPullRequestByHead).mockResolvedValue(null);
    vi.mocked(createPullRequest).mockResolvedValue({ number: 42, url: "https://github.com/test-owner/test-repo/pull/42" });
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })               // fetch origin main
      .mockResolvedValueOnce({ stdout: "deadbeef\n", stderr: "", exitCode: 0 })     // merge-tree
      .mockResolvedValueOnce({                                                      // ls-remote → remote exists
        stdout: "abc123def456789abc123def456789abc123def4\trefs/heads/agent/TASK-285-test\n",
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: "abc123def456789abc123def456789abc123def4\n", exitCode: 0 })  // rev-parse HEAD
      .mockResolvedValueOnce({ stdout: "0\n", stderr: "", exitCode: 0 });           // rev-list (0 ahead)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.guidance).toContain("PR #42 created");
    expect(appendTaskTranscript).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns noop when PR already exists for the branch", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      github: { enabled: true, owner: "test-owner", repo: "test-repo" },
    });
    vi.mocked(findPullRequestByHead).mockResolvedValue({ number: 42, url: "https://github.com/test-owner/test-repo/pull/42" });
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })               // fetch origin main
      .mockResolvedValueOnce({ stdout: "deadbeef\n", stderr: "", exitCode: 0 })     // merge-tree
      .mockResolvedValueOnce({                                                      // ls-remote → remote exists
        stdout: "abc123def456789abc123def456789abc123def4\trefs/heads/agent/TASK-285-test\n",
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: "abc123def456789abc123def456789abc123def4\n", exitCode: 0 })  // rev-parse HEAD
      .mockResolvedValueOnce({ stdout: "0\n", stderr: "", exitCode: 0 });           // rev-list (0 ahead)
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.status).toBe("noop");
    expect(output.guidance).toContain("fully submitted");
    expect(output.guidance).toContain("PR already exists");
    expect(run).toHaveBeenCalledTimes(5);
    expect(appendTaskTranscript).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns success when local branch is ahead of remote", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      github: { enabled: true, owner: "test-owner", repo: "test-repo" },
    });
    vi.mocked(findPullRequestByHead).mockResolvedValue(null);
    vi.mocked(createPullRequest).mockResolvedValue({ number: 43, url: "https://github.com/test-owner/test-repo/pull/43" });
    vi.mocked(loadTaskById).mockReturnValue(task);
    vi.mocked(assertTaskOwnership).mockResolvedValue(undefined);
    vi.mocked(run)
      .mockResolvedValueOnce({ stdout: "", stderr: "", exitCode: 0 })               // fetch origin main
      .mockResolvedValueOnce({ stdout: "deadbeef\n", stderr: "", exitCode: 0 })     // merge-tree
      .mockResolvedValueOnce({                                                      // ls-remote → remote exists
        stdout: "abc123def456789abc123def456789abc123def4\trefs/heads/agent/TASK-285-test\n",
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: "xyz789def456789abc123def456789abc123def4\n", exitCode: 0 })  // rev-parse HEAD (different from remote)
      .mockResolvedValueOnce({ stdout: "3\n", stderr: "", exitCode: 0 })            // rev-list → 3 ahead
      .mockResolvedValueOnce({                                                      // push → success
        stdout: "  refs/heads/agent/TASK-285-test:refs/heads/agent/TASK-285-test abc123..def456\n",
        stderr: "",
        exitCode: 0,
      });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdSubmit("TASK-285", true);

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");
    expect(output.guidance).toContain("Pushed branch");
    expect(output.guidance).toContain("PR #43 created");
    expect(appendTaskTranscript).toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("returns failed when mergeability preflight cannot be verified", async () => {
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
