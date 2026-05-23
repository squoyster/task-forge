import { z } from "zod";

export const AuditEventSchema = z.object({
  timestamp: z.string(),
  event: z.string(),
  taskId: z.string().optional(),
  sessionId: z.string().optional(),
  agent: z.string().optional(),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AUDIT_EVENT_TYPES = [
  "task.command.started",
  "task.command.completed",
  "task.command.failed",
  "task.state.changed",
  "git.commit",
  "git.push",
  "tool.execute.before",
  "tool.execute.after",
  "file.edited",
  "permission.asked",
  "permission.replied",
  "doctor.lock.created",
  "doctor.lock.released",
  "doctor.fix.applied",
  "verification.started",
  "verification.completed",
  "verification.failed",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
