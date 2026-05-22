import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdDone } from "../src/commands/done.js";
import { setRepoRoot } from "../src/util/paths.js";

// Mock the git module so we don't need real git operations
vi.mock("../src/core/git.js", () => ({
  removeWorktree: vi.fn(),
  removeBranch: vi.fn(),
}));

import { removeWorktree, removeBranch } from "../src/core/git.js";

let tmpDir: string;
let tasksDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-done-test-"));
  tasksDir = path.join(tmpDir, "tasks");
  fs.mkdirSync(tasksDir, { recursive: true });
  setRepoRoot(tmpDir);

  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeTaskFile(
  id: string,
  overrides: Record<string, unknown> = {},
): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Review",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body =
    (bodyOverride as string | undefined) ??
    `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
    body,
  ];
  const filePath = path.join(tasksDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

function readTaskFile(filePath: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const content = fs.readFileSync(filePath, "utf-8");
  const [, frontmatterRaw, ...rest] = content.split("---");
  const frontmatter: Record<string, unknown> = {};
  for (const line of frontmatterRaw.trim().split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return {
    frontmatter,
    body: rest.join("---").trim(),
  };
}

describe("cmdDone", () => {
  it("marks a task as Done without cleanup", async () => {
    const fp = makeTaskFile("TASK-005");
    await cmdDone("TASK-005");

    const task = readTaskFile(fp);
    expect(task.frontmatter.status).toBe("Done");
    expect(task.body).toContain("Task marked Done");
    expect(removeWorktree).not.toHaveBeenCalled();
    expect(removeBranch).not.toHaveBeenCalled();
  });

  it("accepts force option for invalid transitions", async () => {
    const fp = makeTaskFile("TASK-005", { status: "In Progress" });
    await cmdDone("TASK-005", { force: true });

    const task = readTaskFile(fp);
    expect(task.frontmatter.status).toBe("Done");
    expect(task.body).toContain("Task marked Done (forced)");
  });

  it("removes worktree when --cleanup is used", async () => {
    vi.mocked(removeWorktree).mockResolvedValue(true);

    const fp = makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-cleanup",
    });
    await cmdDone("TASK-005", { cleanup: true });

    expect(removeWorktree).toHaveBeenCalledWith(tmpDir, "TASK-005");
    // Status should still be Done
    const task = readTaskFile(fp);
    expect(task.frontmatter.status).toBe("Done");
  });

  it("removes worktree and branch with --cleanup --delete-branch", async () => {
    vi.mocked(removeWorktree).mockResolvedValue(true);
    vi.mocked(removeBranch).mockResolvedValue(true);

    makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-cleanup",
    });
    await cmdDone("TASK-005", { cleanup: true, deleteBranch: true });

    expect(removeWorktree).toHaveBeenCalledWith(tmpDir, "TASK-005");
    expect(removeBranch).toHaveBeenCalledWith(
      tmpDir,
      "agent/TASK-005-cleanup",
    );
  });

  it("is safe (no-op) when worktree does not exist", async () => {
    vi.mocked(removeWorktree).mockResolvedValue(false);

    const fp = makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
    });
    // Should not throw
    await expect(
      cmdDone("TASK-005", { cleanup: true }),
    ).resolves.not.toThrow();

    expect(removeWorktree).toHaveBeenCalledWith(tmpDir, "TASK-005");
    const task = readTaskFile(fp);
    expect(task.frontmatter.status).toBe("Done");
  });

  it("clears worktree and branch from frontmatter after cleanup", async () => {
    vi.mocked(removeWorktree).mockResolvedValue(true);
    vi.mocked(removeBranch).mockResolvedValue(true);

    const fp = makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-cleanup",
    });
    await cmdDone("TASK-005", { cleanup: true, deleteBranch: true });

    const task = readTaskFile(fp);
    expect(task.frontmatter.worktree).toBeUndefined();
    expect(task.frontmatter.branch).toBeUndefined();
  });

  it("throws for non-existent task", async () => {
    await expect(cmdDone("TASK-999")).rejects.toThrow(/not found/i);
  });

  it("throws for invalid transition without force", async () => {
    makeTaskFile("TASK-005", { status: "In Progress" });
    await expect(cmdDone("TASK-005")).rejects.toThrow(
      /cannot transition/i,
    );
  });

  it("handles cleanup gracefully when worktree removal fails", async () => {
    vi.mocked(removeWorktree).mockRejectedValue(
      new Error("git worktree remove failed"),
    );

    const fp = makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
    });
    // Should not throw — cleanup failure should not roll back status
    await expect(
      cmdDone("TASK-005", { cleanup: true }),
    ).resolves.not.toThrow();

    const task = readTaskFile(fp);
    expect(task.frontmatter.status).toBe("Done");
  });

  it("handles branch deletion failure gracefully", async () => {
    vi.mocked(removeWorktree).mockResolvedValue(true);
    vi.mocked(removeBranch).mockRejectedValue(
      new Error("git branch delete failed"),
    );

    const fp = makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-cleanup",
    });
    await expect(
      cmdDone("TASK-005", { cleanup: true, deleteBranch: true }),
    ).resolves.not.toThrow();

    const task = readTaskFile(fp);
    expect(task.frontmatter.status).toBe("Done");
  });
});
