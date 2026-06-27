import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { setRepoRoot } from "../src/util/paths.js";
import {
  runCommandForResult,
  buildGetTaskResult,
  buildTaskResource,
  isValidTaskId,
  McpCommandResultSchema,
} from "../src/core/mcp-contract.js";
import { emitResult, setResultSink, type ResultSink } from "../src/core/command-result.js";
import { successResult, failedResult } from "../src/core/result-builder.js";

let uniqueDir: string;
let repoDir: string;
let stateDir: string;

beforeEach(() => {
  uniqueDir = fs.mkdtempSync(path.join(os.tmpdir(), "taskforge-mcp-contract-"));
  repoDir = path.join(uniqueDir, "repo");
  stateDir = path.resolve(repoDir, "..", "task-state");
  fs.mkdirSync(stateDir, { recursive: true });
  setRepoRoot(repoDir);
});

afterEach(() => {
  fs.rmSync(uniqueDir, { recursive: true, force: true });
});

function writeTask(id: string, status = "Ready"): string {
  const fp = path.join(stateDir, `${id}.md`);
  fs.writeFileSync(
    fp,
    [
      "---",
      `id: ${id}`,
      "type: Task",
      `status: "${status}"`,
      "priority: P2",
      "---",
      "",
      `# ${id}: Test task`,
      "",
      "## Goal",
      "Do something.",
      "",
    ].join("\n"),
    "utf-8",
  );
  return fp;
}

describe("isValidTaskId", () => {
  it("accepts opaque ids like TASK-324", () => {
    expect(isValidTaskId("TASK-324")).toBe(true);
    expect(isValidTaskId("TASK_001")).toBe(true);
    expect(isValidTaskId("A1-b2_c3")).toBe(true);
  });

  it("rejects path traversal and filesystem-shaped inputs", () => {
    expect(isValidTaskId("../../etc/passwd")).toBe(false);
    expect(isValidTaskId("../task-state/x.md")).toBe(false);
    expect(isValidTaskId("/abs/path")).toBe(false);
    expect(isValidTaskId(".hidden")).toBe(false);
    expect(isValidTaskId("a/b")).toBe(false);
    expect(isValidTaskId("")).toBe(false);
    expect(isValidTaskId("has space")).toBe(false);
  });
});

describe("McpCommandResultSchema", () => {
  it("is passthrough: preserves command-specific enrichment keys", () => {
    const enriched = {
      ok: true,
      status: "success",
      metadata: { command: "next", timestamp: "now" },
      context: {},
      agentPrompt: { role: "implementer" },
      validNextCommands: [],
      nextActions: [],
      todoMerge: { required: false, items: [] },
      contextCleanup: { required: false, actions: [] },
      prohibitedActions: [],
      recovery: { required: false, steps: [] },
      diagnostics: [],
      // next's enrichment packet:
      task: { id: "TASK-1" },
      score: 42,
      workspace: { branch: "agent/x" },
    };
    const parsed = McpCommandResultSchema.safeParse(enriched);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>).task).toEqual({ id: "TASK-1" });
      expect((parsed.data as Record<string, unknown>).score).toBe(42);
    }
  });
});

describe("runCommandForResult", () => {
  it("captures a result emitted by the command via the sink", async () => {
    const expected = successResult({ command: "fake" });
    const result = await runCommandForResult("fake", async () => {
      emitResult(expected, true);
    });
    expect(result.ok).toBe(true);
    expect(result.metadata.command).toBe("fake");
  });

  it("synthesizes a failed result when the command throws without emitting", async () => {
    const result = await runCommandForResult("fake", async () => {
      throw new Error("boom");
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.code).toBe("COMMAND_THREW");
    expect(result.error).toBe("boom");
  });

  it("keeps the emitted result even when the command throws afterwards", async () => {
    const expected = failedResult({ command: "fake", error: "handled", code: "NEEDS_FORCE" });
    const result = await runCommandForResult("fake", async () => {
      emitResult(expected, true);
      throw new Error("later");
    });
    expect(result.code).toBe("NEEDS_FORCE");
    expect(result.error).toBe("handled");
  });

  it("synthesizes a failed result when the command completes without emitting", async () => {
    const result = await runCommandForResult("fake", async () => {
      // no emit
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NO_RESULT_EMIT");
  });

  it("restores the previous sink after running", async () => {
    let outerCaptured: unknown = null;
    const outer: ResultSink = (r) => {
      outerCaptured = r;
    };
    const prev = setResultSink(outer);
    try {
      await runCommandForResult("fake", async () => {
        emitResult(successResult({ command: "fake" }), true);
      });
      // After runCommandForResult, the outer sink is still installed and
      // untouched by the inner capture.
      emitResult(failedResult({ command: "outer", error: "x" }), true);
      expect(outerCaptured).not.toBeNull();
    } finally {
      setResultSink(prev);
    }
  });
});

describe("buildGetTaskResult", () => {
  it("returns a success result with typed task metadata for an existing task", () => {
    writeTask("TASK-324");
    const result = buildGetTaskResult("TASK-324");
    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.data).toBeDefined();
    const task = (result.data as { task: Record<string, unknown> }).task;
    expect(task.id).toBe("TASK-324");
    expect(task.status).toBe("ready");
    expect(task.title).toBe("Test task");
  });

  it("returns a TASK_NOT_FOUND failed result for a missing task", () => {
    const result = buildGetTaskResult("TASK-999");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TASK_NOT_FOUND");
  });
});

describe("buildTaskResource", () => {
  it("returns the task body as read-only markdown, never the filePath", () => {
    writeTask("TASK-324");
    const res = buildTaskResource("TASK-324");
    expect(res.contents).toHaveLength(1);
    expect(res.contents[0].uri).toBe("taskforge://task/TASK-324");
    expect(res.contents[0].mimeType).toBe("text/markdown");
    expect(res.contents[0].text).toContain("# TASK-324: Test task");
    expect(res.contents[0].text).not.toContain(repoDir);
    expect(res.contents[0].text).not.toContain(".md\n");
  });

  it("returns a not-found body for a missing task", () => {
    const res = buildTaskResource("TASK-999");
    expect(res.contents[0].text).toContain("not found");
  });
});
