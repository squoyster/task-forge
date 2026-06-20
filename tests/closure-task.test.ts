import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setRepoRoot } from "../src/util/paths.js";
import { createClosureTaskCommand, maybeAutoCreateClosureTask } from "../src/core/closure-task.js";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";

describe("closure-task helpers", () => {
  let tempRoot: string;
  let repoRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-closure-task-"));
    repoRoot = path.join(tempRoot, "repo");
    fs.mkdirSync(repoRoot, { recursive: true });
    setRepoRoot(repoRoot);
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    delete process.env.TASKFORGE_AUTO_CREATE_CLOSURE_TASKS;
    delete process.env.TASKFORGE_CLOSURE_TASK_ACTIVE;
  });

  it("builds a safe taskforge new command for unmapped errors", () => {
    const command = createClosureTaskCommand("UNMAPPED_ERROR", "branch exists during start", {
      command: "start",
      taskId: "TASK-123",
      status: "Ready",
      branch: "agent/TASK-123",
      worktree: "/tmp/worktrees/TASK-123",
      errorCode: "BRANCH_EXISTS",
      errorMessage: "Branch already exists",
      observedState: { branchExists: true, retryable: false },
    });

    expect(command).toContain("taskforge new");
    expect(command).toContain("Handle unclosed TaskForge error: branch exists during start");
    expect(command).toContain("--type Bug");
    expect(command).toContain("--priority P1");
    expect(command).toContain("--status Ready");
    expect(command).toContain("Command: start");
    expect(command).toContain("Error code: BRANCH_EXISTS");
    expect(command).toContain("\"branchExists\": true");
  });

  it("does not auto-create when invoked from taskforge new", async () => {
    process.env.TASKFORGE_AUTO_CREATE_CLOSURE_TASKS = "1";

    const result = await maybeAutoCreateClosureTask("UNKNOWN_STATE", "missing recovery path", {
      command: "new",
      taskId: "TASK-999",
    });

    expect(result).toEqual({ created: false });
    expect(execa).not.toHaveBeenCalled();
  });

  it("can auto-create a closure task when enabled and safe", async () => {
    process.env.TASKFORGE_AUTO_CREATE_CLOSURE_TASKS = "1";
    (execa as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        ok: true,
        context: { taskId: "TASK-777" },
      }),
    });

    const result = await maybeAutoCreateClosureTask("UNKNOWN_STATE", "missing recovery path", {
      command: "start",
      taskId: "TASK-123",
      status: "Ready",
    });

    expect(result).toEqual({ created: true, taskId: "TASK-777" });
    expect(execa).toHaveBeenCalled();
  });
});
