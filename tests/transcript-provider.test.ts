import { describe, it, expect } from "vitest";
import type { TranscriptProvider, AuditEvent } from "../src/core/transcript-provider.js";

describe("TranscriptProvider interface", () => {
  it("defines the expected method signatures", () => {
    // Create a mock implementation to verify the interface shape
    const mockProvider: TranscriptProvider = {
      appendEvent: (taskId: string, event: AuditEvent) => { /* mock */ },
      readEvents: (taskId: string) => [],
      importEvents: (taskId: string, events: AuditEvent[]) => { /* mock */ },
    };

    expect(typeof mockProvider.appendEvent).toBe("function");
    expect(typeof mockProvider.readEvents).toBe("function");
    expect(typeof mockProvider.importEvents).toBe("function");
  });

  it("accepts an implementation with all required methods", () => {
    const provider: TranscriptProvider = {
      appendEvent: (taskId: string, event: AuditEvent) => { /* mock */ },
      readEvents: (taskId: string) => [],
      importEvents: (taskId: string, events: AuditEvent[]) => { /* mock */ },
    };

    // Verify the provider can be used
    const event: AuditEvent = {
      timestamp: "2026-01-01T00:00:00.000Z",
      event: "test",
      taskId: "TASK-001",
    };

    provider.appendEvent("TASK-001", event);
    const events = provider.readEvents("TASK-001");
    expect(events).toEqual([]);
    provider.importEvents("TASK-001", [event]);
  });
});
