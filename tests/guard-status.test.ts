import { describe, it, expect, beforeEach, vi } from "vitest";
import { cmdGuardStatus } from "../src/commands/guard-cmd.js";
import { _setTestManagedSession, _resetTestManagedSession } from "../src/core/mutation-guard.js";

// Mock logging to capture output
vi.mock("../src/util/logging.js", () => ({
  logHeader: vi.fn(),
  logDivider: vi.fn(),
  logSub: vi.fn(),
  logInfo: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

describe("cmdGuardStatus warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetTestManagedSession();
  });

  it("shows warning in text mode when TASK_FORGE_ACTIVE is not set", async () => {
    _setTestManagedSession(false);
    const { logInfo } = await import("../src/util/logging.js");

    await cmdGuardStatus({ json: false });

    // Should have called logInfo with the warning header
    const calls = vi.mocked(logInfo).mock.calls;
    const allText = calls.map((c) => c.join(" ")).join("\n");
    expect(allText).toContain("MUTATION BOUNDARY IS INACTIVE");
  });

  it("shows warning in JSON mode when TASK_FORGE_ACTIVE is not set", async () => {
    _setTestManagedSession(false);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => { logs.push(msg); });

    await cmdGuardStatus({ json: true });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.managed).toBe(false);
    expect(output.warnings).toBeDefined();
    expect(Array.isArray(output.warnings)).toBe(true);
    expect(output.warnings.length).toBeGreaterThan(0);
    expect(output.warnings[0]).toContain("TASK_FORGE_ACTIVE");
  });

  it("shows no warning in JSON mode when managed session", async () => {
    _setTestManagedSession(true);

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => { logs.push(msg); });

    await cmdGuardStatus({ json: true });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs[0]);
    expect(output.ok).toBe(true);
    expect(output.managed).toBe(true);
    expect(output.warnings).toBeUndefined();
  });

  it("shows no warning box in text mode when managed session", async () => {
    _setTestManagedSession(true);

    const { logInfo } = await import("../src/util/logging.js");

    await cmdGuardStatus({ json: false });

    const calls = vi.mocked(logInfo).mock.calls;
    const allText = calls.map((c) => c.join(" ")).join("\n");
    expect(allText).not.toContain("MUTATION BOUNDARY IS INACTIVE");
  });
});
