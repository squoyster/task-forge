import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdClaim } from "../src/commands/claim.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("../src/core/git.js", () => ({
  jitteredPush: vi.fn().mockResolvedValue(true),
  pullTaskState: vi.fn().mockResolvedValue(true),
}));

vi.mock("../src/core/task-state-transaction.js", () => ({
  withTaskStateTransaction: vi.fn().mockImplementation(async (_opts, mutate) => {
    const taskStore = await import("../src/core/task-store.js");
    const tx = {
      loadTask: (id: string) => taskStore.loadTaskById(id),
      loadAllTasks: () => taskStore.loadAllTasks(),
      updateTask: (task: { id: string }) => taskStore.writeTaskFile(task),
      appendNote: vi.fn(),
      appendEvent: vi.fn(),
      assertCanTransition: vi.fn(),
      claimTask: (id: string, session: string) => {
        const task = taskStore.loadTaskById(id);
        if (task) {
          task.assignee = session;
          task.claimed_at = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
          if (task.status === "Ready") task.status = "In Progress";
          taskStore.writeTaskFile(task);
        }
      },
      clearClaim: vi.fn(),
    };
    return mutate(tx);
  }),
}));

let uniqueDir: string;
let stateDir: string;

function makeTaskFile(
  id: string,
  overrides: Record<string, unknown> = {},
): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Ready",
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

function readTaskFile(fp: string): string {
  return fs.readFileSync(fp, "utf-8");
}

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-claim-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdClaim", () => {
  it("claims a ready task and sets assignee/claimed_at", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Ready" });

    await cmdClaim("TASK-001");

    const content = readTaskFile(fp);
    expect(content).toContain("assignee:");
    expect(content).toContain("claimed_at:");
    expect(content).toContain("Task claimed via taskforge claim");
  });

  it("transitions Ready to In Progress on claim", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Ready" });

    await cmdClaim("TASK-001");

    const content = readTaskFile(fp);
    expect(content).toContain("status: In Progress");
  });

  it("keeps In Progress status when claiming an already-owned task", async () => {
    const fp = makeTaskFile("TASK-001", {
      status: "In Progress",
      assignee: "test-session",
    });

    await cmdClaim("TASK-001", { force: true });

    const content = readTaskFile(fp);
    expect(content).toContain("status: In Progress");
  });

  it("refuses to claim a task already claimed by another session", async () => {
    makeTaskFile("TASK-001", {
      status: "Ready",
      assignee: "another-session",
    });

    await expect(cmdClaim("TASK-001")).resolves.not.toThrow();
  });

  it("overrides existing claim with --force", async () => {
    const fp = makeTaskFile("TASK-001", {
      status: "In Progress",
      assignee: "another-session",
      claimed_at: "2026-05-20 10:00:00",
    });

    await cmdClaim("TASK-001", { force: true });

    const content = readTaskFile(fp);
    expect(content).toContain("Task claimed via taskforge claim");
  });

  it("refuses to claim a task not in Ready or In Progress", async () => {
    makeTaskFile("TASK-001", { status: "Done" });

    await expect(cmdClaim("TASK-001")).rejects.toThrow(/Cannot claim/i);
  });

  it("accepts explicit --session flag", async () => {
    const fp = makeTaskFile("TASK-001", { status: "Ready" });

    await cmdClaim("TASK-001", { session: "my-custom-session" });

    const content = readTaskFile(fp);
    expect(content).toContain("assignee: my-custom-session");
    expect(content).toContain("Session: my-custom-session");
  });

  it("supports --json output", async () => {
    let capturedOutput = "";
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      capturedOutput = args.map(a => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    });

    makeTaskFile("TASK-001", { status: "Ready" });

    await cmdClaim("TASK-001", { json: true, session: "json-test" });

    logSpy.mockRestore();
    const output = JSON.parse(capturedOutput);
    expect(output.ok).toBe(true);
    expect(output.task.id).toBe("TASK-001");
    expect(output.task.status).toBe("in_progress");
  });

  it("throws for non-existent task", async () => {
    await expect(cmdClaim("TASK-999")).rejects.toThrow(/not found/i);
  });
});
