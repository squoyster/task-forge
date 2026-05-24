import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { withTaskStateTransaction } from "../src/core/task-state-transaction.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ stdout: "" }),
}));

// Mock simple-git
vi.mock("simple-git", () => {
  const mockGit = {
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    revparse: vi.fn().mockResolvedValue("abc123def456"),
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
        { command: "test", maxRetries: 2 },
        (tx) => {
          tx.claimTask("TASK-001", "s");
        },
      ),
    ).resolves.not.toThrow();

    expect(callCount).toBe(2);
  });

  it("captures base HEAD and includes it in transaction events", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });

    await withTaskStateTransaction(
      { command: "test-head", maxRetries: 1 },
      (tx) => {
        tx.appendEvent("TASK-001", "test_event", { foo: "bar" });
      },
    );

    // Verify simple-git revparse was called
    const { default: simpleGit } = await import("simple-git");
    const mockGit = simpleGit();
    expect(mockGit.revparse).toHaveBeenCalledWith(["HEAD"]);
  });
});
