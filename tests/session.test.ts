import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateSessionId, parseSessionIdFromBranch, assertTaskOwnership } from "../src/core/session.js";
import { TaskForgeError } from "../src/core/errors.js";

vi.mock("../src/core/git.js", () => ({
  getCurrentBranch: vi.fn(),
}));

import { getCurrentBranch } from "../src/core/git.js";

describe("generateSessionId", () => {
  it("returns a 10-character hex string", () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[a-f0-9]{10}$/);
  });

  it("returns unique values on successive calls", () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    expect(id1).not.toBe(id2);
  });
});

describe("parseSessionIdFromBranch", () => {
  it("extracts session ID from branch with slug", () => {
    const branch = "agent/TASK-012-my-feature--a1b2c3d4f5";
    expect(parseSessionIdFromBranch(branch)).toBe("a1b2c3d4f5");
  });

  it("extracts session ID from branch without slug", () => {
    const branch = "agent/TASK-012--a1b2c3d4f5";
    expect(parseSessionIdFromBranch(branch)).toBe("a1b2c3d4f5");
  });

  it("returns null for branch without session ID", () => {
    const branch = "agent/TASK-012-my-feature";
    expect(parseSessionIdFromBranch(branch)).toBeNull();
  });

  it("returns null for branch with non-hex suffix", () => {
    const branch = "agent/TASK-012--nothex12345";
    expect(parseSessionIdFromBranch(branch)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseSessionIdFromBranch("")).toBeNull();
  });
});

describe("assertTaskOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("does not throw when assignee matches branch session", async () => {
    (getCurrentBranch as ReturnType<typeof vi.fn>).mockResolvedValue("agent/TASK-001-test--a1b2c3d4f5");

    await assertTaskOwnership(
      { id: "TASK-001", assignee: "a1b2c3d4f5" } as Parameters<typeof assertTaskOwnership>[0],
      "/tmp/repo",
    );
    // No throw = pass
  });

  it("does not throw when task has no assignee", async () => {
    (getCurrentBranch as ReturnType<typeof vi.fn>).mockResolvedValue("agent/TASK-001-test--a1b2c3d4f5");

    await assertTaskOwnership(
      { id: "TASK-001", assignee: undefined } as Parameters<typeof assertTaskOwnership>[0],
      "/tmp/repo",
    );
    // No throw = pass
  });

  it("throws with safe recovery guidance on ownership mismatch", async () => {
    (getCurrentBranch as ReturnType<typeof vi.fn>).mockResolvedValue("agent/TASK-001-test--d1ff3a1b2c");

    await expect(
      assertTaskOwnership(
        { id: "TASK-001", assignee: "a1b2c3d4f5" } as Parameters<typeof assertTaskOwnership>[0],
        "/tmp/repo",
      ),
    ).rejects.toThrow(TaskForgeError);

    try {
      await assertTaskOwnership(
        { id: "TASK-001", assignee: "a1b2c3d4f5" } as Parameters<typeof assertTaskOwnership>[0],
        "/tmp/repo",
      );
    } catch (err) {
      const message = (err as Error).message;
      // Should NOT recommend 'taskforge unlock --force' as a command
      expect(message).not.toMatch(/taskforge unlock.*--force/i);
      expect(message).not.toMatch(/Use.*unlock.*--force/i);
      expect(message).toContain("Normal agents must not use force unlock");
      expect(message).toContain("taskforge inspect");
      expect(message).toContain("taskforge doctor");
      expect(message).toContain("taskforge block");
    }
  });
});
