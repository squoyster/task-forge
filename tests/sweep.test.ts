import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdSweep } from "../src/commands/sweep.js";
import { setRepoRoot } from "../src/util/paths.js";

// Mock the git module so we don't need real git operations
vi.mock("../src/core/git.js", () => ({
  jitteredPush: vi.fn(),
  pullTaskState: vi.fn(),
  ensureTaskStateBranch: vi.fn(),
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

let uniqueDir: string;
let stateDir: string;
let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-sweep-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  savedEnv = { ...process.env };
  process.env.TASKFORGE_ACTOR = "human";

  vi.clearAllMocks();
});

afterEach(() => {
  process.env = savedEnv;
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
    status: "In Progress",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body =
    (bodyOverride as string | undefined) ??
    `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => {
      // Quote string values that look like dates or contain special chars
      if (typeof v === "string" && /[\s:]/.test(v)) {
        return `${k}: "${v}"`;
      }
      return `${k}: ${v}`;
    }),
    "---",
    "",
    body,
  ];
  const filePath = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

// Helper: create a claimed_at string that is N hours ago
function hoursAgo(n: number): string {
  const d = new Date(Date.now() - n * 60 * 60 * 1000);
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

describe("cmdSweep", () => {
  it("is a no-op when no stale tasks exist", async () => {
    // A recent claim (< 4h)
    makeTaskFile("TASK-001", { assignee: "abc123def0", claimed_at: hoursAgo(1) });
    await expect(cmdSweep()).resolves.not.toThrow();
    // Task should still be In Progress with claim intact
    const content = fs.readFileSync(path.join(stateDir, "TASK-001.md"), "utf-8");
    expect(content).toContain('status: "In Progress"');
    expect(content).toContain("abc123def0");
  });

  it("recovers a stale task (claimed > 4h)", async () => {
    const fp = makeTaskFile("TASK-001", {
      assignee: "abc123def0",
      claimed_at: hoursAgo(5),
    });

    await expect(cmdSweep()).resolves.not.toThrow();

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Ready");
    expect(content).not.toContain("assignee");
    expect(content).not.toContain("claimed_at");
  });

  it("recovers multiple stale tasks", async () => {
    makeTaskFile("TASK-001", { assignee: "sess-a", claimed_at: hoursAgo(5) });
    makeTaskFile("TASK-002", { assignee: "sess-b", claimed_at: hoursAgo(6) });
    makeTaskFile("TASK-003", { assignee: "sess-c", claimed_at: hoursAgo(1) }); // not stale

    await expect(cmdSweep()).resolves.not.toThrow();

    const t1 = fs.readFileSync(path.join(stateDir, "TASK-001.md"), "utf-8");
    expect(t1).toContain("status: Ready");
    expect(t1).not.toContain("assignee");

    const t2 = fs.readFileSync(path.join(stateDir, "TASK-002.md"), "utf-8");
    expect(t2).toContain("status: Ready");
    expect(t2).not.toContain("assignee");

    // TASK-003 should remain untouched
    const t3 = fs.readFileSync(path.join(stateDir, "TASK-003.md"), "utf-8");
    expect(t3).toContain('status: "In Progress"');
    expect(t3).toContain("sess-c");
  });

  it("ignores tasks that are not In Progress", async () => {
    makeTaskFile("TASK-001", {
      status: "Ready",
      assignee: "abc123def0",
      claimed_at: hoursAgo(10),
    });
    await expect(cmdSweep()).resolves.not.toThrow();
    const content = fs.readFileSync(path.join(stateDir, "TASK-001.md"), "utf-8");
    expect(content).toContain("status: Ready");
    // Still has assignee because it was never In Progress
    expect(content).toContain("abc123def0");
  });

  it("ignores tasks with missing claim fields", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" }); // no assignee or claimed_at
    await expect(cmdSweep()).resolves.not.toThrow();
    const content = fs.readFileSync(path.join(stateDir, "TASK-001.md"), "utf-8");
    expect(content).toContain('status: "In Progress"');
    // Still has no assignee/claimed_at fields
    expect(content).not.toContain("assignee");
    expect(content).not.toContain("claimed_at");
  });

  it("commits and pushes state changes through transaction layer", async () => {
    const { withTaskStateTransaction } = await import("../src/core/task-state-transaction.js");

    makeTaskFile("TASK-001", {
      assignee: "abc123def0",
      claimed_at: hoursAgo(5),
    });

    await cmdSweep();

    expect(withTaskStateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.stringMatching(/sweep/i) }),
      expect.any(Function),
    );
  });

  it("throws for non-existent task-state directory", async () => {
    // Remove the state dir
    fs.rmSync(stateDir, { recursive: true, force: true });
    // Should not throw — sweep should handle gracefully (no tasks to sweep)
    await expect(cmdSweep()).resolves.not.toThrow();
  });

  it("dry-run does not mutate stale tasks", async () => {
    const fp = makeTaskFile("TASK-001", {
      assignee: "abc123def0",
      claimed_at: hoursAgo(5),
    });

    await cmdSweep({ dryRun: true });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain('status: "In Progress"');
    expect(content).toContain("abc123def0");
  });

  it("force skips inspection and resets all stale", async () => {
    const fp = makeTaskFile("TASK-001", {
      assignee: "abc123def0",
      claimed_at: hoursAgo(5),
    });

    await cmdSweep({ force: true });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Ready");
    expect(content).not.toContain("assignee");
  });
});
