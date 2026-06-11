import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  TaskForgeCommandResultSchema,
  STANDARD_PROHIBITED_ACTIONS,
  type TaskForgeCommandResult,
} from "../src/core/command-result.js";
import {
  successResult,
  blockedResult,
  failedResult,
  noopResult,
  humanRequiredResult,
  doctorRequiredResult,
  contextCleanupResult,
} from "../src/core/result-builder.js";
import { renderResultMarkdown, renderResultJson } from "../src/core/result-renderer.js";
import { getValidNextCommands, getAllValidNextCommands } from "../src/core/next-command-maps.js";

function commandName(spec: string): string {
  return spec.split(/\s+/)[0]!;
}

function registeredCliCommands(): string[] {
  const source = fs.readFileSync(new URL("../src/cli.ts", import.meta.url), "utf-8");
  const commands = new Set<string>();
  const groupVars = new Map<string, string>();

  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*program\.command\("([^"]+)"/g)) {
    groupVars.set(match[1]!, commandName(match[2]!));
  }

  for (const match of source.matchAll(/program\s*\n\s*\.command\("([^"]+)"/g)) {
    commands.add(commandName(match[1]!));
  }

  for (const [variable, prefix] of groupVars) {
    const childPattern = new RegExp(`${variable}\\s*\\n\\s*\\.command\\("([^"]+)"`, "g");
    for (const match of source.matchAll(childPattern)) {
      commands.add(`${prefix} ${commandName(match[1]!)}`);
    }
  }

  return [...commands].sort();
}

describe("command-result schema", () => {
  it("validates a minimal success result", () => {
    const result: TaskForgeCommandResult = {
      ok: true,
      status: "success",
      metadata: { command: "test", timestamp: new Date().toISOString() },
      context: {},
      agentPrompt: { role: "implementer" },
      validNextCommands: [],
      nextActions: [],
      todoMerge: { required: false, items: [] },
      contextCleanup: { required: false, actions: [] },
      prohibitedActions: [],
      recovery: { required: false, steps: [] },
      diagnostics: [],
    };

    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("validates a result with all fields", () => {
    const result = {
      ok: false,
      status: "failed",
      metadata: { command: "test", timestamp: new Date().toISOString(), duration: 100, sessionId: "abc123" },
      context: { taskId: "TASK-001", worktree: "/tmp/wt", branch: "agent/TASK-001" },
      agentPrompt: { role: "implementer", instruction: "Fix the bug" },
      validNextCommands: [{ command: "taskforge start", purpose: "Retry", when: "After fix", allowedFor: "all", priority: 1 }],
      nextActions: [{
        command: "taskforge start TASK-001",
        reason: "Retry",
        safety: "safe",
        preferred: true,
      }],
      todoMerge: { required: true, items: [{ taskId: "TASK-001", action: "update", content: "Fix bug" }] },
      contextCleanup: { required: true, reason: "Task switching", actions: ["Commit changes"] },
      prohibitedActions: [{ action: "git commit", reason: "Use checkpoint" }],
      recovery: { required: true, steps: ["Step 1", "Step 2"], createTaskBody: "Body" },
      diagnostics: [{ level: "error", message: "Test error" }],
      audit: { taskId: "TASK-001", transcriptPath: "/tmp/transcript.jsonl", eventId: "evt-1" },
      guidance: "Fix the issue",
      commandError: { code: "TEST_ERROR", message: "Something failed", handled: true },
      error: "Something failed",
      code: "TEST_ERROR",
    };

    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = {
      ok: true,
      status: "invalid_status",
      metadata: { command: "test", timestamp: new Date().toISOString() },
      context: {},
      agentPrompt: { role: "implementer" },
    };

    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = { ok: true };
    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });
});

describe("result builders", () => {
  it("successResult produces valid result", () => {
    const result = successResult({
      command: "test",
      taskId: "TASK-001",
      nextCommands: [{ command: "taskforge inspect <TASK-ID>", purpose: "Inspect task", when: "after success", allowedFor: "all", priority: 1 }],
    });
    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.nextActions[0]).toMatchObject({
      command: "taskforge inspect TASK-001",
      reason: "Inspect task",
      safety: "safe",
      preferred: true,
    });
  });

  it("blockedResult produces valid result", () => {
    const result = blockedResult({ command: "test", reason: "Blocked by human" });
    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.error).toBe("Blocked by human");
    expect(result.commandError).toMatchObject({
      code: "BLOCKED",
      message: "Blocked by human",
      handled: false,
    });
  });

  it("failedResult produces valid result with recovery", () => {
    const result = failedResult({
      command: "test",
      error: "Test failed",
      code: "TEST_FAIL",
      recoverySteps: ["Step 1", "Step 2"],
    });
    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.recovery.required).toBe(true);
  });

  it("noopResult produces valid result", () => {
    const result = noopResult({ command: "test", reason: "Nothing to do" });
    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("noop");
  });

  it("humanRequiredResult produces valid result", () => {
    const result = humanRequiredResult({ command: "test", reason: "Requires human approval" });
    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("human_required");
    expect(result.recovery.required).toBe(true);
  });

  it("doctorRequiredResult produces valid result", () => {
    const result = doctorRequiredResult({ command: "test", reason: "System inconsistency detected" });
    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("doctor_required");
  });

  it("contextCleanupResult produces valid result with cleanup required", () => {
    const result = contextCleanupResult({
      command: "test",
      reason: "Task switching",
      actions: ["Commit changes", "Push branch"],
    });
    const parsed = TaskForgeCommandResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.contextCleanup.required).toBe(true);
  });
});

describe("standard prohibited actions", () => {
  it("has exactly 5 standard prohibitions", () => {
    expect(STANDARD_PROHIBITED_ACTIONS).toHaveLength(5);
  });

  it("includes git commit prohibition", () => {
    const gitCommit = STANDARD_PROHIBITED_ACTIONS.find((a) => a.action === "git commit");
    expect(gitCommit).toBeDefined();
    expect(gitCommit?.reason).toContain("checkpoint");
  });

  it("includes git push prohibition", () => {
    const gitPush = STANDARD_PROHIBITED_ACTIONS.find((a) => a.action === "git push");
    expect(gitPush).toBeDefined();
    expect(gitPush?.reason).toContain("submit");
  });
});

describe("result renderer", () => {
  it("renders success result to markdown", () => {
    const result = successResult({
      command: "test",
      taskId: "TASK-001",
      guidance: "All good",
    });
    const markdown = renderResultMarkdown(result);
    expect(markdown).toContain("Command Success: success");
    expect(markdown).toContain("TASK-001");
    expect(markdown).toContain("All good");
    expect(markdown).toContain("Prohibited Actions");
  });

  it("renders structured next actions to markdown as the final section", () => {
    const result = successResult({
      command: "test",
      taskId: "TASK-001",
      nextCommands: [{ command: "taskforge inspect <TASK-ID>", purpose: "Inspect task", when: "after success", allowedFor: "all", priority: 1 }],
    });
    const markdown = renderResultMarkdown(result);

    expect(markdown).toContain("## Valid next actions:");
    expect(markdown).toContain("1. `taskforge inspect TASK-001`");
    expect(markdown).toContain("Reason: Inspect task");
    expect(markdown).toContain("Safety: safe");
    expect(markdown.trim().endsWith("Safety: safe")).toBe(true);
  });

  it("renders error result to markdown", () => {
    const result = failedResult({
      command: "test",
      error: "Something failed",
      code: "TEST_ERROR",
    });
    const markdown = renderResultMarkdown(result);
    expect(markdown).toContain("Command Status: failed");
    expect(markdown).toContain("Something failed");
    expect(markdown).toContain("TEST_ERROR");
  });

  it("renders result to JSON", () => {
    const result = successResult({ command: "test" });
    const json = renderResultJson(result);
    const parsed = JSON.parse(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.status).toBe("success");
  });
});

describe("next command maps", () => {
  it("returns next commands for start success", () => {
    const commands = getValidNextCommands("start", "success");
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.some((c) => c.command.includes("checkpoint"))).toBe(true);
  });

  it("returns empty array for unknown command", () => {
    const commands = getValidNextCommands("unknown", "success");
    expect(commands).toHaveLength(0);
  });

  it("returns all next commands for a command", () => {
    const commands = getAllValidNextCommands("start");
    expect(commands.length).toBeGreaterThan(0);
  });

  it("has maps for all major commands", () => {
    const majorCommands = ["init", "next", "start", "done", "claim", "release", "heartbeat", "checkpoint", "submit", "pr"];
    for (const cmd of majorCommands) {
      const commands = getAllValidNextCommands(cmd);
      expect(commands.length).toBeGreaterThan(0);
    }
  });

  it("has a next-action map for every registered CLI command", () => {
    const missing = registeredCliCommands().filter((cmd) => getAllValidNextCommands(cmd).length === 0);

    expect(missing).toEqual([]);
  });
});

describe("invariant tests", () => {
  it("every builder result validates against schema", () => {
    const results = [
      successResult({ command: "test" }),
      blockedResult({ command: "test", reason: "blocked" }),
      failedResult({ command: "test", error: "failed" }),
      noopResult({ command: "test" }),
      humanRequiredResult({ command: "test", reason: "human" }),
      doctorRequiredResult({ command: "test", reason: "doctor" }),
      contextCleanupResult({ command: "test", reason: "cleanup", actions: [] }),
    ];

    for (const result of results) {
      const parsed = TaskForgeCommandResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    }
  });

  it("every result has required fields: ok, status, validNextCommands, todoMerge, contextCleanup, prohibitedActions", () => {
    const result = successResult({ command: "test" });
    expect(result).toHaveProperty("ok");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("validNextCommands");
    expect(result).toHaveProperty("nextActions");
    expect(result).toHaveProperty("todoMerge");
    expect(result).toHaveProperty("contextCleanup");
    expect(result).toHaveProperty("prohibitedActions");
  });

  it("task-switching commands require contextCleanup.required=true", () => {
    const result = contextCleanupResult({
      command: "test",
      reason: "Task switching",
      actions: ["Commit changes"],
    });
    expect(result.contextCleanup.required).toBe(true);
  });
});
