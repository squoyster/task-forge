import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdDone } from "../../src/commands/done.js";
import { setRepoRoot } from "../../src/util/paths.js";

const { mockRunGates, mockResolveAuthority, mockAssertCanForce } = vi.hoisted(() => ({
  mockRunGates: vi.fn(),
  mockResolveAuthority: vi.fn(),
  mockAssertCanForce: vi.fn(),
}));

vi.mock("../../src/commands/gates.js", () => ({
  cmdGates: vi.fn().mockResolvedValue(true),
  runGates: mockRunGates,
}));

vi.mock("../../src/core/authority.js", () => ({
  resolveAuthority: mockResolveAuthority,
  assertCanForce: mockAssertCanForce,
  ForceRequiresHumanOrDoctorError: class ForceRequiresHumanOrDoctorError extends Error {
    code = "FORCE_REQUIRES_HUMAN_OR_DOCTOR";
    exitCode = 1;
    constructor(msg?: string) { super(msg ?? "Normal agents may not use --force."); }
  },
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
  mockRunGates.mockResolvedValue({ passed: true, results: [] });
  mockResolveAuthority.mockReturnValue("human");
  mockAssertCanForce.mockImplementation((authority: string) => {
    if (authority === "agent") throw new Error("Normal agents may not use --force.");
  });
});

afterEach(() => {
  vi.clearAllMocks();
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

  it("records submitted_sha and submitted_at as closeout (no PR → HEAD)", async () => {
    const fp = makeTaskFile("TASK-001"); // non-code task, no PR
    await cmdDone("TASK-001");

    const content = fs.readFileSync(fp, "utf-8");
    expect(content).toMatch(/submitted_sha:/);
    expect(content).toMatch(/submitted_at:/);
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

  describe("--force", () => {
    it("bypasses gate failures with human authority and records override", async () => {
      const fp = makeTaskFile("TASK-001");
      mockResolveAuthority.mockReturnValue("human");
      mockRunGates.mockResolvedValue({ passed: false, results: [
        { name: "typecheck", passed: false, command: "tsc --noEmit", duration: 100 },
        { name: "lint", passed: true, command: "eslint .", duration: 50 },
      ]});

      await cmdDone("TASK-001", { force: true });

      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain("Done");
      expect(content).toContain("override_reason");
      expect(content).toContain("override_actor: human");
      expect(content).toContain("override_failed_gates");
      expect(content).toContain("typecheck");
      expect(content).toMatch(/Force override by human/);
    });

    it("bypasses gate failures with doctor authority and records override", async () => {
      const fp = makeTaskFile("TASK-001");
      mockResolveAuthority.mockReturnValue("doctor");
      mockRunGates.mockResolvedValue({ passed: false, results: [
        { name: "test", passed: false, command: "npm test", duration: 200 },
      ]});

      await cmdDone("TASK-001", { force: true });

      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain("Done");
      expect(content).toContain("override_actor: doctor");
      expect(content).toMatch(/Force override by doctor/);
    });

    it("rejects --force for agent authority when gates fail", async () => {
      makeTaskFile("TASK-001");
      mockResolveAuthority.mockReturnValue("agent");
      mockRunGates.mockResolvedValue({ passed: false, results: [
        { name: "lint", passed: false, command: "eslint .", duration: 50 },
      ]});

      await expect(cmdDone("TASK-001", { force: true })).rejects.toThrow(/--force/);
    });

    it("works normally when --force is used and gates already pass", async () => {
      const fp = makeTaskFile("TASK-001");
      mockRunGates.mockResolvedValue({ passed: true, results: [] });

      await cmdDone("TASK-001", { force: true });

      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain("Done");
      // No override metadata recorded since gates passed
      expect(content).not.toContain("override_reason");
    });
  });
});
