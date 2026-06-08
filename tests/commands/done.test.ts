import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdDone } from "../../src/commands/done.js";
import { setRepoRoot } from "../../src/util/paths.js";

vi.mock("../../src/commands/gates.js", () => ({
  cmdGates: vi.fn().mockResolvedValue(true),
  runGates: vi.fn().mockResolvedValue({ passed: true, results: [] }),
}));

vi.mock("../../src/core/git.js", () => ({
  removeWorktree: vi.fn(),
  removeBranch: vi.fn(),
}));

vi.mock("../../src/core/completion-policy.js", () => ({
  checkCompletionEligibility: vi.fn().mockResolvedValue({
    eligible: true,
    reasons: [],
    preconditions: [{ name: "Mocked", passed: true, message: "test", code: "MOCKED" }],
    suggestedStatus: undefined,
  }),
  isCodeTask: vi.fn().mockReturnValue(false),
  deriveExpectedStatus: vi.fn().mockImplementation((t: any) => t.status),
}));

vi.mock("../../src/core/task-state-transaction.js", () => ({
  withTaskStateTransaction: vi.fn().mockResolvedValue(undefined),
}));

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-done-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTaskFile(id: string, overrides: Record<string, unknown> = {}): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Chore", // non-code to skip PR verification
    status: "Verify",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body = (bodyOverride as string | undefined) ?? `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Acceptance Criteria\n- [x] Do something\n\n## Agent Notes\n`;
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

describe("cmdDone", () => {
  it("marks a task as Done", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdDone("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Done");
  });

  it("throws for non-existent task", async () => {
    await expect(cmdDone("TASK-999")).rejects.toThrow(/not found/i);
  });

  it("rejects done for invalid transitions", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    await expect(cmdDone("TASK-001")).rejects.toThrow(/cannot transition/i);
  });

  it("throws for invalid transition", async () => {
    makeTaskFile("TASK-001", { status: "In Progress" });
    await expect(cmdDone("TASK-001")).rejects.toThrow(/cannot transition/i);
  });

  it("appends agent note when marking Done", async () => {
    const fp = makeTaskFile("TASK-001");
    await cmdDone("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toContain("Task marked Done");
  });
});
