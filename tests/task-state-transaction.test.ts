import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { withTaskStateTransaction } from "../src/core/task-state-transaction.js";
import { setRepoRoot } from "../src/util/paths.js";
import * as taskStore from "../src/core/task-store.js";

vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ stdout: "" }),
}));

// Mock simple-git
vi.mock("simple-git", () => {
  const mockGit = {
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  return { default: vi.fn(() => mockGit) };
});

let uniqueDir: string;
let stateDir: string;

function makeTaskFile(id: string, overrides: Record<string, unknown> = {}): string {
  const { body: bodyOverride, ...fm } = overrides;
  const frontmatter: Record<string, unknown> = { id, type: "Task", status: "Ready", priority: "P2", ...fm };
  const body = (bodyOverride as string) ?? `# ${id}: Test\n\n## Goal\nTest\n\n## Agent Notes\n`;
  const lines = ["---", ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`), "---", "", body];
  const fp = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(fp, lines.join("\n"), "utf-8");
  return fp;
}

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-tx-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("withTaskStateTransaction", () => {
  it("loads tasks and allows mutation", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });

    const result = await withTaskStateTransaction(
      { command: "test-mutate", maxRetries: 1 },
      (tx) => {
        const task = tx.loadTask("TASK-001");
        expect(task).not.toBeNull();
        return task!.id;
      },
    );

    expect(result).toBe("TASK-001");
  });

  it("returns null for non-existent task", async () => {
    const result = await withTaskStateTransaction(
      { command: "test", maxRetries: 1 },
      (tx) => tx.loadTask("TASK-999"),
    );

    expect(result).toBeNull();
  });

  it("claimTask sets assignee", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });

    await withTaskStateTransaction(
      { command: "test-claim", maxRetries: 1 },
      (tx) => {
        tx.claimTask("TASK-001", "session-abc");
        const task = tx.loadTask("TASK-001");
        expect(task!.assignee).toBe("session-abc");
        expect(task!.status).toBe("In Progress");
      },
    );
  });

  it("clearClaim removes assignee", async () => {
    makeTaskFile("TASK-001", { status: "In Progress", assignee: "old" });

    await withTaskStateTransaction(
      { command: "test-clear", maxRetries: 1 },
      (tx) => {
        tx.clearClaim("TASK-001");
        const task = tx.loadTask("TASK-001");
        expect(task!.assignee).toBeUndefined();
      },
    );
  });

  it("re-runs mutation on conflict", async () => {
    const { execa } = await import("execa");
    let callCount = 0;
    vi.mocked(execa).mockImplementation((cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(" ")}`;
      if (joined === "git push origin task-state") {
        callCount++;
        if (callCount === 1) {
          const err = new Error("non-fast-forward") as Error & { stderr?: string };
          err.message = "Updates were rejected because the remote contains work that you do not have locally.";
          throw err;
        }
      }
      return Promise.resolve({ stdout: "" } as never);
    });

    makeTaskFile("TASK-001", { status: "Ready" });

    await expect(
      withTaskStateTransaction(
        { command: "test", maxRetries: 2, jitterMinMs: 0, jitterMaxMs: 0 },
        (tx) => {
          tx.claimTask("TASK-001", "s");
        },
      ),
    ).resolves.not.toThrow();

    expect(callCount).toBe(2);
  });

  it("reloads fresh state on non-fast-forward retry", async () => {
    const { execa } = await import("execa");
    let pushAttempts = 0;
    const loadAllTasksSpy = vi.spyOn(taskStore, "loadAllTasks");

    vi.mocked(execa).mockImplementation((cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(" ")}`;
      if (joined === "git push origin task-state") {
        pushAttempts++;
        if (pushAttempts === 1) {
          const err = new Error("non-fast-forward");
          throw err;
        }
      }
      return Promise.resolve({ stdout: "" } as never);
    });

    makeTaskFile("TASK-001", { status: "Ready" });

    await withTaskStateTransaction(
      { command: "test-reload", maxRetries: 2, jitterMinMs: 0, jitterMaxMs: 0 },
      (tx) => {
        tx.claimTask("TASK-001", "session-xyz");
      },
    );

    // loadAllTasks should be called once per attempt (initial + 1 retry)
    expect(loadAllTasksSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    loadAllTasksSpy.mockRestore();
  });

  it("reruns mutation with fresh state after conflict", async () => {
    const { execa } = await import("execa");
    let pushAttempts = 0;
    const mutationCalls: string[] = [];

    vi.mocked(execa).mockImplementation((cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(" ")}`;
      if (joined === "git push origin task-state") {
        pushAttempts++;
        if (pushAttempts === 1) {
          // On first push attempt, simulate another agent having modified the task
          // by updating the file on disk before the retry reloads it
          makeTaskFile("TASK-001", { status: "Ready", priority: "P0" });
          const err = new Error("non-fast-forward");
          throw err;
        }
      }
      return Promise.resolve({ stdout: "" } as never);
    });

    makeTaskFile("TASK-001", { status: "Ready", priority: "P2" });

    await withTaskStateTransaction(
      { command: "test-fresh-state", maxRetries: 2, jitterMinMs: 0, jitterMaxMs: 0 },
      (tx) => {
        const task = tx.loadTask("TASK-001");
        mutationCalls.push(task!.priority as string);
        tx.claimTask("TASK-001", "s");
      },
    );

    // First mutation call should see P2, second should see P0 (updated by "other agent")
    expect(mutationCalls).toContain("P2");
    expect(mutationCalls).toContain("P0");
    expect(mutationCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("throws after exhausting retries on persistent conflict", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockImplementation((cmd: string, args?: readonly string[]) => {
      const joined = `${cmd} ${(args ?? []).join(" ")}`;
      if (joined === "git push origin task-state") {
        const err = new Error("non-fast-forward");
        throw err;
      }
      return Promise.resolve({ stdout: "" } as never);
    });

    makeTaskFile("TASK-001", { status: "Ready" });

    await expect(
      withTaskStateTransaction(
        { command: "test-exhausted", maxRetries: 1, jitterMinMs: 0, jitterMaxMs: 0 },
        (tx) => {
          tx.claimTask("TASK-001", "s");
        },
      ),
    ).rejects.toThrow("non-fast-forward");
  });

  it("aborts transaction on DONE_WITH_ASSIGNEE violation", async () => {
    const commitSpy = vi.spyOn(taskStore, "writeTaskFile");

    makeTaskFile("TASK-001", { status: "In Progress", assignee: "session-abc" });

    await expect(
      withTaskStateTransaction(
        { command: "test-invalid", maxRetries: 0 },
        (tx) => {
          const task = tx.loadTask("TASK-001");
          task!.status = "Done";
          // Intentionally leave assignee set — violates DONE_WITH_ASSIGNEE
          tx.updateTask(task!);
        },
      ),
    ).rejects.toThrow("DONE_WITH_ASSIGNEE");

    // writeTaskFile should not have been called (aborted before commit)
    expect(commitSpy).not.toHaveBeenCalled();
    commitSpy.mockRestore();
  });

  it("aborts transaction on READY_WITH_ASSIGNEE violation", async () => {
    const commitSpy = vi.spyOn(taskStore, "writeTaskFile");

    makeTaskFile("TASK-001", { status: "In Progress", assignee: "session-abc" });

    await expect(
      withTaskStateTransaction(
        { command: "test-invalid-ready", maxRetries: 0 },
        (tx) => {
          const task = tx.loadTask("TASK-001");
          task!.status = "Ready";
          // Intentionally leave assignee set — violates READY_WITH_ASSIGNEE
          tx.updateTask(task!);
        },
      ),
    ).rejects.toThrow("READY_WITH_ASSIGNEE");

    expect(commitSpy).not.toHaveBeenCalled();
    commitSpy.mockRestore();
  });

  it("leaves task-state unchanged after invariant abort", async () => {
    const fp = makeTaskFile("TASK-001", { status: "In Progress", assignee: "session-abc" });
    const beforeContent = fs.readFileSync(fp, "utf-8");

    await expect(
      withTaskStateTransaction(
        { command: "test-unchanged", maxRetries: 0 },
        (tx) => {
          const task = tx.loadTask("TASK-001");
          task!.status = "Done";
          tx.updateTask(task!);
        },
      ),
    ).rejects.toThrow();

    // File should be unchanged after abort
    const afterContent = fs.readFileSync(fp, "utf-8");
    expect(afterContent).toBe(beforeContent);
  });

  it("allows valid mutation to proceed", async () => {
    const { execa } = await import("execa");
    vi.mocked(execa).mockResolvedValue({ stdout: "" } as never);

    makeTaskFile("TASK-001", { status: "In Progress", assignee: "session-abc" });

    // Clearing claim on In Progress task is valid
    await expect(
      withTaskStateTransaction(
        { command: "test-valid", maxRetries: 0 },
        (tx) => {
          tx.clearClaim("TASK-001");
        },
      ),
    ).resolves.not.toThrow();
  });
});
