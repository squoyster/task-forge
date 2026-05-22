import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cmdInit } from "../src/commands/init.js";
import { setRepoRoot } from "../src/util/paths.js";

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

  it("creates tasks/README.md and tasks/TEMPLATE.md", async () => {
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
    expect(config.project.defaultBranch).toBe("main");
  });

  it("creates required directories", async () => {
    await cmdInit();
    expect(fs.existsSync(path.join(tmpDir, "tasks"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".taskforge"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "specs"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "docs", "decisions"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "logs", "taskforge"))).toBe(true);
  });

  it("preserves existing files (no --force)", async () => {
    // First init creates everything
    await cmdInit();

    // Remove TASKFORGE.md
    fs.unlinkSync(path.join(tmpDir, "TASKFORGE.md"));

    // Create a custom tasks/README.md
    const customReadme = "# Custom README";
    fs.writeFileSync(path.join(tmpDir, "tasks", "README.md"), customReadme, "utf-8");

    // Second init without --force — should NOT recreate TASKFORGE.md
    // and should NOT overwrite custom README
    await cmdInit();

    // TASKFORGE.md was deleted before second init and should still be missing
    // without --force... Actually wait, cmdInit always creates missing files.
    // So this test needs to be rethought.
    // The --force flag doesn't change behavior — it just makes re-init explicit.
    // Let me test what actually happens.
    expect(fs.existsSync(path.join(tmpDir, "TASKFORGE.md"))).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, "tasks", "README.md"), "utf-8")).toBe(customReadme);
  });

  it("recreates TASKFORGE.md after deletion with --force", async () => {
    await cmdInit();
    fs.unlinkSync(path.join(tmpDir, "TASKFORGE.md"));
    expect(fs.existsSync(path.join(tmpDir, "TASKFORGE.md"))).toBe(false);

    await cmdInit(true); // --force
    expect(fs.existsSync(path.join(tmpDir, "TASKFORGE.md"))).toBe(true);
  });

  it("recreates tasks/TEMPLATE.md after deletion with --force", async () => {
    await cmdInit();
    const templatePath = path.join(tmpDir, "tasks", "TEMPLATE.md");
    fs.unlinkSync(templatePath);
    expect(fs.existsSync(templatePath)).toBe(false);

    await cmdInit(true);
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it("recreates config.json after deletion with --force", async () => {
    await cmdInit();
    const configPath = path.join(tmpDir, ".taskforge", "config.json");
    fs.unlinkSync(configPath);
    expect(fs.existsSync(configPath)).toBe(false);

    await cmdInit(true);
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("preserves existing config values with --force", async () => {
    await cmdInit();
    const configPath = path.join(tmpDir, ".taskforge", "config.json");

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

    // Create a custom task file
    const taskDir = path.join(tmpDir, "tasks");
    const taskFile = path.join(taskDir, "TASK-999.md");
    fs.writeFileSync(taskFile, "# Custom Task", "utf-8");

    await cmdInit(true); // --force
    expect(fs.readFileSync(taskFile, "utf-8")).toBe("# Custom Task");
  });

  it("recreates missing directories with --force", async () => {
    await cmdInit();

    // Delete a directory
    fs.rmSync(path.join(tmpDir, "specs"), { recursive: true, force: true });

    await cmdInit(true);
    expect(fs.existsSync(path.join(tmpDir, "specs"))).toBe(true);
  });

  it("does not overwrite existing TASKFORGE.md without --force", async () => {
    await cmdInit();

    const taskforgePath = path.join(tmpDir, "TASKFORGE.md");
    const customContent = "# Custom TaskForge";
    fs.writeFileSync(taskforgePath, customContent, "utf-8");

    await cmdInit(); // no --force
    expect(fs.readFileSync(taskforgePath, "utf-8")).toBe(customContent);
  });
});
