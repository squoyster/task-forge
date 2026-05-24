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
  commitAndPushTaskState: vi.fn(),
  pullTaskState: vi.fn(),
  jitteredPush: vi.fn(),
  ensureTaskStateBranch: vi.fn(),
}));

vi.mock("../src/commands/gates.js", () => ({
  cmdGates: vi.fn().mockResolvedValue(true),
}));

import { removeWorktree, removeBranch } from "../src/core/git.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-done-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);

  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
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
    `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [ ] Do something\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
    body,
  ];
  const filePath = path.join(stateDir, `${id}.md`);
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

    expect(removeWorktree).toHaveBeenCalledWith(path.join(uniqueDir, "repo"), "TASK-005");
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

    expect(removeWorktree).toHaveBeenCalledWith(path.join(uniqueDir, "repo"), "TASK-005");
    expect(removeBranch).toHaveBeenCalledWith(
      path.join(uniqueDir, "repo"),
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

    expect(removeWorktree).toHaveBeenCalledWith(path.join(uniqueDir, "repo"), "TASK-005");
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

  it("rejects done when Acceptance Criteria section is missing", async () => {
    const body = `# TASK-005: Test task TASK-005\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
    makeTaskFile("TASK-005", { body });
    await expect(cmdDone("TASK-005")).rejects.toThrow(
      /no "## Acceptance Criteria" section found/i,
    );
  });

  it("rejects done with JSON error when AC section is missing", async () => {
    const body = `# TASK-005: Test task\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
    makeTaskFile("TASK-005", { body });

    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await cmdDone("TASK-005", { json: true });
    consoleSpy.mockRestore();

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(false);
    expect(output.code).toBe("MISSING_ACCEPTANCE_CRITERIA");
    expect(output.error).toContain("Add acceptance criteria");
  });

  it("allows force done when AC section is missing", async () => {
    const body = `# TASK-005: Test task TASK-005\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
    const fp = makeTaskFile("TASK-005", { body });
    await cmdDone("TASK-005", { force: true });

    const task = readTaskFile(fp);
    expect(task.frontmatter.status).toBe("Done");
  });

  it("rejects done when Acceptance Criteria items are blank", async () => {
    const body = `# TASK-005: Test task\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [ ]\n- [x]\n\n## Agent Notes\n`;
    makeTaskFile("TASK-005", { body });
    await expect(cmdDone("TASK-005")).rejects.toThrow(
      /one or more acceptance criteria are blank/i,
    );
  });

  it("rejects done with JSON error when AC items are blank", async () => {
    const body = `# TASK-005: Test task\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [ ]\n\n## Agent Notes\n`;
    makeTaskFile("TASK-005", { body });

    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await cmdDone("TASK-005", { json: true });
    consoleSpy.mockRestore();

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(false);
    expect(output.code).toBe("BLANK_ACCEPTANCE_CRITERIA");
    expect(output.error).toContain("Replace placeholder checkboxes");
  });

  it("allows force done when AC items are blank", async () => {
    const body = `# TASK-005: Test task\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [ ]\n\n## Agent Notes\n`;
    const fp = makeTaskFile("TASK-005", { body });
    await cmdDone("TASK-005", { force: true });

    const task = readTaskFile(fp);
    expect(task.frontmatter.status).toBe("Done");
  });
});
