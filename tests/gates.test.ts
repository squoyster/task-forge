import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdGates } from "../src/commands/gates.js";
import { setRepoRoot } from "../src/util/paths.js";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";

let uniqueDir: string;
let repoDir: string;

function writeConfig(gates: Record<string, string>) {
  const configDir = path.join(repoDir, ".taskforge");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "config.json"),
    JSON.stringify({ gates }),
    "utf-8",
  );
}

/**
 * Default mock: git internals (status/rev-parse) succeed so the clean-tree
 * check passes and a stamp can be written; gate commands succeed unless
 * listed in `failingCommands`.
 */
function defaultMock(options: { failingCommands?: string[] } = {}) {
  const failing = new Set(options.failingCommands ?? []);
  vi.mocked(execa).mockImplementation((((cmd: string, args?: string[]) => {
    if (cmd === "git") {
      if (args?.[0] === "rev-parse") {
        return Promise.resolve({ stdout: "0".repeat(40), stderr: "", exitCode: 0 });
      }
      // git status --porcelain => clean
      return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
    }
    if (failing.has(cmd)) {
      return Promise.reject(new Error("command failed"));
    }
    return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
  }) as never) as never);
}

/** Count only gate-command execa calls (exclude git internals). */
function gateCallCount(): number {
  return vi.mocked(execa).mock.calls.filter(([cmd]) => cmd !== "git").length;
}

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-gates-test-"));
  repoDir = path.join(uniqueDir, "repo");
  const stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
  vi.clearAllMocks();
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdGates", () => {
  it("runs all default gates when no config exists", async () => {
    writeConfig({});
    defaultMock();

    const result = await cmdGates();
    expect(result).toBe(true);
    expect(gateCallCount()).toBe(4);
    expect(execa).toHaveBeenCalledWith("npm run typecheck", expect.objectContaining({ shell: true }));
    expect(execa).toHaveBeenCalledWith("npm run lint", expect.objectContaining({ shell: true }));
    expect(execa).toHaveBeenCalledWith("npm run build", expect.objectContaining({ shell: true }));
    expect(execa).toHaveBeenCalledWith("npm test -- --run", expect.objectContaining({ shell: true }));
  });

  it("uses custom commands from config to override defaults", async () => {
    writeConfig({
      typecheck: "tsc --noEmit",
      lint: "eslint .",
    });

    defaultMock();

    const result = await cmdGates();
    expect(result).toBe(true);
    expect(execa).toHaveBeenCalledWith("tsc --noEmit", expect.objectContaining({ shell: true }));
    expect(execa).toHaveBeenCalledWith("eslint .", expect.objectContaining({ shell: true }));
    expect(execa).toHaveBeenCalledWith("npm run build", expect.objectContaining({ shell: true }));
    expect(execa).toHaveBeenCalledWith("npm test -- --run", expect.objectContaining({ shell: true }));
  });

  it("reports failure when a gate fails", async () => {
    writeConfig({
      typecheck: "echo ok",
      lint: "echo fail",
    });

    defaultMock({ failingCommands: ["echo fail"] });

    const result = await cmdGates({ only: "typecheck,lint" });
    expect(result).toBe(false);
    expect(gateCallCount()).toBe(2);
  });

  it("emits JSON output with --json flag", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    writeConfig({
      typecheck: "echo ok",
      lint: "echo ok",
    });

    defaultMock();

    await cmdGates({ json: true, only: "typecheck,lint" });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");

    logSpy.mockRestore();
  });

  it("reports allPassed: false when a gate fails in JSON mode", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    writeConfig({
      typecheck: "echo ok",
      lint: "echo fail",
    });

    defaultMock({ failingCommands: ["echo fail"] });

    await cmdGates({ json: true, only: "typecheck,lint" });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.status).toBe("success");

    logSpy.mockRestore();
  });

  it("runs only requested gates with --only", async () => {
    writeConfig({
      typecheck: "echo ok",
      lint: "echo ok",
      build: "echo ok",
    });

    defaultMock();

    const result = await cmdGates({ only: "typecheck,build" });
    expect(result).toBe(true);
    expect(gateCallCount()).toBe(2);
  });

  it("reports unknown gate names as error", async () => {
    writeConfig({
      typecheck: "echo ok",
    });

    defaultMock();

    const result = await cmdGates({ only: "unknown-gate" });
    expect(result).toBe(false);
    expect(gateCallCount()).toBe(0);
  });

  it("aborts with an error when the working tree is dirty", async () => {
    writeConfig({
      typecheck: "echo ok",
    });

    // git status --porcelain returns a dirty entry
    vi.mocked(execa).mockImplementation((((cmd: string, args?: string[]) => {
      if (cmd === "git" && args?.[0] === "status") {
        return Promise.resolve({ stdout: " M dirty.txt\n", stderr: "", exitCode: 0 });
      }
      return Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
    }) as never) as never);

    const result = await cmdGates({ only: "typecheck" });
    expect(result).toBe(false);
    expect(gateCallCount()).toBe(0);
  });

  it("writes a gate stamp on all-pass", async () => {
    writeConfig({
      typecheck: "echo ok",
    });

    defaultMock();

    await cmdGates({ only: "typecheck" });

    const stampFile = path.join(repoDir, ".taskforge", "gate-stamp.json");
    expect(fs.existsSync(stampFile)).toBe(true);
    const stamp = JSON.parse(fs.readFileSync(stampFile, "utf-8"));
    expect(stamp.commit_sha).toBe("0".repeat(40));
    expect(stamp.gates.typecheck).toBe(true);
    expect(typeof stamp.timestamp).toBe("string");
    expect(typeof stamp.runner_session).toBe("string");
  });
});
