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

    vi.mocked(execa).mockResolvedValue({} as never);

    const result = await cmdGates();
    expect(result).toBe(true);
    expect(execa).toHaveBeenCalledTimes(4);
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

    vi.mocked(execa).mockResolvedValue({} as never);

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

    vi.mocked(execa)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("command failed"));

    const result = await cmdGates({ only: "typecheck,lint" });
    expect(result).toBe(false);
    expect(execa).toHaveBeenCalledTimes(2);
  });

  it("emits JSON output with --json flag", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    writeConfig({
      typecheck: "echo ok",
      lint: "echo ok",
    });

    vi.mocked(execa).mockResolvedValue({} as never);

    await cmdGates({ json: true, only: "typecheck,lint" });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(true);
    expect(output.data.gates).toHaveLength(2);
    expect(output.data.gates[0]).toMatchObject({ name: "typecheck", passed: true, command: "echo ok" });
    expect(output.data.gates[1]).toMatchObject({ name: "lint", passed: true, command: "echo ok" });
    expect(output.data.allPassed).toBe(true);
    expect(output.nextAction?.kind).toBe("CONTINUE");
    expect(output.nextAction?.stop).toBe(false);

    logSpy.mockRestore();
  });

  it("reports allPassed: false when a gate fails in JSON mode", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    writeConfig({
      typecheck: "echo ok",
      lint: "echo fail",
    });

    vi.mocked(execa)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("command failed"));

    await cmdGates({ json: true, only: "typecheck,lint" });

    const output = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(output.ok).toBe(false);
    expect(output.data.gates).toHaveLength(2);
    expect(output.data.gates[0].passed).toBe(true);
    expect(output.data.gates[1].passed).toBe(false);
    expect(output.data.allPassed).toBe(false);
    expect(output.nextAction?.kind).toBe("FIX_CURRENT_TASK");
    expect(output.nextAction?.stop).toBe(true);
    expect(output.nextAction?.allowedCommands).toEqual(["taskforge gates"]);

    logSpy.mockRestore();
  });

  it("runs only requested gates with --only", async () => {
    writeConfig({
      typecheck: "echo ok",
      lint: "echo ok",
      build: "echo ok",
    });

    vi.mocked(execa).mockResolvedValue({} as never);

    const result = await cmdGates({ only: "typecheck,build" });
    expect(result).toBe(true);
    expect(execa).toHaveBeenCalledTimes(2);
  });

  it("reports unknown gate names as error", async () => {
    writeConfig({
      typecheck: "echo ok",
    });

    const result = await cmdGates({ only: "unknown-gate" });
    expect(result).toBe(false);
    expect(execa).not.toHaveBeenCalled();
  });
});
