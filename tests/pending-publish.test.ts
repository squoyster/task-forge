import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setRepoRoot, getTaskforgeDir } from "../src/util/paths.js";

import {
  loadPendingPublish,
  addPendingPublish,
  removePendingPublish,
  clearPendingPublish,
  findPendingByTitle,
  pendingPublishCount,
} from "../src/core/pending-publish.js";

let uniqueDir: string;
let repoDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "pending-publish-test-"));
  repoDir = path.join(uniqueDir, "repo");
  fs.mkdirSync(repoDir, { recursive: true });

  // Create .taskforge dir
  const configDir = path.join(repoDir, ".taskforge");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "config.json"),
    JSON.stringify({ project: { name: "test" } }, null, 2),
    "utf-8",
  );

  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

describe("pending-publish", () => {
  it("starts with empty list", () => {
    const entries = loadPendingPublish(repoDir);
    expect(entries).toEqual([]);
  });

  it("adds a pending entry", () => {
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "My task",
      filePath: "/tmp/task-state/TASK-001.md",
    });

    const entries = loadPendingPublish(repoDir);
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe("TASK-001");
    expect(entries[0].title).toBe("My task");
  });

  it("does not add duplicate IDs", () => {
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "First",
      filePath: "TASK-001.md",
    });
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "Second",
      filePath: "TASK-001.md",
    });

    const entries = loadPendingPublish(repoDir);
    expect(entries.length).toBe(1);
  });

  it("supports multiple pending entries", () => {
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "Task one",
      filePath: "TASK-001.md",
    });
    addPendingPublish(repoDir, {
      id: "TASK-002",
      title: "Task two",
      filePath: "TASK-002.md",
    });

    expect(pendingPublishCount(repoDir)).toBe(2);
  });

  it("removes a pending entry by ID", () => {
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "Task one",
      filePath: "TASK-001.md",
    });
    addPendingPublish(repoDir, {
      id: "TASK-002",
      title: "Task two",
      filePath: "TASK-002.md",
    });

    removePendingPublish(repoDir, "TASK-001");

    const entries = loadPendingPublish(repoDir);
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe("TASK-002");
  });

  it("does nothing when removing non-existent ID", () => {
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "Task one",
      filePath: "TASK-001.md",
    });

    removePendingPublish(repoDir, "TASK-999");

    expect(pendingPublishCount(repoDir)).toBe(1);
  });

  it("clears all pending entries", () => {
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "Task one",
      filePath: "TASK-001.md",
    });
    addPendingPublish(repoDir, {
      id: "TASK-002",
      title: "Task two",
      filePath: "TASK-002.md",
    });

    clearPendingPublish(repoDir);

    expect(loadPendingPublish(repoDir)).toEqual([]);
  });

  it("finds pending entry by title (case-insensitive)", () => {
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "My Important Task",
      filePath: "TASK-001.md",
    });

    const found = findPendingByTitle(repoDir, "my important task");
    expect(found).toBeTruthy();
    expect(found!.id).toBe("TASK-001");
  });

  it("returns undefined for non-matching title", () => {
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "My task",
      filePath: "TASK-001.md",
    });

    const found = findPendingByTitle(repoDir, "Different task");
    expect(found).toBeUndefined();
  });

  it("preserves entries across reloads", () => {
    addPendingPublish(repoDir, {
      id: "TASK-001",
      title: "Persistent task",
      filePath: "TASK-001.md",
    });

    // Reload from disk
    const entries = loadPendingPublish(repoDir);
    expect(entries.length).toBe(1);
    expect(entries[0].title).toBe("Persistent task");
  });

  it("returns empty for corrupt file", () => {
    // Write invalid JSON
    const filePath = path.join(getTaskforgeDir(repoDir), "pending-publish.json");
    fs.writeFileSync(filePath, "not valid json", "utf-8");

    const entries = loadPendingPublish(repoDir);
    expect(entries).toEqual([]);
  });
});
