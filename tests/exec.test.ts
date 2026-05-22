import { describe, it, expect } from "vitest";
import { run, runOrThrow } from "../src/util/exec.js";

describe("run", () => {
  it("returns stdout and exitCode 0 for successful command", async () => {
    const result = await run("echo", ["hello world"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello world");
  });

  it("returns non-zero exitCode for failing command", async () => {
    const result = await run("sh", ["-c", "exit 1"]);
    expect(result.exitCode).toBe(1);
  });

  it("returns stderr for commands that write to stderr", async () => {
    const result = await run("sh", ["-c", "echo error >&2 && exit 1"]);
    expect(result.stderr).toContain("error");
    expect(result.exitCode).toBe(1);
  });
});

describe("runOrThrow", () => {
  it("returns stdout for successful command", async () => {
    const result = await runOrThrow("echo", ["ok"]);
    expect(result.stdout.trim()).toBe("ok");
  });

  it("throws for failing command", async () => {
    await expect(runOrThrow("sh", ["-c", "exit 1"])).rejects.toThrow();
  });
});