import { describe, it, expect } from "vitest";
import { generateSessionId, parseSessionIdFromBranch } from "../src/core/session.js";

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
