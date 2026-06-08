import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdUpdateTask } from "../src/commands/update-task.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("../src/core/git.js", () => ({
  pullTaskState: vi.fn(),
  jitteredPush: vi.fn(),
  ensureTaskStateBranch: vi.fn(),
}));

let _stateDirForMock = "";

vi.mock("../src/core/task-state-transaction.js", () => ({
  withTaskStateTransaction: vi.fn().mockImplementation((_opts, mutate) => {
    const tx = {
      loadTask: vi.fn((id: string) => {
        const fp = path.join(_stateDirForMock, `${id}.md`);
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
          body: rest.join("---").trim(),
          filePath: fp,
        };
      }),
      updateTask: vi.fn((task: { id: string; priority?: string; type?: string; body: string; filePath: string }) => {
        // Persist to disk so test assertions can read it back
        const lines = [];
        // Read existing content to preserve frontmatter order
        const existing = fs.existsSync(task.filePath) ? fs.readFileSync(task.filePath, "utf-8") : "";
        const [existingFm] = existing.split("---").filter(Boolean);
        const frontmatterLines: string[] = [];
        const usedKeys = new Set<string>();
        for (const line of existingFm.trim().split("\n")) {
          const idx = line.indexOf(":");
          if (idx > 0) {
            const key = line.slice(0, idx).trim();
            usedKeys.add(key);
            // Override with new values from task
            const taskKey = key as keyof typeof task;
            if (task[taskKey] !== undefined && key !== "body" && key !== "id" && key !== "filePath") {
              frontmatterLines.push(`${key}: ${task[taskKey]}`);
            } else {
              frontmatterLines.push(line);
            }
          }
        }
        lines.push("---");
        lines.push(...frontmatterLines);
        lines.push("---");
        lines.push("");
        lines.push(task.body);
        fs.writeFileSync(task.filePath, lines.join("\n"), "utf-8");
      }),
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

let uniqueDir: string;
let stateDir: string;

function makeTaskFile(
  id: string,
  overrides: Record<string, unknown> = {},
): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Chore",
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

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-update-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  _stateDirForMock = stateDir;
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

// Need to mock loadTaskById — it uses the state directory
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
      const statusMap: Record<string, string> = {
        Verify: "Verify",
        Done: "Done",
        "In Progress": "In Progress",
      };
      for (const line of rawFm.trim().split("\n")) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
      return {
        id: frontmatter.id ?? id,
        type: frontmatter.type,
        status: statusMap[frontmatter.status as string] ?? frontmatter.status,
        priority: frontmatter.priority,
        body: rest.join("---").trim(),
        filePath: fp,
      };
    }),
  };
});

describe("cmdUpdateTask", () => {
  it("updates priority via --field --value", async () => {
    const fp = makeTaskFile("TASK-001", { priority: "P2" });
    await cmdUpdateTask("TASK-001", { field: "priority", value: "P0" });
    const task = readTaskFile(fp);
    expect(task.frontmatter.priority).toBe("P0");
  });

  it("rejects invalid priority", async () => {
    makeTaskFile("TASK-001");
    await expect(
      cmdUpdateTask("TASK-001", { field: "priority", value: "P5" }),
    ).rejects.toThrow(/Invalid priority/);
  });

  it("rejects invalid type", async () => {
    makeTaskFile("TASK-001");
    await expect(
      cmdUpdateTask("TASK-001", { field: "type", value: "InvalidType" }),
    ).rejects.toThrow(/Invalid type/);
  });

  it("rejects unknown field", async () => {
    makeTaskFile("TASK-001");
    await expect(
      cmdUpdateTask("TASK-001", { field: "nonexistent", value: "foo" }),
    ).rejects.toThrow(/Unknown field/);
  });

  it("rejects read-only field", async () => {
    makeTaskFile("TASK-001");
    await expect(
      cmdUpdateTask("TASK-001", { field: "id", value: "TASK-999" }),
    ).rejects.toThrow(/read-only/);
  });

  it("replaces body via --body", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdUpdateTask("TASK-001", { body: "## New Body\n\nContent here" });
    const task = readTaskFile(fp);
    expect(task.body).toContain("New Body");
    expect(task.body).not.toContain("Test task");
  });

  it("appends to body via --append-body", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdUpdateTask("TASK-001", { appendBody: "## Additional\n\nExtra" });
    const task = readTaskFile(fp);
    expect(task.body).toContain("Test task");
    expect(task.body).toContain("Additional");
    expect(task.body).toContain("Extra");
  });

  it("throws when no options provided", async () => {
    makeTaskFile("TASK-001");
    await expect(
      cmdUpdateTask("TASK-001", {}),
    ).rejects.toThrow(/No updates specified/);
  });

  it("throws for non-existent task", async () => {
    await expect(
      cmdUpdateTask("TASK-999", { field: "priority", value: "P0" }),
    ).rejects.toThrow(/not found/i);
  });

  it("outputs JSON with --json flag on success", async () => {
    makeTaskFile("TASK-001", { priority: "P2" });
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await cmdUpdateTask("TASK-001", { field: "priority", value: "P0", json: true });
    spy.mockRestore();
    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.taskId).toBe("TASK-001");
    expect(output.updated).toHaveLength(1);
    expect(output.updated[0].name).toBe("priority");
  });

  it("outputs JSON error on invalid field", async () => {
    makeTaskFile("TASK-001");
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    await cmdUpdateTask("TASK-001", { field: "priority", value: "P5", json: true });
    spy.mockRestore();
    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(false);
    expect(output.code).toBe("INVALID_FIELD_VALUE");
  });

  it("is idempotent — same update twice succeeds", async () => {
    const fp = makeTaskFile("TASK-001", { priority: "P2" });
    await cmdUpdateTask("TASK-001", { field: "priority", value: "P2" });
    const task = readTaskFile(fp);
    expect(task.frontmatter.priority).toBe("P2");
  });
});
