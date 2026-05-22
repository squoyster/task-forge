import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdInspect } from "../src/commands/inspect.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";

let uniqueDir: string;
let stateDir: string;
let worktreesDir: string;

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
  const body = (bodyOverride as string | undefined) ?? `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => {
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

function mockGitSuccess(worktreePath: string, opts?: { dirty?: boolean; ahead?: number; behind?: number; commit?: string }) {
  const dirty = opts?.dirty ?? false;
  const ahead = opts?.ahead ?? 0;
  const behind = opts?.behind ?? 0;
  const commit = opts?.commit ?? "abc123def0";

  vi.mocked(execa).mockImplementation((cmd: string, args?: readonly string[], execaOpts?: { cwd?: string }) => {
    const cwd = execaOpts?.cwd ?? "";
    if (cwd !== worktreePath) {
      return Promise.reject(new Error("wrong cwd"));
    }
    const joined = `${cmd} ${(args ?? []).join(" ")}`;

    if (joined === "git branch --list") {
      return Promise.resolve({ stdout: "* agent/TASK-003-test\n  main\n", stderr: "" } as never);
    }
    if (joined === "git status --porcelain") {
      return Promise.resolve({ stdout: dirty ? " M src/file.ts\n" : "", stderr: "" } as never);
    }
    if (joined.startsWith("git rev-list --count HEAD..origin/main")) {
      return Promise.resolve({ stdout: String(ahead), stderr: "" } as never);
    }
    if (joined.startsWith("git rev-list --count origin/main..HEAD")) {
      return Promise.resolve({ stdout: String(behind), stderr: "" } as never);
    }
    if (joined === "git rev-parse HEAD") {
      return Promise.resolve({ stdout: commit, stderr: "" } as never);
    }
    return Promise.reject(new Error(`unexpected command: ${joined}`));
  });
}

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-inspect-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  worktreesDir = path.resolve(repoDir, "..", "worktrees", "repo");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(worktreesDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdInspect", () => {
  it("detects missing worktree", async () => {
    makeTaskFile("TASK-003", {
      status: "In Progress",
      branch: "agent/TASK-003-test",
    });

    const result = await cmdInspect("TASK-003");
    expect(result).not.toBeNull();
    expect(result!.worktreeExists).toBe(false);
    expect(result!.branchExists).toBe(false);
    expect(result!.dirty).toBe(false);
  });

  it("detects existing and clean worktree", async () => {
    makeTaskFile("TASK-003", {
      status: "In Progress",
      branch: "agent/TASK-003-test",
    });

    const wtPath = path.join(worktreesDir, "TASK-003");
    fs.mkdirSync(wtPath, { recursive: true });
    mockGitSuccess(wtPath);

    const result = await cmdInspect("TASK-003");
    expect(result).not.toBeNull();
    expect(result!.worktreeExists).toBe(true);
    expect(result!.branchExists).toBe(true);
    expect(result!.dirty).toBe(false);
    expect(result!.aheadOfMain).toBe(0);
    expect(result!.behindMain).toBe(0);
    expect(result!.lastCommit).toBe("abc123def0");
  });

  it("detects dirty worktree", async () => {
    makeTaskFile("TASK-003", {
      status: "In Progress",
      branch: "agent/TASK-003-test",
    });

    const wtPath = path.join(worktreesDir, "TASK-003");
    fs.mkdirSync(wtPath, { recursive: true });
    mockGitSuccess(wtPath, { dirty: true });

    const result = await cmdInspect("TASK-003");
    expect(result).not.toBeNull();
    expect(result!.worktreeExists).toBe(true);
    expect(result!.dirty).toBe(true);
  });

  it("reports ahead/behind counts", async () => {
    makeTaskFile("TASK-003", {
      status: "In Progress",
      branch: "agent/TASK-003-test",
    });

    const wtPath = path.join(worktreesDir, "TASK-003");
    fs.mkdirSync(wtPath, { recursive: true });
    mockGitSuccess(wtPath, { ahead: 3, behind: 1 });

    const result = await cmdInspect("TASK-003");
    expect(result).not.toBeNull();
    expect(result!.aheadOfMain).toBe(3);
    expect(result!.behindMain).toBe(1);
  });

  it("reports stale claim when claimed_at > 4h", async () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const formatted = fiveHoursAgo.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

    makeTaskFile("TASK-003", {
      status: "In Progress",
      claimed_at: formatted,
      branch: "agent/TASK-003-test",
    });

    const result = await cmdInspect("TASK-003");
    expect(result).not.toBeNull();
    expect(result!.claimStale).toBe(true);
    expect(result!.claimAgeHours).toBeGreaterThan(4);
  });

  it("reports fresh claim when claimed_at < 4h", async () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const formatted = oneHourAgo.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

    makeTaskFile("TASK-003", {
      status: "In Progress",
      claimed_at: formatted,
    });

    const result = await cmdInspect("TASK-003");
    expect(result).not.toBeNull();
    expect(result!.claimStale).toBe(false);
    expect(result!.claimAgeHours).toBeGreaterThan(0);
    expect(result!.claimAgeHours).toBeLessThan(2);
  });

  it("supports --json output", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    makeTaskFile("TASK-003", { status: "In Progress" });

    await cmdInspect("TASK-003", { json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.taskId).toBe("TASK-003");
    expect(output).toHaveProperty("worktreeExists");
    expect(output).toHaveProperty("branchExists");
    expect(output).toHaveProperty("dirty");
    expect(output).toHaveProperty("claimStale");

    logSpy.mockRestore();
  });

  it("throws for non-existent task", async () => {
    await expect(cmdInspect("TASK-999")).rejects.toThrow(/not found/i);
  });

  it("supports --all to inspect all In Progress tasks", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    makeTaskFile("TASK-001", { status: "In Progress" });
    makeTaskFile("TASK-002", { status: "Ready" });
    makeTaskFile("TASK-003", { status: "In Progress" });

    await cmdInspect("TASK-000", { all: true, json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.tasks).toHaveLength(2);
    expect(output.tasks.map((t: { taskId: string }) => t.taskId).sort()).toEqual(["TASK-001", "TASK-003"]);

    logSpy.mockRestore();
  });

  it("handles --all with no In Progress tasks", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    makeTaskFile("TASK-001", { status: "Ready" });

    await cmdInspect("TASK-000", { all: true, json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.tasks).toHaveLength(0);

    logSpy.mockRestore();
  });
});
