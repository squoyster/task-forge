import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setRepoRoot } from "../../src/util/paths.js";

// Mock the GitHub integration module to avoid real API calls
vi.mock("../../src/integrations/github/index.js", () => ({
  setConfig: vi.fn(),
  getConfig: vi.fn(),
  createIssue: vi.fn(),
  updateIssueLabels: vi.fn(),
  updateIssueBody: vi.fn(),
  ensureLabels: vi.fn(),
  generateIssueBody: vi.fn((_id: string, body: string) => body),
}));

// Mock the projects module to avoid real GraphQL calls
vi.mock("../../src/integrations/github/projects.js", () => ({
  syncTaskToProject: vi.fn(),
}));

import { cmdSync } from "../../src/commands/sync.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-sync-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });

  // Set up a minimal .taskforge/config.json with GitHub enabled
  const configDir = path.join(repoDir, ".taskforge");
  fs.mkdirSync(configDir, { recursive: true });
  const config = {
    project: { name: "test-repo", defaultBranch: "main" },
    tasks: { directory: "tasks", idPrefix: "TASK" },
    worktrees: { root: "../worktrees", branchPrefix: "agent" },
    github: {
      enabled: true,
      owner: "test-owner",
      repo: "test-repo",
    },
    opencode: { enabled: true },
    continuation: { autoContinue: true },
  };
  fs.writeFileSync(
    path.join(configDir, "config.json"),
    JSON.stringify(config, null, 2),
    "utf-8",
  );

  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTaskFile(
  id: string,
  overrides: Record<string, unknown> = {},
): void {
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Ready",
    priority: "P2",
    ...overrides,
  };
  const body = `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = [
    "---",
    ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`),
    "---",
    "",
    body,
  ];
  const filePath = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}

import { createIssue, updateIssueLabels, updateIssueBody, ensureLabels } from "../../src/integrations/github/index.js";
import { syncTaskToProject } from "../../src/integrations/github/projects.js";

describe("cmdSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates issues for tasks without issue number", async () => {
    vi.mocked(createIssue).mockResolvedValue({ number: 10, url: "https://github.com/test-owner/test-repo/issues/10" });
    vi.mocked(ensureLabels).mockResolvedValue(undefined);

    makeTaskFile("TASK-001");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSync();

    expect(ensureLabels).toHaveBeenCalled();
    expect(createIssue).toHaveBeenCalledWith(
      { owner: "test-owner", repo: "test-repo" },
      expect.objectContaining({ title: expect.stringContaining("TASK-001") }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Created #10"));
    logSpy.mockRestore();
  });

  it("updates existing issues when task has issue number", async () => {
    vi.mocked(createIssue).mockResolvedValue({ number: 10, url: "" });
    vi.mocked(updateIssueLabels).mockResolvedValue(undefined);
    vi.mocked(updateIssueBody).mockResolvedValue(undefined);
    vi.mocked(ensureLabels).mockResolvedValue(undefined);

    makeTaskFile("TASK-001", { issue: 5 });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSync();

    expect(createIssue).not.toHaveBeenCalled();
    expect(updateIssueLabels).toHaveBeenCalledWith(
      { owner: "test-owner", repo: "test-repo" },
      5,
      expect.any(String),
    );
    expect(updateIssueBody).toHaveBeenCalledWith(
      { owner: "test-owner", repo: "test-repo" },
      5,
      expect.any(String),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Updated #5"));
    logSpy.mockRestore();
  });

  it("handles sync with no tasks", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSync();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No task files found"));
    logSpy.mockRestore();
  });

  it("handles GitHub disabled in config", async () => {
    // Override config to disable GitHub
    const configDir = path.join(uniqueDir, "repo", ".taskforge");
    const config = JSON.parse(fs.readFileSync(path.join(configDir, "config.json"), "utf-8"));
    config.github.enabled = false;
    fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify(config, null, 2), "utf-8");

    makeTaskFile("TASK-001");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSync();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("not enabled"));
    logSpy.mockRestore();
  });

  it("continues when createIssue fails for one task", async () => {
    vi.mocked(createIssue)
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce({ number: 11, url: "" });
    vi.mocked(ensureLabels).mockResolvedValue(undefined);

    makeTaskFile("TASK-001");
    makeTaskFile("TASK-002");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    // Should not throw — sync continues for other tasks
    await expect(cmdSync()).resolves.not.toThrow();
    logSpy.mockRestore();
  });

  it("writes issue number to task frontmatter after creation", async () => {
    vi.mocked(createIssue).mockResolvedValue({ number: 42, url: "" });
    vi.mocked(ensureLabels).mockResolvedValue(undefined);

    makeTaskFile("TASK-001");

    await cmdSync();

    const taskContent = fs.readFileSync(path.join(stateDir, "TASK-001.md"), "utf-8");
    expect(taskContent).toContain("issue: 42");
  });

  it("passes P0 priority label", async () => {
    vi.mocked(createIssue).mockResolvedValue({ number: 10, url: "" });
    vi.mocked(ensureLabels).mockResolvedValue(undefined);

    makeTaskFile("TASK-001", { priority: "P0" });

    await cmdSync();

    expect(createIssue).toHaveBeenCalledWith(
      { owner: "test-owner", repo: "test-repo" },
      expect.objectContaining({
        labels: expect.arrayContaining(["p0"]),
      }),
    );
  });

  it("syncs tasks to project board when projectNumber is configured", async () => {
    vi.mocked(createIssue).mockResolvedValue({ number: 10, url: "" });
    vi.mocked(ensureLabels).mockResolvedValue(undefined);
    vi.mocked(syncTaskToProject).mockResolvedValue(true);

    // Add projectNumber to config
    const configPath = path.join(uniqueDir, "repo", ".taskforge", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    config.github.projectNumber = 1;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    makeTaskFile("TASK-001");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSync();

    expect(syncTaskToProject).toHaveBeenCalledWith(
      { owner: "test-owner", repo: "test-repo", projectNumber: 1 },
      10,
      "Ready",
      "Status",
    );
    logSpy.mockRestore();
  });

  it("skips project board sync when projectNumber is not configured", async () => {
    vi.mocked(createIssue).mockResolvedValue({ number: 10, url: "" });
    vi.mocked(ensureLabels).mockResolvedValue(undefined);

    makeTaskFile("TASK-001");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSync();

    expect(syncTaskToProject).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("syncs existing issues to project board", async () => {
    vi.mocked(updateIssueLabels).mockResolvedValue(undefined);
    vi.mocked(updateIssueBody).mockResolvedValue(undefined);
    vi.mocked(ensureLabels).mockResolvedValue(undefined);
    vi.mocked(syncTaskToProject).mockResolvedValue(true);

    // Add projectNumber to config
    const configPath = path.join(uniqueDir, "repo", ".taskforge", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    config.github.projectNumber = 1;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    makeTaskFile("TASK-001", { issue: 5 });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSync();

    expect(syncTaskToProject).toHaveBeenCalledWith(
      { owner: "test-owner", repo: "test-repo", projectNumber: 1 },
      5,
      "Ready",
      "Status",
    );
    logSpy.mockRestore();
  });

  it("uses columnMapping to translate status for project board", async () => {
    vi.mocked(createIssue).mockResolvedValue({ number: 10, url: "" });
    vi.mocked(ensureLabels).mockResolvedValue(undefined);
    vi.mocked(syncTaskToProject).mockResolvedValue(true);

    // Add projectNumber and columnMapping to config
    const configPath = path.join(uniqueDir, "repo", ".taskforge", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    config.github.projectNumber = 1;
    config.github.projects = {
      statusField: "Status",
      columnMapping: { Ready: "Todo", "In Progress": "Doing" },
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    makeTaskFile("TASK-001");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await cmdSync();

    expect(syncTaskToProject).toHaveBeenCalledWith(
      { owner: "test-owner", repo: "test-repo", projectNumber: 1 },
      10,
      "Todo",
      "Status",
    );
    logSpy.mockRestore();
  });
});
