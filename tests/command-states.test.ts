import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  COMMAND_STATE_REGISTRY,
  claimStateMachine,
  getErrorGuidance,
  getNextActions,
  startStateMachine,
  gatesStateMachine,
  ClaimStates,
  StartStates,
} from "../src/core/command-states.js";

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

describe("claimStateMachine — no force/start guidance", () => {
  it("does not recommend 'taskforge start' on success with worktree", () => {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeExists: true,
      worktreePath: "/tmp/worktree/TASK-001",
      taskId: "TASK-001",
      sessionId: "abc123",
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe(ClaimStates.TASK_CLAIMED);
    // Should NOT tell agent to run start as a next command
    expect(result.guidance).not.toMatch(/Run 'taskforge start/i);
    expect(result.guidance).toContain("cd /tmp/worktree/TASK-001");
  });

  it("does not recommend 'taskforge start' on success without worktree", () => {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeExists: false,
      taskId: "TASK-001",
      sessionId: "abc123",
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe(ClaimStates.TASK_CLAIMED);
    // Should NOT recommend start as a positive next command.
    // The guidance may say "Do NOT run 'taskforge start'" which is a warning — that's fine.
    // We check that there's no positive "Run 'taskforge start" without "Do NOT" preceding it.
    const hasPositiveStartRecommendation = /(?<!Do NOT )Run 'taskforge start/i.test(result.guidance);
    expect(hasPositiveStartRecommendation).toBe(false);
    // Should explicitly warn against it
    expect(result.guidance).toContain("Do NOT run");
    expect(result.guidance).toContain("taskforge doctor");
    expect(result.guidance).toContain("taskforge block");
  });

  it("does not recommend --force as a valid action on already-claimed error", () => {
    const result = claimStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      taskAssignee: "other-session",
      taskClaimedAt: "2026-05-28 01:00:00",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      taskId: "TASK-001",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("ALREADY_CLAIMED");
    // Should NOT recommend using --force (it may say "may not use")
    expect(result.guidance).not.toMatch(/use 'taskforge.*--force'/i);
    expect(result.guidance).not.toMatch(/use.*--force.*to override/i);
    // Should explicitly say agents may not use it
    expect(result.guidance).toContain("Normal agents may not use --force");
    expect(result.guidance).toContain("taskforge doctor");
    expect(result.guidance).toContain("taskforge block");
  });
});

describe("startStateMachine — no force guidance", () => {
  it("does not recommend --force as a valid action on already-assigned error", () => {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: "In Progress",
      taskAssignee: "other-session",
      taskClaimedAt: "2026-05-28 01:00:00",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeCreated: false,
      taskId: "TASK-001",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("ALREADY_ASSIGNED");
    // Should NOT recommend using --force (it may say "may not use")
    expect(result.guidance).not.toMatch(/use 'taskforge.*--force'/i);
    expect(result.guidance).not.toMatch(/use.*--force.*to override/i);
    expect(result.guidance).not.toMatch(/use.*--force.*if.*stale/i);
    // Should explicitly say agents may not use it
    expect(result.guidance).toContain("Normal agents may not use --force");
    expect(result.guidance).toContain("taskforge resume");
    expect(result.guidance).toContain("taskforge doctor");
    expect(result.guidance).toContain("taskforge block");
  });

  it("does not recommend --force on push failure", () => {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: false,
      worktreeCreated: false,
      taskId: "TASK-001",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("PUSH_FAILED");
    expect(result.guidance).not.toMatch(/--force/i);
    expect(result.guidance).toContain("taskforge next");
    expect(result.guidance).toContain("retry");
  });

  it("succeeds with worktree guidance on happy path", () => {
    const result = startStateMachine({
      taskFound: true,
      taskStatus: "Ready",
      doctorLocked: false,
      hasOutstandingTask: false,
      pushSucceeded: true,
      worktreeCreated: true,
      worktreePath: "/tmp/worktree/TASK-001",
      branch: "agent/TASK-001-test",
      taskId: "TASK-001",
      sessionId: "abc123",
    });

    expect(result.ok).toBe(true);
    expect(result.state).toBe(StartStates.TASK_STARTED);
    expect(result.guidance).toContain("cd /tmp/worktree/TASK-001");
  });
});

describe("gatesStateMachine — no done --force guidance", () => {
  it("does not recommend 'done --force' on gate failure", () => {
    const result = gatesStateMachine({
      totalGates: 3,
      passedGates: 1,
      failedGates: [
        { name: "lint", command: "npm run lint" },
        { name: "test", command: "npm test" },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("GATE_FAILURE");
    expect(result.guidance).not.toMatch(/done --force/i);
    expect(result.guidance).toContain("Fix the issues");
    expect(result.guidance).toContain("request human input");
  });
});

describe("command state registry", () => {
  it("covers every command registered in the CLI", () => {
    const registered = registeredCliCommands();
    const missing = registered.filter((command) => !COMMAND_STATE_REGISTRY[command]);

    expect(missing).toEqual([]);
  });

  it("returns spec-shaped next actions with task placeholders resolved", () => {
    const actions = getNextActions("start", { taskId: "TASK-123" });

    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]).toMatchObject({
      command: "opencode",
      safety: "safe",
      preferred: true,
    });
    expect(actions.every((action) => typeof action.reason === "string")).toBe(true);
  });

  it("maps known errors to safe or escalated next actions", () => {
    const actions = getErrorGuidance("done", "WORKTREE_DIRTY", { taskId: "TASK-123" });

    expect(actions[0]).toMatchObject({
      command: "taskforge checkpoint TASK-123 --message \"Save completion work\"",
      safety: "safe",
      preferred: true,
    });
  });

  it("returns a closure task action for unknown errors", () => {
    const actions = getErrorGuidance("done", "NEW_UNKNOWN_ERROR", { taskId: "TASK-123" });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      safety: "requires_human",
      preferred: true,
    });
    expect(actions[0]?.command).toContain("taskforge new");
    expect(actions[0]?.command).toContain("NEW_UNKNOWN_ERROR");
  });

  it("marks force paths as human or doctor authority only", () => {
    const unsafeForceActions = Object.values(COMMAND_STATE_REGISTRY).flatMap((rule) => [
      ...rule.nextActions,
      ...Object.values(rule.errorActions).flat(),
    ]).filter((action) => action.command.includes("--force") && action.safety !== "doctor_only" && action.safety !== "requires_human");

    expect(unsafeForceActions).toEqual([]);
  });

  it("keeps legacy state machines compatible while exposing spec-shaped actions", () => {
    const result = gatesStateMachine({
      totalGates: 0,
      passedGates: 0,
      failedGates: [],
    });

    expect(result.nextAction).toBe("create_pr");
    expect(result.nextActions[0]).toMatchObject({
      command: "taskforge submit TASK-ID",
      safety: "safe",
      preferred: true,
    });
  });
});
