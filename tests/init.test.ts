import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdInit } from "../src/commands/init.js";
import { setRepoRoot } from "../src/util/paths.js";

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

  it("creates task-state/README.md and task-state/TEMPLATE.md", async () => {
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
    expect(fs.existsSync(path.join(uniqueDir, "repo", ".taskforge"))).toBe(true);
    expect(fs.existsSync(path.join(uniqueDir, "repo", "specs"))).toBe(true);
    expect(fs.existsSync(path.join(uniqueDir, "repo", "docs", "decisions"))).toBe(true);
    expect(fs.existsSync(path.join(uniqueDir, "repo", "logs", "taskforge"))).toBe(true);
  });

  it("preserves existing files (no --force)", async () => {
    // First init creates everything
    await cmdInit();

    // Remove TASKFORGE.md
    fs.unlinkSync(path.join(uniqueDir, "repo", "TASKFORGE.md"));

    // Create a custom task-state/README.md
    const customReadme = "# Custom README";
    fs.writeFileSync(path.join(stateDir, "README.md"), customReadme, "utf-8");

    // Second init without --force — should NOT recreate TASKFORGE.md
    // and should NOT overwrite custom README
    await cmdInit();

    expect(fs.existsSync(path.join(uniqueDir, "repo", "TASKFORGE.md"))).toBe(true);
    expect(fs.readFileSync(path.join(stateDir, "README.md"), "utf-8")).toBe(customReadme);
  });

  it("recreates TASKFORGE.md after deletion with --force", async () => {
    await cmdInit();
    fs.unlinkSync(path.join(uniqueDir, "repo", "TASKFORGE.md"));
    expect(fs.existsSync(path.join(uniqueDir, "repo", "TASKFORGE.md"))).toBe(false);

    await cmdInit(true); // --force
    expect(fs.existsSync(path.join(uniqueDir, "repo", "TASKFORGE.md"))).toBe(true);
  });

  it("recreates task-state/TEMPLATE.md after deletion with --force", async () => {
    await cmdInit();
    const templatePath = path.join(stateDir, "TEMPLATE.md");
    fs.unlinkSync(templatePath);
    expect(fs.existsSync(templatePath)).toBe(false);

    await cmdInit(true);
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it("recreates config.json after deletion with --force", async () => {
    await cmdInit();
    const configPath = path.join(uniqueDir, "repo", ".taskforge", "config.json");
    fs.unlinkSync(configPath);
    expect(fs.existsSync(configPath)).toBe(false);

    await cmdInit(true);
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("preserves existing config values with --force", async () => {
    await cmdInit();
    const configPath = path.join(uniqueDir, "repo", ".taskforge", "config.json");

    // Modify config
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    config.project.name = "modified-name";
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    await cmdInit(true); // --force
    const configAfter = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(configAfter.project.name).toBe("modified-name");
  });

  it("never overwrites existing task files with --force", async () => {
    await cmdInit();

    // Create a custom task file in the task-state dir
    const taskFile = path.join(stateDir, "TASK-999.md");
    fs.writeFileSync(taskFile, "# Custom Task", "utf-8");

    await cmdInit(true); // --force
    expect(fs.readFileSync(taskFile, "utf-8")).toBe("# Custom Task");
  });

  it("recreates missing directories with --force", async () => {
    await cmdInit();

    // Delete a directory
    fs.rmSync(path.join(uniqueDir, "repo", "specs"), { recursive: true, force: true });

    await cmdInit(true);
    expect(fs.existsSync(path.join(uniqueDir, "repo", "specs"))).toBe(true);
  });

  it("does not overwrite existing TASKFORGE.md without --force", async () => {
    await cmdInit();

    const taskforgePath = path.join(uniqueDir, "repo", "TASKFORGE.md");
    const customContent = "# Custom TaskForge";
    fs.writeFileSync(taskforgePath, customContent, "utf-8");

    await cmdInit(); // no --force
    expect(fs.readFileSync(taskforgePath, "utf-8")).toBe(customContent);
  });
});
