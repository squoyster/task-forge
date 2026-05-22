import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdInit } from "../../src/commands/init.js";
import { setRepoRoot } from "../../src/util/paths.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-init-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("cmdInit", () => {
  it("creates TASKFORGE.md", async () => {
    await cmdInit();
    expect(fs.existsSync(path.join(uniqueDir, "repo", "TASKFORGE.md"))).toBe(true);
  });

  it("creates task-state README and TEMPLATE", async () => {
    await cmdInit();
    expect(fs.existsSync(path.join(stateDir, "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(stateDir, "TEMPLATE.md"))).toBe(true);
  });

  it("creates .taskforge/config.json", async () => {
    await cmdInit();
    const configPath = path.join(uniqueDir, "repo", ".taskforge", "config.json");
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(config.project.name).toBe("repo");
  });

  it("creates required directories", async () => {
    await cmdInit();
    expect(fs.existsSync(path.join(uniqueDir, "repo", "specs"))).toBe(true);
    expect(fs.existsSync(path.join(uniqueDir, "repo", "docs", "decisions"))).toBe(true);
    expect(fs.existsSync(path.join(uniqueDir, "repo", "logs", "taskforge"))).toBe(true);
  });

  it("does not overwrite existing files", async () => {
    await cmdInit();

    const taskforgePath = path.join(uniqueDir, "repo", "TASKFORGE.md");
    const customContent = "# Custom Content";
    fs.writeFileSync(taskforgePath, customContent, "utf-8");

    await cmdInit();
    expect(fs.readFileSync(taskforgePath, "utf-8")).toBe(customContent);
  });

  it("recreates missing TASKFORGE.md", async () => {
    await cmdInit();
    const taskforgePath = path.join(uniqueDir, "repo", "TASKFORGE.md");
    fs.unlinkSync(taskforgePath);
    expect(fs.existsSync(taskforgePath)).toBe(false);

    await cmdInit();
    expect(fs.existsSync(taskforgePath)).toBe(true);
  });
});
