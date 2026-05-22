import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdReport } from "../src/commands/report.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

vi.mock("../src/core/git.js", () => ({
  commitAndPushTaskState: vi.fn(),
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
    type: "Task",
    status: "In Progress",
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

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-report-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdReport", () => {
  it("generates a report without changing status", async () => {
    vi.mocked(execa).mockRejectedValue(new Error("no worktree"));

    const fp = makeTaskFile("TASK-001", { status: "In Progress" });

    await expect(cmdReport("TASK-001")).resolves.not.toThrow();

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: In Progress");
  });

  it("transitions to Review with --complete", async () => {
    vi.mocked(execa).mockRejectedValue(new Error("no worktree"));

    const fp = makeTaskFile("TASK-001", { status: "In Progress" });

    await cmdReport("TASK-001", { complete: true });

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("status: Review");
    expect(content).toContain("Report generated");
  });

  it("refuses --complete for invalid transitions", async () => {
    vi.mocked(execa).mockRejectedValue(new Error("no worktree"));
    makeTaskFile("TASK-001", { status: "Done" });

    await expect(cmdReport("TASK-001", { complete: true })).rejects.toThrow(/cannot transition/i);
  });

  it("supports --json output", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(execa).mockRejectedValue(new Error("no worktree"));
    makeTaskFile("TASK-001", { status: "In Progress" });

    await cmdReport("TASK-001", { json: true });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.taskId).toBe("TASK-001");

    logSpy.mockRestore();
  });

  it("throws for non-existent task", async () => {
    await expect(cmdReport("TASK-999")).rejects.toThrow(/not found/i);
  });
});
