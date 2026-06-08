import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdSubmit } from "../src/commands/git-facade.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("execa", () => ({
  execa: vi.fn().mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
}));

vi.mock("../src/core/git.js", () => ({
  pullTaskState: vi.fn(),
  jitteredPush: vi.fn(),
  ensureTaskStateBranch: vi.fn(),
}));

vi.mock("../src/core/task-state-transaction.js", () => ({
  withTaskStateTransaction: vi.fn().mockImplementation((_opts, mutate) => {
    const tx = {
      loadTask: vi.fn(),
      updateTask: vi.fn(),
      appendNote: vi.fn(),
      appendEvent: vi.fn(),
      claimTask: vi.fn(),
      clearClaim: vi.fn(),
      assertCanTransition: vi.fn(),
      loadAllTasks: vi.fn(),
    };
    return Promise.resolve(mutate(tx));
  }),
}));

import { execa } from "execa";

let uniqueDir: string;
let stateDir: string;

function makeTaskFile(
  id: string,
  overrides: Record<string, unknown> = {},
): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Feature",
    status: "In Progress",
    priority: "P2",
    branch: "agent/TASK-001-feature--abc123",
    worktree: "../worktrees/TASK-001",
    assignee: "test-session",
    claimed_at: new Date().toISOString(),
    ...frontmatterOverrides,
  };
  const body =
    (bodyOverride as string | undefined) ??
    `# TASK-001: Test task\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [x] Do something\n\n## Agent Notes\n`;
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

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-submit-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(path.join(uniqueDir, "worktrees", "TASK-001"), { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

// Mock loadTaskById to read from the test state directory
vi.mock("../src/core/task-store.js", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    loadTaskById: vi.fn((id: string) => {
      const fp = path.join(stateDir, `${id}.md`);
      if (!fs.existsSync(fp)) return null;
      const content = fs.readFileSync(fp, "utf-8");
      const [rawFm, ...rest] = content.split("---").filter(Boolean);
      const frontmatter: Record<string, unknown> = {};
      for (const line of rawFm.trim().split("\n")) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
      return {
        id: frontmatter.id ?? id,
        type: frontmatter.type,
        status: frontmatter.status,
        priority: frontmatter.priority,
        branch: frontmatter.branch,
        worktree: frontmatter.worktree,
        assignee: frontmatter.assignee,
        claimed_at: frontmatter.claimed_at,
        body: rest.join("---").trim(),
        filePath: fp,
      };
    }),
  };
});

// Mock session ownership check
vi.mock("../src/core/session.js", () => ({
  assertTaskOwnership: vi.fn(),
  generateSessionId: vi.fn().mockReturnValue("test-session"),
}));

// Mock config
vi.mock("../src/core/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({
    project: { defaultBranch: "main" },
    github: { enabled: false },
  }),
}));

describe("cmdSubmit", () => {
  it("throws for non-existent task", async () => {
    await expect(cmdSubmit("TASK-999")).rejects.toThrow(/not found/i);
  });

  it("throws for task without branch", async () => {
    makeTaskFile("TASK-001", { branch: undefined });
    await expect(cmdSubmit("TASK-001")).rejects.toThrow(/no branch/i);
  });

  it("throws for task without worktree", async () => {
    makeTaskFile("TASK-001", { worktree: undefined });
    await expect(cmdSubmit("TASK-001")).rejects.toThrow(/no worktree/i);
  });

  it("rejects main branch", async () => {
    makeTaskFile("TASK-001", { branch: "main" });
    await expect(cmdSubmit("TASK-001")).rejects.toThrow(/refusing/i);
  });

  it("pushes branch via git", async () => {
    makeTaskFile("TASK-001");
    vi.mocked(execa).mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 } as any);
    await expect(cmdSubmit("TASK-001")).resolves.not.toThrow();
    expect(vi.mocked(execa)).toHaveBeenCalledWith(
      expect.stringContaining("git"),
      expect.arrayContaining(["push", "origin", expect.any(String)]),
      expect.any(Object),
    );
  });

  it("auto-checkpoints before push when changes exist", async () => {
    makeTaskFile("TASK-001");
    // Mock status to show uncommitted changes
    vi.mocked(execa)
      .mockResolvedValueOnce({ stdout: "M src/foo.ts", stderr: "", exitCode: 0 }) // status --porcelain
      .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });

    await expect(cmdSubmit("TASK-001")).resolves.not.toThrow();
    // Should have called add and commit before push
    expect(vi.mocked(execa)).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["add", "."]),
      expect.any(Object),
    );
    expect(vi.mocked(execa)).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["commit", "-m", expect.stringContaining("checkpoint")]),
      expect.any(Object),
    );
  });

  it("outputs JSON on success with --json flag", async () => {
    makeTaskFile("TASK-001");
    vi.mocked(execa).mockResolvedValue({ stdout: "abc123def456", stderr: "", exitCode: 0 } as any);

    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await cmdSubmit("TASK-001", { json: true });
    spy.mockRestore();

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.message).toContain("TASK-001");
  });

  it("transitions task status to Submitted", async () => {
    const fp = makeTaskFile("TASK-001", { status: "In Progress" });
    vi.mocked(execa).mockResolvedValue({ stdout: "abc123def456", stderr: "", exitCode: 0 } as any);

    // Mock the transaction's loadTask and updateTask to actually write
    const { withTaskStateTransaction } = await import("../src/core/task-state-transaction.js");
    vi.mocked(withTaskStateTransaction).mockImplementation(async (_opts: any, mutate: any) => {
      const task = {
        id: "TASK-001",
        status: "In Progress",
        submitted_sha: undefined,
        submitted_at: undefined,
        pr: undefined,
        branch: "agent/TASK-001-feature--abc123",
        body: "body",
        filePath: fp,
      };
      await mutate({
        loadTask: vi.fn().mockReturnValue(task),
        updateTask: vi.fn((t: any) => {
          // Write to file
          const content = fs.readFileSync(fp, "utf-8");
          const updated = content.replace(/^status: .+$/m, `status: ${t.status}`);
          fs.writeFileSync(fp, updated, "utf-8");
        }),
        appendNote: vi.fn(),
        appendEvent: vi.fn(),
      });
    });

    await cmdSubmit("TASK-001");
    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Submitted");
  });
});
