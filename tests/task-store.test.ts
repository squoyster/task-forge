import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseTaskFile,
  writeTaskFile,
  updateTaskStatus,
  updateTaskIssue,
  appendAgentNote,
  findDuplicateStructuralSections,
  listTaskFiles,
  loadAllTasks,
  loadTaskById,
  getNextId,
} from "../src/core/task-store.js";
import { setRepoRoot } from "../src/util/paths.js";
import type { ParsedTask } from "../src/core/task-store.js";

let uniqueDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-test-"));
  const repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function makeTaskFile(id: string, overrides: Record<string, unknown> = {}): string {
  const { body: bodyOverride, ...frontmatterOverrides } = overrides;
  const frontmatter: Record<string, unknown> = {
    id,
    type: "Task",
    status: "Ready",
    priority: "P2",
    ...frontmatterOverrides,
  };
  const body = (bodyOverride as string | undefined) ?? `# ${id}: Test task ${id}\n\n## Goal\nDo something.\n\n## Agent Notes\n`;
  const lines = ["---", ...Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`), "---", "", body];
  const filePath = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}

describe("parseTaskFile", () => {
  it("returns null for non-existent file", () => {
    expect(parseTaskFile("/nonexistent/path.md")).toBeNull();
  });

  it("parses a valid task file", () => {
    const fp = makeTaskFile("TASK-010");
    const task = parseTaskFile(fp);
    expect(task).not.toBeNull();
    expect(task!.id).toBe("TASK-010");
    expect(task!.type).toBe("Task");
    expect(task!.status).toBe("Ready");
    expect(task!.priority).toBe("P2");
  });

  it("extracts id from filename when frontmatter has no id", () => {
    const fp = path.join(stateDir, "TASK-099.md");
    const content = "---\ntype: Bug\nstatus: Inbox\n---\n\n# Body";
    fs.writeFileSync(fp, content, "utf-8");
    const task = parseTaskFile(fp);
    expect(task).not.toBeNull();
    expect(task!.id).toBe("TASK-099");
    expect(task!.type).toBe("Bug");
  });

  it("maps alternate frontmatter field names", () => {
    const fp = path.join(stateDir, "TASK-020.md");
    const content = "---\nid: TASK-020\nagent_role: Implementer\nrisk_level: High\nhuman_intervention_required: true\n---\n\nBody";
    fs.writeFileSync(fp, content, "utf-8");
    const task = parseTaskFile(fp);
    expect(task).not.toBeNull();
    expect(task!.agentRole).toBe("Implementer");
    expect(task!.riskLevel).toBe("High");
    expect(task!.humanInterventionRequired).toBe(true);
  });

  it("applies defaults for missing frontmatter fields", () => {
    const fp = path.join(stateDir, "TASK-030.md");
    fs.writeFileSync(fp, "---\nid: TASK-030\n---\n\nBody", "utf-8");
    const task = parseTaskFile(fp);
    expect(task).not.toBeNull();
    expect(task!.type).toBe("Task");
    expect(task!.status).toBe("Inbox");
    expect(task!.priority).toBe("P2");
    expect(task!.riskLevel).toBe("Low");
    expect(task!.humanInterventionRequired).toBe(false);
  });

  it("returns null for invalid frontmatter (bad status)", () => {
    const fp = path.join(stateDir, "TASK-BAD.md");
    fs.writeFileSync(fp, "---\nid: TASK-BAD\nstatus: InvalidStatus\n---\n\nBody", "utf-8");
    expect(parseTaskFile(fp)).toBeNull();
  });

  it("returns null for invalid frontmatter (bad priority)", () => {
    const fp = path.join(stateDir, "TASK-BAD.md");
    fs.writeFileSync(fp, "---\nid: TASK-BAD\npriority: P5\n---\n\nBody", "utf-8");
    expect(parseTaskFile(fp)).toBeNull();
  });

  it("parses issue and pr numbers from frontmatter", () => {
    const fp = path.join(stateDir, "TASK-040.md");
    fs.writeFileSync(fp, "---\nid: TASK-040\nissue: 42\npr: 100\n---\n\nBody", "utf-8");
    const task = parseTaskFile(fp);
    expect(task).not.toBeNull();
    expect(task!.issue).toBe(42);
    expect(task!.pr).toBe(100);
  });

  it("extracts body content after frontmatter", () => {
    const fp = makeTaskFile("TASK-050", { body: "## Goal\nSomething\n## Acceptance Criteria\n- [ ] Done" });
    const task = parseTaskFile(fp);
    expect(task).not.toBeNull();
    expect(task!.body).toContain("## Goal");
    expect(task!.body).toContain("Something");
    expect(task!.body).toContain("- [ ] Done");
  });
});

describe("writeTaskFile", () => {
  it("writes a task file that can be read back", () => {
    const fp = path.join(stateDir, "TASK-100.md");
    const task: ParsedTask = {
      id: "TASK-100",
      type: "Bug",
      status: "In Progress",
      priority: "P1",
      riskLevel: "Medium",
      humanInterventionRequired: false,
      body: "# TASK-100: Fix bug\n\n## Goal\nFix it.\n",
      filePath: fp,
    };
    writeTaskFile(task);
    expect(fs.existsSync(fp)).toBe(true);

    const readBack = parseTaskFile(fp);
    expect(readBack).not.toBeNull();
    expect(readBack!.id).toBe("TASK-100");
    expect(readBack!.type).toBe("Bug");
    expect(readBack!.status).toBe("In Progress");
    expect(readBack!.spec_hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("overrides body when provided", () => {
    const fp = path.join(stateDir, "TASK-101.md");
    const task: ParsedTask = {
      id: "TASK-101",
      type: "Task",
      status: "Ready",
      priority: "P2",
      riskLevel: "Low",
      humanInterventionRequired: false,
      body: "old body",
      filePath: fp,
    };
    writeTaskFile(task, "new body");
    const readBack = parseTaskFile(fp);
    expect(readBack!.body.trim()).toBe("new body");
  });

  it("omits undefined optional fields from frontmatter", () => {
    const fp = path.join(stateDir, "TASK-102.md");
    const task: ParsedTask = {
      id: "TASK-102",
      type: "Task",
      status: "Ready",
      priority: "P2",
      riskLevel: "Low",
      humanInterventionRequired: false,
      body: "body",
      filePath: fp,
    };
    writeTaskFile(task);
    const raw = fs.readFileSync(fp, "utf-8");
    expect(raw).not.toContain("agentRole");
    expect(raw).not.toContain("branch");
    expect(raw).not.toContain("worktree");
    expect(raw).not.toContain("issue");
    expect(raw).not.toContain("dependsOn");
  });

  it("serializes and deserializes dependsOn", () => {
    const fp = path.join(stateDir, "TASK-110.md");
    const task: ParsedTask = {
      id: "TASK-110",
      type: "Task",
      status: "Ready",
      priority: "P2",
      riskLevel: "Low",
      humanInterventionRequired: false,
      dependsOn: ["TASK-001", "TASK-002"],
      body: "body with dependsOn",
      filePath: fp,
    };
    writeTaskFile(task);

    const raw = fs.readFileSync(fp, "utf-8");
    expect(raw).toContain("TASK-001");
    expect(raw).toContain("TASK-002");

    const readBack = parseTaskFile(fp);
    expect(readBack).not.toBeNull();
    expect(readBack!.dependsOn).toEqual(["TASK-001", "TASK-002"]);
  });
});

describe("findDuplicateStructuralSections", () => {
  it("reports duplicate canonical section headings", () => {
    const duplicates = findDuplicateStructuralSections([
      "# TASK-001: Test",
      "",
      "## Goal",
      "",
      "First goal block.",
      "",
      "## Goal",
      "",
      "Second goal block.",
      "",
      "## Acceptance Criteria",
      "",
      "- [x] One",
      "",
      "## Acceptance Criteria",
      "",
      "- [ ]",
      "",
      "## Notes",
      "",
      "Non-structural heading should be ignored.",
    ].join("\n"));

    expect(duplicates).toEqual(["Acceptance Criteria", "Goal"]);
  });

  it("returns an empty list when structural headings are unique", () => {
    const duplicates = findDuplicateStructuralSections([
      "# TASK-001: Test",
      "",
      "## Goal",
      "",
      "Do something useful.",
      "",
      "## Acceptance Criteria",
      "",
      "- [x] Done",
      "",
      "## Agent Notes",
      "",
      "- Started work",
    ].join("\n"));

    expect(duplicates).toEqual([]);
  });
});

describe("updateTaskStatus", () => {
  it("updates status and returns updated task", () => {
    const fp = makeTaskFile("TASK-200", { status: "Ready" });
    const updated = updateTaskStatus(fp, "In Progress");
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("In Progress");

    const reread = parseTaskFile(fp);
    expect(reread!.status).toBe("In Progress");
  });

  it("returns null if file does not exist", () => {
    expect(updateTaskStatus("/nope.md", "Done")).toBeNull();
  });
});

describe("updateTaskIssue", () => {
  it("sets issue number and returns updated task", () => {
    const fp = makeTaskFile("TASK-300");
    const updated = updateTaskIssue(fp, 99);
    expect(updated).not.toBeNull();
    expect(updated!.issue).toBe(99);

    const reread = parseTaskFile(fp);
    expect(reread!.issue).toBe(99);
  });

  it("returns null if file does not exist", () => {
    expect(updateTaskIssue("/nope.md", 1)).toBeNull();
  });
});

describe("appendAgentNote", () => {
  it("appends a note under existing Agent Notes section", () => {
    const fp = makeTaskFile("TASK-400", { body: "# TASK-400: Test\n\n## Agent Notes\n\n" });
    appendAgentNote(fp, "2026-05-21", "Agent", ["Did something", "Ran tests"]);
    const reread = parseTaskFile(fp);
    expect(reread!.body).toContain("### 2026-05-21T00:00:00Z Agent");
    expect(reread!.body).toContain("- Did something");
    expect(reread!.body).toContain("- Ran tests");
  });

  it("creates Agent Notes section if missing", () => {
    const fp = makeTaskFile("TASK-401", { body: "# TASK-401: Test\n\n## Goal\nDo it.\n" });
    appendAgentNote(fp, "2026-05-21", "System", ["Started task"]);
    const reread = parseTaskFile(fp);
    expect(reread!.body).toContain("## Agent Notes");
    expect(reread!.body).toContain("### 2026-05-21T00:00:00Z System");
    expect(reread!.body).toContain("- Started task");
  });

  it("does nothing if file does not exist", () => {
    expect(() => appendAgentNote("/nope.md", "2026-05-21", "Agent", ["test"])).not.toThrow();
  });
});

describe("listTaskFiles", () => {
  it("returns .md files excluding README and TEMPLATE", () => {
    makeTaskFile("TASK-001");
    makeTaskFile("TASK-002");
    fs.writeFileSync(path.join(stateDir, "README.md"), "# README", "utf-8");
    fs.writeFileSync(path.join(stateDir, "TEMPLATE.md"), "# TEMPLATE", "utf-8");
    fs.writeFileSync(path.join(stateDir, "notes.txt"), "not md", "utf-8");

    const files = listTaskFiles(path.join(uniqueDir, "repo"));
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith("TASK-001.md"))).toBe(true);
    expect(files.some((f) => f.endsWith("TASK-002.md"))).toBe(true);
    expect(files.some((f) => f.endsWith("README.md"))).toBe(false);
    expect(files.some((f) => f.endsWith("TEMPLATE.md"))).toBe(false);
  });

  it("returns empty array when tasks dir does not exist", () => {
    const badDir = path.join(uniqueDir, "repo", "nonexistent");
    const files = listTaskFiles(badDir);
    expect(files).toEqual([]);
  });
});

describe("loadAllTasks", () => {
  it("loads all valid task files", () => {
    makeTaskFile("TASK-010");
    makeTaskFile("TASK-020", { status: "In Progress" });
    const tasks = loadAllTasks(path.join(uniqueDir, "repo"));
    expect(tasks).toHaveLength(2);
  });

  it("skips invalid task files", () => {
    makeTaskFile("TASK-010");
    const bad = path.join(stateDir, "BAD.md");
    fs.writeFileSync(bad, "---\nid: BAD\nstatus: Invalid\n---\n\nBody", "utf-8");
    const tasks = loadAllTasks(path.join(uniqueDir, "repo"));
    expect(tasks).toHaveLength(1);
  });
});

describe("loadTaskById", () => {
  it("loads a task by ID", () => {
    makeTaskFile("TASK-050");
    const task = loadTaskById("TASK-050", path.join(uniqueDir, "repo"));
    expect(task).not.toBeNull();
    expect(task!.id).toBe("TASK-050");
  });

  it("returns null for non-existent task", () => {
    expect(loadTaskById("TASK-999", path.join(uniqueDir, "repo"))).toBeNull();
  });
});

describe("getNextId", () => {
  it("increments from existing task IDs", () => {
    makeTaskFile("TASK-001");
    makeTaskFile("TASK-005");
    expect(getNextId(path.join(uniqueDir, "repo"))).toBe("TASK-006");
  });

  it("starts at TASK-001 when no tasks exist", () => {
    expect(getNextId(path.join(uniqueDir, "repo"))).toBe("TASK-001");
  });

  it("ignores non-numeric suffix IDs", () => {
    makeTaskFile("TASK-ABC");
    expect(getNextId(path.join(uniqueDir, "repo"))).toBe("TASK-001");
  });

  it("handles mixed ID patterns", () => {
    makeTaskFile("TASK-001");
    makeTaskFile("BUG-003");
    expect(getNextId(path.join(uniqueDir, "repo"))).toBe("TASK-004");
  });
});
