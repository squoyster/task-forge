import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdInit } from "../../src/commands/init.js";
import { setRepoRoot } from "../../src/util/paths.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-init-test-"));
  setRepoRoot(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("cmdInit", () => {
  it("creates TASKFORGE.md", async () => {
    await cmdInit();
    expect(fs.existsSync(path.join(tmpDir, "TASKFORGE.md"))).toBe(true);
  });

  it("creates tasks directory and files", async () => {
    await cmdInit();
    expect(fs.existsSync(path.join(tmpDir, "tasks", "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "tasks", "TEMPLATE.md"))).toBe(true);
  });

  it("creates .taskforge/config.json", async () => {
    await cmdInit();
    const configPath = path.join(tmpDir, ".taskforge", "config.json");
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.project.name).toBe(path.basename(tmpDir));
  });

  it("creates required directories", async () => {
    await cmdInit();
    expect(fs.existsSync(path.join(tmpDir, "specs"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "docs", "decisions"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "logs", "taskforge"))).toBe(true);
  });

  it("does not overwrite existing files", async () => {
    await cmdInit();

    const taskforgePath = path.join(tmpDir, "TASKFORGE.md");
    const customContent = "# Custom Content";
    fs.writeFileSync(taskforgePath, customContent, "utf-8");

    await cmdInit();
    expect(fs.readFileSync(taskforgePath, "utf-8")).toBe(customContent);
  });

  it("recreates missing TASKFORGE.md", async () => {
    await cmdInit();
    const taskforgePath = path.join(tmpDir, "TASKFORGE.md");
    fs.unlinkSync(taskforgePath);
    expect(fs.existsSync(taskforgePath)).toBe(false);

    await cmdInit();
    expect(fs.existsSync(taskforgePath)).toBe(true);
  });
});
