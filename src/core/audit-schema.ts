import { z } from "zod";

export const AUDIT_EVENT_TYPES = [
  "task.command.started",
  "task.command.completed",
  "task.command.failed",
  "task.state.changed",
  "git.commit",
  "git.push",
  "tool.execute.before",
  "tool.execute.after",
  "tool.execute",
  "file.edited",
  "permission.asked",
  "permission.replied",
  "permission.requested",
  "permission.responded",
  "doctor.lock.created",
  "doctor.lock.released",
  "doctor.fix.applied",
  "verification.started",
  "verification.completed",
  "verification.failed",
  "session.started",
  "github.pr.created",
  "github.pr.manual",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AuditEventSchema = z.object({
  timestamp: z.string(),
  event: z.enum(AUDIT_EVENT_TYPES),
  taskId: z.string().optional(),
  sessionId: z.string().optional(),
  agent: z.string().optional(),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
