import { describe, it, expect } from "vitest";
import { CommandResultEnvelope, envelopeOk, envelopeError } from "../src/core/envelope.js";

describe("CommandResultEnvelope", () => {
  it("has required fields on success envelope", () => {
    const envelope: CommandResultEnvelope<string> = envelopeOk(
      "task_started",
      "TASK-001",
      {
        kind: "continue",
        instruction: "Implement the task",
        stop: false,
        allowedCommands: ["taskforge done", "taskforge block"],
      },
    );

    expect(envelope.ok).toBe(true);
    expect(envelope.state).toBe("task_started");
    expect(envelope.data).toBe("TASK-001");
    expect(envelope.nextAction.kind).toBe("continue");
    expect(envelope.nextAction.instruction).toBe("Implement the task");
    expect(envelope.nextAction.stop).toBe(false);
    expect(envelope.nextAction.allowedCommands).toEqual(["taskforge done", "taskforge block"]);
  });

  it("has required fields on error envelope", () => {
    const envelope = envelopeError("gate_failure", "Fix type errors before completing");

    expect(envelope.ok).toBe(false);
    expect(envelope.state).toBe("gate_failure");
    expect(envelope.nextAction.kind).toBe("error");
    expect(envelope.nextAction.instruction).toBe("Fix type errors before completing");
    expect(envelope.nextAction.stop).toBe(true);
    expect(envelope.nextAction.allowedCommands).toEqual([]);
  });

  it("works without data (generic default)", () => {
    const envelope: CommandResultEnvelope = envelopeOk(
      "ready",
      undefined,
      {
        kind: "start",
        instruction: "Run taskforge start TASK-001",
        stop: false,
        allowedCommands: ["taskforge start"],
      },
    );

    expect(envelope.ok).toBe(true);
    expect(envelope.data).toBeUndefined();
  });
});
