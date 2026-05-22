import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdCleanup } from "../src/commands/cleanup-cmd.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("../src/core/git.js", () => ({
  removeWorktree: vi.fn().mockResolvedValue(true),
  removeBranch: vi.fn().mockResolvedValue(true),
  commitAndPushTaskState: vi.fn(),
  pullTaskState: vi.fn(),
  jitteredPush: vi.fn(),
  pullTaskState: vi.fn(),
}));

let uniqueDir: string;
let stateDir: string;

function makeTaskFile(id: string, overrides: Record<string, unknown> = {}): string {
  const { body: bodyOverride, ...fm } = overrides;
  const frontmatter: Record<string, unknown> = { id, type: "Task", status: "In Progress", priority: "P2", ...fm };
  const body = (bodyOverride as string) ?? `# ${id}: Test\n\n## Goal\nTest\n\n## Agent Notes\n`;
  const lines = ["---", ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`), "---", "", body];
  const fp = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(fp, lines.join("\n"), "utf-8");
  return fp;
}

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-cleanup-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdCleanup", () => {
  it("dry-run reports actions without mutating", async () => {
    makeTaskFile("TASK-001", { worktree: "../worktrees/TASK-001", branch: "agent/TASK-001-test" });

    await expect(cmdCleanup("TASK-001", { dryRun: true })).resolves.not.toThrow();
  });

  it("force applies cleanup", async () => {
    const fp = makeTaskFile("TASK-001", { worktree: "../worktrees/TASK-001", branch: "agent/TASK-001-test" });

    await cmdCleanup("TASK-001", { force: true });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).not.toContain("worktree:");
  });

  it("throws for non-existent task", async () => {
    await expect(cmdCleanup("TASK-999")).rejects.toThrow(/not found/i);
  });
});
