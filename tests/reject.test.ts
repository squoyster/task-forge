import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdReject } from "../src/commands/reject.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("../src/core/git.js", () => ({
  commitAndPushTaskState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/core/session-state.js", () => ({
  removeSessionState: vi.fn(),
}));

vi.mock("../src/core/agent-registry.js", () => ({
  markAgentIdle: vi.fn(),
}));

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-reject-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTaskFile(id: string, overrides: Record<string, unknown> = {}): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Inbox",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body = (bodyOverride as string | undefined) ?? `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
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

describe("cmdReject", () => {
  it("marks a task Rejected and clears ownership metadata", async () => {
    const fp = makeTaskFile("TASK-001", {
      assignee: "session-123",
      claimed_at: "2026-06-11 02:00:00",
      worktree: "/tmp/worktree/TASK-001",
      branch: "agent/TASK-001",
    });

    await cmdReject("TASK-001", "obsolete");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Rejected");
    expect(content).not.toContain("assignee:");
    expect(content).not.toContain("claimed_at:");
    expect(content).toContain("worktree: /tmp/worktree/TASK-001");
    expect(content).toContain("branch: agent/TASK-001");
  });

  it("returns JSON error for missing task", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await cmdReject("TASK-999", "obsolete", { json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.code).toBe("TASK_NOT_FOUND");

    logSpy.mockRestore();
  });
});
