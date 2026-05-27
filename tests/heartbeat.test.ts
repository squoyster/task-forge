import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdHeartbeat } from "../src/commands/heartbeat.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("../src/core/git.js", () => ({
  getCurrentBranch: vi.fn().mockResolvedValue("agent/TASK-001-test--abc123def0"),
  commitAndPushTaskState: vi.fn(),
  pullTaskState: vi.fn().mockResolvedValue(undefined),
}));

let uniqueDir: string;
let stateDir: string;
let savedEnv: NodeJS.ProcessEnv;

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

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-heartbeat-test-"));
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

describe("cmdHeartbeat", () => {
  it("renews the lease by updating claimed_at", async () => {
    const fp = makeTaskFile("TASK-001");

    await cmdHeartbeat("TASK-001", { force: true });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("claimed_at:");
    expect(content).toContain("Heartbeat: lease renewed");
  });

  it("refuses to heartbeat a task not In Progress", async () => {
    makeTaskFile("TASK-001", { status: "Ready" });

    await expect(cmdHeartbeat("TASK-001", { force: true })).resolves.not.toThrow();

    const content = fs.readFileSync(path.join(stateDir, "TASK-001.md"), "utf-8");
    expect(content).not.toContain("Heartbeat");
  });

  it("requires ownership unless --force", async () => {
    // Task with different assignee — should fail without force
    makeTaskFile("TASK-001", { assignee: "different123" });

    await expect(cmdHeartbeat("TASK-001")).rejects.toThrow(/assigned to session/i);
  });

  it("accepts --force without ownership match", async () => {
    const fp = makeTaskFile("TASK-001", { assignee: "different123" });

    await cmdHeartbeat("TASK-001", { force: true });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Heartbeat: lease renewed (authorized: human)");
  });

  it("supports --json output", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    makeTaskFile("TASK-001");

    await cmdHeartbeat("TASK-001", { force: true, json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.task.id).toBe("TASK-001");
    expect(output.task.status).toBe("in_progress");

    logSpy.mockRestore();
  });

  it("throws for non-existent task", async () => {
    await expect(cmdHeartbeat("TASK-999")).rejects.toThrow(/not found/i);
  });

  it("appends agent note with heartbeat event", async () => {
    const fp = makeTaskFile("TASK-001", { claimed_at: "2026-05-20 12:00:00" });

    await cmdHeartbeat("TASK-001", { force: true });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Heartbeat: lease renewed");
    expect(content).toContain("reset from 2026-05-20 12:00:00");
  });
});
