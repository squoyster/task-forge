import { describe, it, expect } from "vitest";
import { AuditEventSchema, AUDIT_EVENT_TYPES } from "../src/core/audit-schema.js";

describe("AuditEventSchema", () => {
  it("parses a valid audit event", () => {
    const result = AuditEventSchema.safeParse({
      timestamp: "2026-05-25T00:00:00.000Z",
      event: "task.command.started",
      taskId: "TASK-001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown event types", () => {
    const result = AuditEventSchema.safeParse({
      timestamp: "2026-05-25T00:00:00.000Z",
      event: "unknown.event",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all registered event types", () => {
    for (const eventType of AUDIT_EVENT_TYPES) {
      const result = AuditEventSchema.safeParse({
        timestamp: "2026-05-25T00:00:00.000Z",
        event: eventType,
      });
      expect(result.success).toBe(true);
    }
  });

  it("requires timestamp field", () => {
    const result = AuditEventSchema.safeParse({
      event: "task.command.started",
    });
    expect(result.success).toBe(false);
  });

  it("requires event field", () => {
    const result = AuditEventSchema.safeParse({
      timestamp: "2026-05-25T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const result = AuditEventSchema.safeParse({
      timestamp: "2026-05-25T00:00:00.000Z",
      event: "tool.execute",
      taskId: "TASK-001",
      sessionId: "abc123",
      agent: "implementer",
      summary: "npm test",
      metadata: { duration: 100 },
    });
    expect(result.success).toBe(true);
  });
});
