import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdDone } from "../src/commands/done.js";
import { setRepoRoot } from "../src/util/paths.js";
import { recordCliInvocation } from "../src/core/cli-audit.js";
import { appendTaskTranscript, createTaskEvent } from "../src/core/audit.js";

vi.mock("../src/core/control-files.js", () => ({
  hashControlFiles: vi.fn().mockReturnValue("stablehash123456"),
}));

// Mock the git module so we don't need real git operations
vi.mock("../src/core/git.js", () => ({
  commitAndPushTaskState: vi.fn(),
  pullTaskState: vi.fn(),
  jitteredPush: vi.fn(),
  ensureTaskStateBranch: vi.fn(),
  getWorktreeDirtyFiles: vi.fn().mockResolvedValue([]),
  getBranchCommitsAhead: vi.fn().mockResolvedValue(0),
}));

vi.mock("../src/commands/gates.js", () => ({
  cmdGates: vi.fn().mockResolvedValue(true),
  runGates: vi.fn().mockResolvedValue({ passed: true, results: [] }),
}));

vi.mock("../src/core/completion-policy.js", () => ({
  checkCompletionEligibility: vi.fn().mockResolvedValue({
    eligible: true,
    reasons: [],
    preconditions: [{ name: "Mocked", passed: true, message: "test", code: "MOCKED" }],
    suggestedStatus: undefined,
  }),
  isCodeTask: vi.fn().mockReturnValue(false),
  deriveExpectedStatus: vi.fn().mockImplementation((t: any) => t.status),
}));

vi.mock("../src/core/task-state-transaction.js", () => ({
  withTaskStateTransaction: vi.fn().mockImplementation((_opts, mutate) => {
    const tx = {
      loadTask: vi.fn(),
      loadAllTasks: vi.fn(),
      updateTask: vi.fn(),
      appendNote: vi.fn(),
      appendEvent: vi.fn(),
      assertCanTransition: vi.fn(),
      claimTask: vi.fn(),
      clearClaim: vi.fn(),
    };
    return Promise.resolve(mutate(tx));
  }),
}));

import { getWorktreeDirtyFiles, getBranchCommitsAhead } from "../src/core/git.js";
import { hashControlFiles } from "../src/core/control-files.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-done-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);

  vi.clearAllMocks();
  vi.mocked(hashControlFiles).mockReturnValue("stablehash123456");
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
    type: "Chore", // non-code to skip PR verification
    status: "Verify",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body =
    (bodyOverride as string | undefined) ??
    `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [x] Do something\n\n## Agent Notes\n`;
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
  });

  it("rejects done for invalid transitions", async () => {
    makeTaskFile("TASK-005", { status: "In Progress" });
    await expect(cmdDone("TASK-005")).rejects.toThrow(
      /cannot transition/i,
    );
  });

  // TF-SIMP-04: done's worktree/branch cleanup flags removed; lifecycle is direct-git.
  // The worktree/branch deletion test cases were deleted with the flags.

  it("throws for non-existent task", async () => {
    await expect(cmdDone("TASK-999")).rejects.toThrow(/not found/i);
  });

  it("throws for invalid transition", async () => {
    makeTaskFile("TASK-005", { status: "In Progress" });
    await expect(cmdDone("TASK-005")).rejects.toThrow(
      /cannot transition/i,
    );
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
    expect(output.error).toContain("Replace blank checkboxes");
  });

  it("rejects done when Acceptance Criteria items are unchecked", async () => {
    const body = `# TASK-005: Test task\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [ ] Do something\n- [x] Verify something\n\n## Agent Notes\n`;
    makeTaskFile("TASK-005", { body });
    await expect(cmdDone("TASK-005")).rejects.toThrow(
      /one or more acceptance criteria remain unchecked/i,
    );
  });

  it("rejects done with JSON error when AC items are unchecked", async () => {
    const body = `# TASK-005: Test task\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [ ] Do something\n\n## Agent Notes\n`;
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
    expect(output.code).toBe("UNCHECKED_ACCEPTANCE_CRITERIA");
    expect(output.error).toContain("Check off each criterion");
  });

  it("rejects done when worktree has uncommitted files", async () => {
    vi.mocked(getWorktreeDirtyFiles).mockResolvedValue(["src/foo.ts", "tests/foo.test.ts"]);

    makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-test",
    });
    await expect(cmdDone("TASK-005")).rejects.toThrow(/uncommitted file/);
  });

  it("rejects done with JSON error when worktree is dirty", async () => {
    vi.mocked(getWorktreeDirtyFiles).mockResolvedValue(["src/foo.ts"]);

    makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-test",
    });

    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await cmdDone("TASK-005", { json: true });
    consoleSpy.mockRestore();

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(false);
    expect(output.code).toBe("WORKTREE_DIRTY");
    expect(output.error).toContain("uncommitted");
    expect(output.error).toContain("git add -A && git commit");
  });

  it("allows done when gates are the only source of dirtiness", async () => {
    vi.mocked(getWorktreeDirtyFiles)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["dist/cli.js", "dist/cli.js.map"]);

    makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-test",
    });

    await expect(cmdDone("TASK-005")).resolves.toBeUndefined();
  });

  it("still rejects done when pre-existing dirt remains after gates", async () => {
    vi.mocked(getWorktreeDirtyFiles)
      .mockResolvedValueOnce(["src/foo.ts"])
      .mockResolvedValueOnce(["dist/cli.js", "src/foo.ts"]);

    makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-test",
    });

    await expect(cmdDone("TASK-005")).rejects.toThrow(/src\/foo\.ts/);
  });

  it("rejects done when branch has unpushed commits", async () => {
    vi.mocked(getWorktreeDirtyFiles).mockResolvedValue([]);
    vi.mocked(getBranchCommitsAhead).mockResolvedValue(3);

    makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-test",
    });
    await expect(cmdDone("TASK-005")).rejects.toThrow(/unpushed commit/);
  });

  it("rejects done with JSON error when branch is unpushed", async () => {
    vi.mocked(getWorktreeDirtyFiles).mockResolvedValue([]);
    vi.mocked(getBranchCommitsAhead).mockResolvedValue(2);

    makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-test",
    });

    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await cmdDone("TASK-005", { json: true });
    consoleSpy.mockRestore();

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(false);
    expect(output.code).toBe("BRANCH_UNPUSHED");
    expect(output.error).toContain("unpushed");
    expect(output.error).toContain("git push -u origin <branch>");
  });

  it("returns actionable control-file drift guidance without asking for a recommit", async () => {
    makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-test",
      context_hash: "originalhash0000",
    });
    vi.mocked(getBranchCommitsAhead).mockResolvedValue(0);
    vi.mocked(hashControlFiles).mockReturnValue("drifthash999999");

    await expect(cmdDone("TASK-005")).rejects.toThrow(/Control files changed since TASK-005 started/);
    await expect(cmdDone("TASK-005")).rejects.toThrow(/No recommit or resubmit is required/i);
  });

  it("returns JSON error with explicit recovery steps for control-file drift", async () => {
    makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-test",
      context_hash: "originalhash0000",
    });
    vi.mocked(getBranchCommitsAhead).mockResolvedValue(0);
    vi.mocked(hashControlFiles).mockReturnValue("drifthash999999");

    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await cmdDone("TASK-005", { json: true });
    consoleSpy.mockRestore();

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(false);
    expect(output.code).toBe("CONTROL_FILE_CHANGED");
    expect(output.error).toContain("Recorded hash: originalhash0000. Current hash: drifthash999999.");
    expect(output.error).toContain("No recommit or resubmit is required");
    expect(output.recovery.required).toBe(true);
    expect(output.validNextCommands[0].command).toContain("taskforge inspect TASK-005 --json");
    expect(output.validNextCommands[1].command).toContain("taskforge done TASK-005");
  });

  it("allows done when worktree is clean and branch is pushed", async () => {
    vi.mocked(getWorktreeDirtyFiles).mockResolvedValue([]);
    vi.mocked(getBranchCommitsAhead).mockResolvedValue(0);

    const fp = makeTaskFile("TASK-005", {
      worktree: "../worktrees/TASK-005",
      branch: "agent/TASK-005-test",
    });
    await expect(cmdDone("TASK-005")).resolves.not.toThrow();

    const task = readTaskFile(fp);
    expect(task.frontmatter.status).toBe("Done");
  });

  it("archives terminal audit summary into agent notes", async () => {
    const fp = makeTaskFile("TASK-005");
    const repoRoot = path.join(uniqueDir, "repo");

    appendTaskTranscript(repoRoot, "TASK-005", createTaskEvent("TASK-005", "task.command.started", {
      summary: "Started work",
    }));
    recordCliInvocation(repoRoot, "checkpoint", ["TASK-005"], { message: "test" }, 0, 125, null);

    await cmdDone("TASK-005");

    const task = readTaskFile(fp);
    expect(task.body).toContain("Terminal audit archived for Done.");
    expect(task.body).toContain("Audit events:");
    expect(task.body).toContain("Commands observed: checkpoint.");
  });

});
